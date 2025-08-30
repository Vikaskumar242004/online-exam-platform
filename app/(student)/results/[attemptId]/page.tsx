import { notFound } from "next/navigation"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Button } from "@/components/ui/button"

type Quiz = {
  id: string
  title: string
  description: string | null
  show_correct_answers: "never" | "after_due" | "immediate"
  end_at: string | null
}

type Question = {
  id: string
  quiz_id: string
  kind: "single" | "multiple" | "boolean" | "short"
  prompt: string
  order_index: number
  options?: Array<{ id: string; label: string; is_correct: boolean; order_index: number }>
}

type Answer = {
  id: string
  attempt_id: string
  question_id: string
  selected_option_ids: string[] | null
  short_text: string | null
  points_awarded: number
  correct: boolean | null
}

function isAfterDue(quiz: Quiz) {
  if (!quiz.end_at) return false
  return Date.now() >= new Date(quiz.end_at).getTime()
}

function showAnswers(quiz: Quiz) {
  if (quiz.show_correct_answers === "never") return false
  if (quiz.show_correct_answers === "immediate") return true
  return isAfterDue(quiz)
}

function computeCorrect(question: Question, answer: Answer | undefined) {
  if (!answer) return null
  if (question.kind === "short") return null // manual grading
  const selected = new Set(answer.selected_option_ids ?? [])
  const correctIds = new Set((question.options ?? []).filter((o) => o.is_correct).map((o) => o.id))
  if (question.kind === "single" || question.kind === "boolean") {
    if (selected.size !== 1 || correctIds.size !== 1) return false
    const sel = Array.from(selected)[0]
    const cor = Array.from(correctIds)[0]
    return sel === cor
  }
  // multiple: must match exactly
  if (selected.size !== correctIds.size) return false
  for (const id of selected) {
    if (!correctIds.has(id)) return false
  }
  return true
}

export default async function AttemptReviewPage({ params }: { params: { attemptId: string } }) {
  const supabase = getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return notFound()

  // Load attempt (ensure ownership)
  const { data: attempt, error: attErr } = await supabase
    .from("attempts")
    .select("id, quiz_id, status, score, started_at, submitted_at, user_id")
    .eq("id", params.attemptId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (attErr || !attempt) return notFound()

  // Load quiz, questions, options
  const { data: quiz, error: qErr } = await supabase
    .from("quizzes")
    .select("id, title, description, show_correct_answers, end_at")
    .eq("id", attempt.quiz_id)
    .maybeSingle()

  if (qErr || !quiz) return notFound()

  const { data: questions, error: qsErr } = await supabase
    .from("questions")
    .select("id, quiz_id, kind, prompt, order_index")
    .eq("quiz_id", quiz.id)
    .order("order_index", { ascending: true })

  if (qsErr || !questions) return notFound()

  const { data: options, error: opErr } = await supabase
    .from("options")
    .select("id, question_id, label, is_correct, order_index")
    .in("question_id", questions.length ? questions.map((q) => q.id) : ["00000000-0000-0000-0000-000000000000"])
    .order("order_index", { ascending: true })

  if (opErr) return notFound()

  const { data: answers } = await supabase
    .from("answers")
    .select("id, attempt_id, question_id, selected_option_ids, short_text, points_awarded, correct")

  // Merge options into questions
  const qMap: Record<string, Question> = {}
  for (const q of questions) {
    qMap[q.id] = { ...q, options: [] }
  }
  for (const o of options ?? []) {
    const list = qMap[o.question_id]?.options
    if (list) list.push({ id: o.id, label: o.label, is_correct: o.is_correct, order_index: o.order_index })
  }

  const aMap: Record<string, Answer> = {}
  for (const a of answers ?? []) {
    aMap[a.question_id] = a
  }

  const canShowAnswers = showAnswers(quiz as Quiz)

  let correctCount = 0
  let autoGradable = 0

  const rows = (questions ?? []).map((q, idx) => {
    const question = qMap[q.id]
    const answer = aMap[q.id]
    const computed = computeCorrect(question as Question, answer as Answer | undefined)
    if (computed !== null) {
      autoGradable += 1
      if (computed) correctCount += 1
    }
    return { idx: idx + 1, question, answer, computed }
  })

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-pretty text-2xl font-semibold">{(quiz as Quiz).title}</h1>
          <p className="text-sm text-muted-foreground">
            Attempt status: {attempt.status.replace("_", " ")} • Submitted:{" "}
            {attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleString() : "—"}
          </p>
          <p className="text-sm text-muted-foreground">
            Autograded (preview): {correctCount}/{autoGradable}
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/results">Back to results</Link>
        </Button>
      </div>

      <div className="space-y-4">
        {rows.map(({ idx, question, answer, computed }) => {
          const sel = new Set(answer?.selected_option_ids ?? [])
          const opts = (question.options ?? []).slice().sort((a, b) => a.order_index - b.order_index)
          const showCorrectBadges = canShowAnswers && question.kind !== "short"

          return (
            <Card key={question.id}>
              <CardHeader>
                <CardTitle className="text-base">
                  {idx}. {question.prompt}
                </CardTitle>
                <CardDescription>
                  {question.kind === "short"
                    ? "Short answer (awaiting manual grading)"
                    : question.kind === "multiple"
                      ? "Multiple select"
                      : question.kind === "single"
                        ? "Single select"
                        : "True/False"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {question.kind === "short" ? (
                  <div className="text-sm">
                    <span className="font-medium">Your answer: </span>
                    <span className="whitespace-pre-wrap">{answer?.short_text ?? "—"}</span>
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {opts.map((o) => {
                      const isSelected = sel.has(o.id)
                      const isCorrect = o.is_correct
                      return (
                        <li key={o.id} className="text-sm">
                          <span className="font-medium">{isSelected ? "• " : "○ "}</span>
                          <span>{o.label}</span>
                          {showCorrectBadges ? (
                            isCorrect ? (
                              <span className="ml-2 rounded bg-secondary px-2 py-0.5 text-xs">Correct</span>
                            ) : null
                          ) : null}
                        </li>
                      )
                    })}
                  </ul>
                )}

                {computed !== null ? (
                  <div className={`text-sm ${computed ? "text-green-600" : "text-destructive"}`} aria-live="polite">
                    {computed
                      ? "Your selection matches the correct answer."
                      : "Your selection does not match the correct answer."}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">This question requires manual grading.</div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </main>
  )
}
