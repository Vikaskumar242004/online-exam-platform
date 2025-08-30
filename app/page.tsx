import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export default function HomePage() {
  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <section className="space-y-6 text-center">
        <h1 className="text-pretty text-3xl font-semibold tracking-tight">Online Exam Platform</h1>
        <p className="text-muted-foreground">
          Students take timed quizzes securely. Admins create tests, track results, and view analytics.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button asChild>
            <Link href="/auth/login">Student/Admin Login</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/auth/sign-up">Create an account</Link>
          </Button>
        </div>
      </section>

      <section className="mt-12">
        <Card>
          <CardHeader>
            <CardTitle>Why this matters</CardTitle>
            <CardDescription>Built for ed-tech startups</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            - Timers and anti-cheat (no tab switching) for integrity
            <br />- Admin analytics for results and question performance
            <br />- Scalable auth and storage powered by Supabase
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
