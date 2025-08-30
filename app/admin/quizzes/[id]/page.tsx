import { redirect } from "next/navigation"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import QuizEditorClient from "./quiz-editor-client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import Link from "next/link"

export default async function QuizEditorPage({ params }: { params: { id: string } }) {
  const supabase = getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: me } = await supabase.from("profiles").select("id, role").eq("id", user.id).maybeSingle()
  if (!me || me.role !== "admin") redirect("/")

  const { data: quiz } = await supabase
    .from("quizzes")
    .select(
      "id, title, description, duration_seconds, start_at, end_at, show_correct_answers, allow_tab_switches, is_public, created_by",
    )
    .eq("id", params.id)
    .maybeSingle()

  if (!quiz || quiz.created_by !== user.id) redirect("/admin")

  const { data: questions } = await supabase
    .from("questions")
    .select("id, kind, prompt, points, order_index")
    .eq("quiz_id", quiz.id)
    .order("order_index", { ascending: true })

  const { data: options } = await supabase
    .from("options")
    .select("id, question_id, label, is_correct, order_index")
    .in("question_id", questions?.length ? questions.map((q) => q.id) : ["00000000-0000-0000-0000-000000000000"])
    .order("order_index", { ascending: true })

  const { data: assignments } = await supabase
    .from("quiz_assignments")
    .select("user_id, assigned_at")
    .eq("quiz_id", quiz.id)

  // load assigned users emails for display
  let assignedUsers: Array<{ id: string; email: string | null }> = []
  if (assignments?.length) {
    const ids = assignments.map((a) => a.user_id)
    const { data: profiles } = await supabase.from("profiles").select("id,email").in("id", ids)
    assignedUsers = (profiles ?? []).map((p) => ({ id: p.id as string, email: (p.email as string) || null }))
  }

  const merged = (questions ?? []).map((q) => ({
    ...q,
    options: (options ?? []).filter((o) => o.question_id === q.id),
  }))

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-xl">{quiz.title}</CardTitle>
          <CardDescription>Edit settings, manage questions, and assign students.</CardDescription>
          <div className="mt-2 text-sm">
            <Link href={`/admin/quizzes/${quiz.id}/analytics`} className="underline">
              View analytics
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <QuizEditorClient quiz={quiz} questions={merged} assignedUsers={assignedUsers} />
        </CardContent>
      </Card>
    </main>
  )
}
