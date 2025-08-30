import { redirect } from "next/navigation"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { createQuiz } from "./actions"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default async function NewQuizPage() {
  const supabase = getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (!me || me.role !== "admin") redirect("/dashboard")

  async function action(formData: FormData) {
    "use server"
    const id = await createQuiz(formData)
    return redirect(`/admin/quizzes/${id}`)
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Create Quiz</CardTitle>
          <CardDescription>Define quiz basics. You can add questions next.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={action} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" required placeholder="Midterm Exam" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" placeholder="Topics covered..." />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="duration_seconds">Duration (seconds)</Label>
                <Input id="duration_seconds" name="duration_seconds" type="number" defaultValue={1800} min={30} />
              </div>
              <div className="space-y-2">
                <Label>Show correct answers</Label>
                <Select name="show_correct_answers" defaultValue="after_due">
                  <SelectTrigger>
                    <SelectValue placeholder="Policy" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">Never</SelectItem>
                    <SelectItem value="after_due">After due date</SelectItem>
                    <SelectItem value="immediate">Immediate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="start_at">Start at</Label>
                <Input id="start_at" name="start_at" type="datetime-local" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_at">End at</Label>
                <Input id="end_at" name="end_at" type="datetime-local" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="allow_tab_switches">Allowed tab switches</Label>
                <Input id="allow_tab_switches" name="allow_tab_switches" type="number" defaultValue={1} min={0} />
              </div>
              <div className="space-y-2">
                <Label>Visibility</Label>
                <Select name="is_public" defaultValue="false">
                  <SelectTrigger>
                    <SelectValue placeholder="Visibility" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="false">Assigned only</SelectItem>
                    <SelectItem value="true">Public</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" className="w-full">
              Create
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
