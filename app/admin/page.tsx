import Link from "next/link"
import { redirect } from "next/navigation"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default async function AdminHome() {
  const supabase = getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: me } = await supabase.from("profiles").select("id, role").eq("id", user.id).maybeSingle()
  if (!me || me.role !== "admin") redirect("/")

  const { data: quizzes, error } = await supabase
    .from("quizzes")
    .select("id, title, description, duration_seconds, start_at, end_at, updated_at")
    .eq("created_by", user.id)
    .order("updated_at", { ascending: false })

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-pretty text-2xl font-semibold">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">Create quizzes, add questions, and assign to students.</p>
        </div>
        <Button asChild>
          <Link href="/admin/quizzes/new">New Quiz</Link>
        </Button>
      </div>

      {error ? (
        <p className="text-destructive">Failed to load quizzes: {error.message}</p>
      ) : (
        <div className="space-y-4">
          {(quizzes ?? []).map((q) => (
            <Card key={q.id}>
              <CardHeader>
                <CardTitle className="text-base">{q.title}</CardTitle>
                {q.description ? <CardDescription>{q.description}</CardDescription> : null}
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Duration: {q.duration_seconds}s • Updated: {new Date(q.updated_at as any).toLocaleString()}
                </div>
                <Button asChild variant="secondary">
                  <Link href={`/admin/quizzes/${q.id}`}>Edit</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
          {(!quizzes || quizzes.length === 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">No quizzes yet</CardTitle>
                <CardDescription>Create your first quiz to get started.</CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>
      )}
    </main>
  )
}
