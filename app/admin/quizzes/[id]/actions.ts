"use server"

import { revalidatePath } from "next/cache"
import { getSupabaseServerClient } from "@/lib/supabase/server"

async function requireAdminOwner(supabase: ReturnType<typeof getSupabaseServerClient>, quizId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")
  const { data: me } = await supabase.from("profiles").select("id, role").eq("id", user.id).maybeSingle()
  if (!me || me.role !== "admin") throw new Error("Forbidden")
  const { data: q } = await supabase.from("quizzes").select("id, created_by").eq("id", quizId).maybeSingle()
  if (!q || q.created_by !== user.id) throw new Error("Not owner")
  return user
}

export async function updateQuiz(
  quizId: string,
  payload: {
    title: string
    description: string | null
    duration_seconds: number
    start_at: string | null
    end_at: string | null
    show_correct_answers: "never" | "after_due" | "immediate"
    allow_tab_switches: number
    is_public: boolean
  },
) {
  const supabase = getSupabaseServerClient()
  await requireAdminOwner(supabase, quizId)

  const { error } = await supabase.from("quizzes").update(payload).eq("id", quizId)
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/quizzes/${quizId}`)
}

export async function addQuestion(
  quizId: string,
  kind: "single" | "multiple" | "boolean" | "short",
  prompt: string,
  points: number,
) {
  const supabase = getSupabaseServerClient()
  await requireAdminOwner(supabase, quizId)

  const { data: countRes } = await supabase
    .from("questions")
    .select("order_index", { count: "exact", head: true })
    .eq("quiz_id", quizId)
  const order_index = (countRes as any)?.length ?? 0

  const { error } = await supabase.from("questions").insert({ quiz_id: quizId, kind, prompt, points, order_index })
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/quizzes/${quizId}`)
}

export async function addOption(questionId: string, label: string, is_correct: boolean) {
  const supabase = getSupabaseServerClient()
  // Fetch quiz by question to validate ownership
  const { data: qq, error: qe } = await supabase.from("questions").select("quiz_id").eq("id", questionId).maybeSingle()
  if (qe || !qq) throw new Error(qe?.message || "Question not found")
  await requireAdminOwner(supabase, qq.quiz_id)

  const { data: countRes } = await supabase
    .from("options")
    .select("order_index", { count: "exact", head: true })
    .eq("question_id", questionId)
  const order_index = (countRes as any)?.length ?? 0

  const { error } = await supabase.from("options").insert({ question_id: questionId, label, is_correct, order_index })
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/quizzes/${qq.quiz_id}`)
}

export async function assignByEmail(quizId: string, email: string) {
  const supabase = getSupabaseServerClient()
  await requireAdminOwner(supabase, quizId)
  const { data: profile, error } = await supabase.from("profiles").select("id,email").eq("email", email).maybeSingle()
  if (error || !profile) throw new Error(error?.message || "User not found")
  const { error: insErr } = await supabase.from("quiz_assignments").insert({ quiz_id: quizId, user_id: profile.id })
  if (insErr && insErr.code !== "23505") throw new Error(insErr.message) // ignore duplicates
  revalidatePath(`/admin/quizzes/${quizId}`)
}

export async function removeAssignment(quizId: string, userId: string) {
  const supabase = getSupabaseServerClient()
  await requireAdminOwner(supabase, quizId)
  const { error } = await supabase.from("quiz_assignments").delete().eq("quiz_id", quizId).eq("user_id", userId)
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/quizzes/${quizId}`)
}
