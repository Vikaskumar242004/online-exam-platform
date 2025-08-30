import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"

export async function POST(req: Request) {
  try {
    const { attemptId, questionId, points_awarded, correct } = await req.json()

    if (!attemptId || !questionId || typeof points_awarded !== "number") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Verify admin and ownership of quiz for this attempt
    const { data: attempt, error: aErr } = await supabase
      .from("attempts")
      .select("id, quiz_id")
      .eq("id", attemptId)
      .maybeSingle()
    if (aErr || !attempt) return NextResponse.json({ error: "Attempt not found" }, { status: 404 })

    const { data: me } = await supabase.from("profiles").select("id, role").eq("id", user.id).maybeSingle()
    if (!me || me.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { data: quiz } = await supabase
      .from("quizzes")
      .select("id, created_by")
      .eq("id", attempt.quiz_id)
      .maybeSingle()
    if (!quiz || quiz.created_by !== user.id) return NextResponse.json({ error: "Not owner" }, { status: 403 })

    // Cap awarded points at question points
    const { data: question } = await supabase
      .from("questions")
      .select("id, points, kind")
      .eq("id", questionId)
      .maybeSingle()
    if (!question) return NextResponse.json({ error: "Question not found" }, { status: 404 })
    const capped = Math.max(0, Math.min(Number(points_awarded), Number(question.points)))

    // Update answer
    const { error: upErr } = await supabase
      .from("answers")
      .update({
        points_awarded: capped,
        correct: typeof correct === "boolean" ? correct : null,
      })
      .eq("attempt_id", attemptId)
      .eq("question_id", questionId)
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 })

    // Recompute total score
    const { data: sumRows } = await supabase.from("answers").select("points_awarded").eq("attempt_id", attemptId)

    const total = (sumRows ?? []).reduce((acc, r: any) => acc + Number(r.points_awarded || 0), 0)

    const { error: aUpErr } = await supabase.from("attempts").update({ score: total }).eq("id", attemptId)
    if (aUpErr) return NextResponse.json({ error: aUpErr.message }, { status: 400 })

    return NextResponse.json({ ok: true, score: total })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 })
  }
}
