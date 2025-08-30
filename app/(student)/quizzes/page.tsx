import Link from "next/link"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default async function QuizzesPage() {
  const supabase = getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    // Protected by middleware, but double-check
    return null
  }

  const nowIso = new Date().toISOString()
  // RLS ensures students see only assigned or public quizzes
  const { data: quizzes, error } = await supabase
    .from("quizzes")
    .select("id,title,description,duration_seconds,start_at,end_at")
    .lte("start_at", nowIso)
    .or(`end_at.is.null,end_at.gte.${nowIso}`)
    .order("start_at", { ascending: false })

  if (error) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <p className="text-destructive">Failed to load quizzes: {error.message}</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="mb-6">
        <h1 className="text-pretty text-2xl font-semibold">Available Quizzes</h1>
        <p className="text-muted-foreground text-sm">Choose a quiz to begin your attempt.</p>
      </div>

      <div className="space-y-4">
        {quizzes?.length ? (
          quizzes.map((q) => (
            <Card key={q.id}>
              <CardHeader>
                <CardTitle className="text-base">{q.title}</CardTitle>
                {q.description ? <CardDescription>{q.description}</CardDescription> : null}
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">Duration: {q.duration_seconds} sec</div>
                <Button asChild>
                  <Link href={`/quizzes/${q.id}`}>Start</Link>
                </Button>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">No quizzes available</CardTitle>
              <CardDescription>Check back later or contact your instructor.</CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </main>
  )
}
