import { notFound } from "next/navigation"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import TakeQuizClient from "./take-client"
import { createOrGetAttempt } from "./actions"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

type Quiz = {
  id: string
  title: string
  description: string | null
  duration_seconds: number
  allow_tab_switches: number
  questions: Array<{
    id: string
    kind: "single" | "multiple" | "boolean" | "short"
    prompt: string
    points: number
    order_index: number
    options?: Array<{
      id: string
      label: string
      order_index: number
    }>
  }>
}

export default async function QuizPage({ params }: { params: { id: string } }) {
  const supabase = getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return notFound()

  // Load quiz with questions and options.
  const { data: quiz, error } = await supabase
    .from("quizzes")
    .select(`
      id, title, description, duration_seconds, allow_tab_switches,
      questions (
        id, kind, prompt, points, order_index,
        options ( id, label, order_index )
      )
    `)
    .eq("id", params.id)
    .maybeSingle()

  if (error || !quiz) return notFound()

  // Create or resume an attempt, and compute initial remaining time
  const attempt = await createOrGetAttempt(quiz.id)

  // Compute remaining seconds on the server for accuracy
  const startedAt = new Date(attempt.started_at)
  const elapsed = Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 1000))
  const remaining = Math.max(0, quiz.duration_seconds - elapsed)

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{quiz.title}</CardTitle>
          {quiz.description ? <CardDescription>{quiz.description}</CardDescription> : null}
        </CardHeader>
        <CardContent>
          <TakeQuizClient quiz={quiz as Quiz} attemptId={attempt.id} initialRemainingSec={remaining} />
        </CardContent>
      </Card>
    </main>
  )
}
