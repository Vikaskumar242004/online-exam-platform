import { redirect } from "next/navigation"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export default async function QuizAnalyticsPage({ params }: { params: { id: string } }) {
  const supabase = getSupabaseServerClient()

  // Auth + admin + ownership checks
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: me } = await supabase.from("profiles").select("id, role").eq("id", user.id).maybeSingle()
  if (!me || me.role !== "admin") redirect("/")

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("id, title, created_by")
    .eq("id", params.id)
    .maybeSingle()

  if (!quiz || quiz.created_by !== user.id) redirect("/admin")

  // Load structure
  const { data: questions } = await supabase
    .from("questions")
    .select("id, prompt, kind, points, order_index")
    .eq("quiz_id", quiz.id)
    .order("order_index", { ascending: true })

  const qIds = (questions ?? []).map((q) => q.id)
  const { data: options } = await supabase
    .from("options")
    .select("id, question_id, label, is_correct, order_index")
    .in("question_id", qIds.length ? qIds : ["00000000-0000-0000-0000-000000000000"])
    .order("order_index", { ascending: true })

  // Assignments
  const { count: assignedCount } = await supabase
    .from("quiz_assignments")
    .select("user_id", { count: "exact", head: true })
    .eq("quiz_id", quiz.id)

  // Attempts + Scores
  const { data: attempts } = await supabase.from("attempts").select("id, status, score").eq("quiz_id", quiz.id)

  const attemptIds = (attempts ?? []).map((a) => a.id)
  const { data: answers } = await supabase
    .from("answers")
    .select("id, attempt_id, question_id, selected_option_ids, correct, points_awarded")
    .in("attempt_id", attemptIds.length ? attemptIds : ["00000000-0000-0000-0000-000000000000"])

  // Aggregations
  const totalAssigned = assignedCount ?? 0
  const totalAttempts = attempts?.length ?? 0
  const submittedAttempts = (attempts ?? []).filter(
    (a) => a.status === "submitted" || a.status === "auto_submitted",
  ).length
  const avgScore =
    (attempts ?? []).length > 0
      ? ((attempts ?? []).reduce((sum, a) => sum + Number(a.score || 0), 0) / (attempts ?? []).length).toFixed(2)
      : "0.00"
  const completionRate =
    totalAssigned > 0 ? Math.round((submittedAttempts / totalAssigned) * 100) : totalAttempts > 0 ? 100 : 0

  // Compute totals for quiz and per-question stats
  const totalPossible = (questions ?? []).reduce((s, q) => s + Number(q.points || 0), 0)

  type QStat = {
    id: string
    prompt: string
    kind: string
    points: number
    totalResponses: number
    correctCount: number
    accuracyPct: number
    optionSelections: Record<string, number> // optionId -> count
  }

  const initialStats: Record<string, QStat> = {}
  for (const q of questions ?? []) {
    initialStats[q.id] = {
      id: q.id,
      prompt: q.prompt,
      kind: q.kind,
      points: Number(q.points || 0),
      totalResponses: 0,
      correctCount: 0,
      accuracyPct: 0,
      optionSelections: {},
    }
    // seed options map to keep stable ordering
    for (const o of (options ?? []).filter((op) => op.question_id === q.id)) {
      initialStats[q.id].optionSelections[o.id] = 0
    }
  }

  for (const a of answers ?? []) {
    const stat = initialStats[a.question_id]
    if (!stat) continue
    stat.totalResponses += 1
    if (a.correct === true) stat.correctCount += 1
    const sel = (a.selected_option_ids as unknown as string[]) || []
    for (const optId of sel) {
      if (stat.optionSelections[optId] === undefined) stat.optionSelections[optId] = 0
      stat.optionSelections[optId] += 1
    }
  }

  for (const qid of Object.keys(initialStats)) {
    const st = initialStats[qid]
    st.accuracyPct = st.totalResponses > 0 ? Math.round((st.correctCount / st.totalResponses) * 100) : 0
  }

  const perQuestion = (questions ?? []).map((q) => initialStats[q.id])

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-6">
        <h1 className="text-pretty text-2xl font-semibold">Analytics • {quiz.title}</h1>
        <p className="text-sm text-muted-foreground">Scores, completion, and question performance.</p>
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
            <CardDescription>Attempts and completion</CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            <div className="flex items-center justify-between py-1">
              <span>Assigned</span>
              <span className="font-medium">{totalAssigned}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span>Attempts started</span>
              <span className="font-medium">{totalAttempts}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span>Attempts submitted</span>
              <span className="font-medium">{submittedAttempts}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span>Completion rate</span>
              <span className="font-medium">{completionRate}%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scores</CardTitle>
            <CardDescription>Average and totals</CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            <div className="flex items-center justify-between py-1">
              <span>Average score</span>
              <span className="font-medium">{avgScore}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span>Total points possible</span>
              <span className="font-medium">{totalPossible}</span>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="text-lg font-semibold">Question performance</h2>
        <div className="space-y-4">
          {perQuestion.map((q) => (
            <Card key={q.id}>
              <CardHeader>
                <CardTitle className="text-base">{q.prompt}</CardTitle>
                <CardDescription>
                  Type: {q.kind} • Points: {q.points} • Responses: {q.totalResponses} • Accuracy: {q.accuracyPct}%
                </CardDescription>
              </CardHeader>
              {q.kind !== "short" ? (
                <CardContent className="text-sm">
                  {(options ?? [])
                    .filter((o) => o.question_id === q.id)
                    .map((o) => {
                      const count = q.optionSelections[o.id] || 0
                      return (
                        <div key={o.id} className="flex items-center justify-between py-1">
                          <div>
                            {o.label}
                            {o.is_correct ? (
                              <span className="ml-2 rounded bg-secondary px-2 py-0.5 text-xs">Correct</span>
                            ) : null}
                          </div>
                          <div className="text-muted-foreground">{count}</div>
                        </div>
                      )
                    })}
                </CardContent>
              ) : (
                <CardContent className="text-sm text-muted-foreground">
                  Short answers require manual grading; accuracy is computed from the “correct” field on answers.
                </CardContent>
              )}
            </Card>
          ))}
          {perQuestion.length === 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">No questions found</CardTitle>
                <CardDescription>Add questions to see analytics.</CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>
      </section>
    </main>
  )
}
