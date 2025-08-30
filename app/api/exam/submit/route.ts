import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"

type QuestionRow = {
  id: string
  kind: "single" | "multiple" | "boolean" | "short"
  points: number
}
type OptionRow = {
  id: string
  question_id: string
  is_correct: boolean
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { attemptId, answers, auto } = body || {}
    if (!attemptId || !Array.isArray(answers)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Load attempt with timing data
    const { data: attempt, error: attErr } = await supabase
      .from("attempts")
      .select("id, quiz_id, status, started_at, user_id")
      .eq("id", attemptId)
      .eq("user_id", user.id)
      .eq("status", "in_progress")
      .maybeSingle()
    if (attErr || !attempt) {
      return NextResponse.json({ error: "Attempt not found or already submitted" }, { status: 400 })
    }

    // Load quiz timing/policy
    const { data: quiz, error: qErr } = await supabase
      .from("quizzes")
      .select("id, duration_seconds, end_at")
      .eq("id", attempt.quiz_id)
      .maybeSingle()
    if (qErr || !quiz) return NextResponse.json({ error: "Quiz not found" }, { status: 404 })

    // Enforce due date and duration
    const now = Date.now()
    const startedAt = new Date(attempt.started_at as any).getTime()
    const overDuration = now - startedAt > (quiz.duration_seconds ?? 0) * 1000
    const pastDue = quiz.end_at ? now > new Date(quiz.end_at as any).getTime() : false
    const autoFlag = Boolean(auto || overDuration || pastDue)

    // Fetch questions/options for grading
    const { data: questions } = await supabase.from("questions").select("id, kind, points").eq("quiz_id", quiz.id)

    const qMap = new Map<string, QuestionRow>()
    for (const q of questions ?? []) qMap.set(q.id, q as QuestionRow)

    const { data: options } = await supabase
      .from("options")
      .select("id, question_id, is_correct")
      .in("question_id", questions?.length ? questions.map((q) => q.id) : ["00000000-0000-0000-0000-000000000000"])

    const optByQuestion = new Map<string, OptionRow[]>()
    for (const o of options ?? []) {
      const list = optByQuestion.get(o.question_id) ?? []
      list.push(o as OptionRow)
      optByQuestion.set(o.question_id, list)
    }

    // Normalize and grade
    type InAnswer = { question_id: string; selected_option_ids?: string[]; short_text?: string | null }
    let totalScore = 0

    for (const incoming of answers as InAnswer[]) {
      const q = qMap.get(incoming.question_id)
      if (!q) continue

      const selected = new Set(
        Array.isArray(incoming.selected_option_ids) ? incoming.selected_option_ids.filter(Boolean) : [],
      )

      let correct: boolean | null = null
      let awarded = 0

      if (q.kind === "short") {
        correct = null // manual grading later
        awarded = 0
      } else {
        // Option-based grading
        const allOpts = optByQuestion.get(q.id) ?? []
        const correctIds = new Set(allOpts.filter((o) => o.is_correct).map((o) => o.id))
        // Only count selected that exist for this question
        const filteredSelected = new Set(Array.from(selected).filter((id) => allOpts.some((o) => o.id === id)))

        if (q.kind === "single" || q.kind === "boolean") {
          correct =
            filteredSelected.size === 1 && correctIds.size === 1 && filteredSelected.has(Array.from(correctIds)[0])
          awarded = correct ? Number(q.points) : 0
        } else if (q.kind === "multiple") {
          // exact match required; no partial credit
          if (filteredSelected.size === correctIds.size) {
            let allMatch = true
            for (const id of filteredSelected) if (!correctIds.has(id)) allMatch = false
            correct = allMatch
          } else {
            correct = false
          }
          awarded = correct ? Number(q.points) : 0
        }
      }

      totalScore += awarded

      // Upsert graded answer
      const upsertPayload = {
        attempt_id: attemptId,
        question_id: q.id,
        selected_option_ids: q.kind === "short" ? [] : Array.from(selected),
        short_text: q.kind === "short" ? (typeof incoming.short_text === "string" ? incoming.short_text : null) : null,
        correct,
        points_awarded: awarded,
      }
      const { error: upErr } = await supabase.from("answers").upsert(upsertPayload, {
        onConflict: "attempt_id,question_id",
      })
      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 })
    }

    // Mark attempt submitted and store score
    const newStatus = autoFlag ? "auto_submitted" : "submitted"
    const { error: subErr } = await supabase
      .from("attempts")
      .update({ status: newStatus, submitted_at: new Date().toISOString(), score: totalScore })
      .eq("id", attemptId)
    if (subErr) return NextResponse.json({ error: subErr.message }, { status: 400 })

    return NextResponse.json({ ok: true, score: totalScore, status: newStatus })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 })
  }
}
