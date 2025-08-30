import Link from "next/link"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

type Attempt = {
  id: string
  quiz_id: string
  status: "in_progress" | "submitted" | "auto_submitted"
  score: number
  started_at: string
  submitted_at: string | null
}

export default async function ResultsIndexPage() {
  const supabase = getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: attempts, error } = await supabase
    .from("attempts")
    .select("id, quiz_id, status, score, started_at, submitted_at")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })

  if (error) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <p className="text-destructive">Failed to load results: {error.message}</p>
      </main>
    )
  }

  const quizIds = Array.from(new Set((attempts ?? []).map((a) => a.quiz_id)))
  let quizTitles = new Map<string, string>()
  if (quizIds.length) {
    const { data: quizzes } = await supabase.from("quizzes").select("id,title").in("id", quizIds)
    if (quizzes) {
      quizTitles = new Map(quizzes.map((q) => [q.id as string, q.title as string]))
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="mb-6">
        <h1 className="text-pretty text-2xl font-semibold">My Results</h1>
        <p className="text-sm text-muted-foreground">Review your exam attempts and scores.</p>
      </div>

      <div className="space-y-4">
        {(attempts ?? []).length ? (
          attempts!.map((a: Attempt) => {
            const title = quizTitles.get(a.quiz_id) || "Quiz"
            const submitted = a.submitted_at ? new Date(a.submitted_at).toLocaleString() : "—"
            const started = new Date(a.started_at).toLocaleString()
            return (
              <Card key={a.id}>
                <CardHeader>
                  <CardTitle className="text-base">{title}</CardTitle>
                  <CardDescription>
                    Started {started} • Status: {a.status.replace("_", " ")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">Submitted: {submitted}</div>
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-medium">Score: {a.score ?? 0}</div>
                    <Button asChild variant="secondary">
                      <Link href={`/results/${a.id}`}>View</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">No results yet</CardTitle>
              <CardDescription>Complete a quiz to see your results here.</CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </main>
  )
}
