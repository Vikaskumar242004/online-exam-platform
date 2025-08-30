"use server"

import { revalidatePath } from "next/cache"
import { getSupabaseServerClient } from "@/lib/supabase/server"

export async function createQuiz(formData: FormData) {
  const supabase = getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (!me || me.role !== "admin") throw new Error("Forbidden")

  const title = String(formData.get("title") || "").trim()
  const description = String(formData.get("description") || "").trim() || null
  const duration = Number(formData.get("duration_seconds") || 600)
  const start_at = String(formData.get("start_at") || "")
  const end_at = String(formData.get("end_at") || "")
  const show_correct_answers = String(formData.get("show_correct_answers") || "after_due") as any
  const is_public = String(formData.get("is_public") || "false") === "true"
  const allow_tab_switches = Number(formData.get("allow_tab_switches") || 1)

  if (!title || !Number.isFinite(duration) || duration <= 0) {
    throw new Error("Invalid quiz data")
  }

  const startIso = start_at ? new Date(start_at).toISOString() : null
  const endIso = end_at ? new Date(end_at).toISOString() : null

  const { data, error } = await supabase
    .from("quizzes")
    .insert({
      title,
      description,
      duration_seconds: duration,
      start_at: startIso,
      end_at: endIso,
      show_correct_answers,
      is_public,
      allow_tab_switches,
      created_by: user.id,
    })
    .select("id")

  if (error) throw new Error(error.message)
  const id = data?.[0]?.id as string
  revalidatePath("/admin")
  return id
}
