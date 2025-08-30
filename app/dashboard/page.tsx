import { getSupabaseServerClient } from "@/lib/supabase/server"
import SignOutButton from "@/components/auth/sign-out-button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export default async function DashboardPage() {
  const supabase = getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Card>
        <CardHeader>
          <CardTitle>Dashboard</CardTitle>
          <CardDescription>Welcome{user?.email ? `, ${user.email}` : ""}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {user ? (
            <>
              <p className="text-sm text-muted-foreground">
                You are authenticated. Next we’ll add quizzes, attempts, and results.
              </p>
              <div className="flex items-center gap-3">
                <SignOutButton />
                <a href="/results" className="text-sm underline">
                  My results
                </a>
              </div>
            </>
          ) : (
            <p className="text-sm text-destructive">No active session.</p>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
