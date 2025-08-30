"use server"

import { getSupabaseServerClient } from "@/lib/supabase/server"

export async function createOrGetAttempt(quizId: string) {
  const supabase = getSupabaseServerClient()
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser()
  if (userErr || !user) throw new Error("Not authenticated")

  // Try to find an in-progress attempt
  const { data: existing, error: findErr } = await supabase
    .from("attempts")
    .select("*")
    .eq("quiz_id", quizId)
    .eq("user_id", user.id)
    .eq("status", "in_progress")
    .maybeSingle()

  if (findErr && findErr.code !== "PGRST116") throw findErr
  if (existing) return existing

  // Create a new attempt
  const { data: created, error: insertErr } = await supabase
    .from("attempts")
    .insert({ quiz_id: quizId, user_id: user.id })
    .select("*")
  if (insertErr) throw insertErr
  return created?.[0]
}
