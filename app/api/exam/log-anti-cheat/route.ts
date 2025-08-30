import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { attemptId, kind, meta } = body || {}
    if (!attemptId || !kind) return NextResponse.json({ error: "Missing fields" }, { status: 400 })

    const supabase = getSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Insert event
    const { error: insErr } = await supabase
      .from("anti_cheat_events")
      .insert({ attempt_id: attemptId, kind, meta: meta ?? {} })
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 })

    let limitExceeded = false

    if (kind === "tab_blur" || kind === "visibility_hidden") {
      // Load attempt + quiz to know allowed switches
      const { data: attempt, error: aErr } = await supabase
        .from("attempts")
        .select("id, tab_switch_count, quiz_id")
        .eq("id", attemptId)
        .eq("user_id", user.id)
        .maybeSingle()
      if (aErr || !attempt) return NextResponse.json({ error: "Attempt not found" }, { status: 404 })

      // Increment counter
      const nextCount = (attempt.tab_switch_count ?? 0) + 1
      const { error: upErr } = await supabase
        .from("attempts")
        .update({ tab_switch_count: nextCount })
        .eq("id", attemptId)
      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 })

      // Fetch allowed threshold
      const { data: quiz, error: qErr } = await supabase
        .from("quizzes")
        .select("allow_tab_switches")
        .eq("id", attempt.quiz_id)
        .maybeSingle()
      if (!qErr && quiz) {
        limitExceeded = nextCount > (quiz.allow_tab_switches ?? 0)
      }
    }

    return NextResponse.json({ ok: true, limitExceeded })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 })
  }
}
