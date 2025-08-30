"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { addOption, addQuestion, assignByEmail, removeAssignment, updateQuiz } from "./actions"

type Quiz = {
  id: string
  title: string
  description: string | null
  duration_seconds: number
  start_at: string | null
  end_at: string | null
  show_correct_answers: "never" | "after_due" | "immediate"
  allow_tab_switches: number
  is_public: boolean
}

type Question = {
  id: string
  kind: "single" | "multiple" | "boolean" | "short"
  prompt: string
  points: number
  order_index: number
  options?: Array<{ id: string; label: string; is_correct: boolean; order_index: number }>
}

export default function QuizEditorClient({
  quiz,
  questions,
  assignedUsers,
}: {
  quiz: Quiz
  questions: Question[]
  assignedUsers: Array<{ id: string; email: string | null }>
}) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()

  // Settings local state
  const [title, setTitle] = useState(quiz.title)
  const [description, setDescription] = useState(quiz.description ?? "")
  const [duration, setDuration] = useState<number>(quiz.duration_seconds)
  const [startAt, setStartAt] = useState<string>(quiz.start_at ? toLocalInput(quiz.start_at) : "")
  const [endAt, setEndAt] = useState<string>(quiz.end_at ? toLocalInput(quiz.end_at) : "")
  const [policy, setPolicy] = useState<Quiz["show_correct_answers"]>(quiz.show_correct_answers)
  const [allowSwitches, setAllowSwitches] = useState<number>(quiz.allow_tab_switches)
  const [isPublic, setIsPublic] = useState<string>(quiz.is_public ? "true" : "false")

  const [newQPrompt, setNewQPrompt] = useState("")
  const [newQKind, setNewQKind] = useState<Question["kind"]>("single")
  const [newQPoints, setNewQPoints] = useState<number>(1)

  const [assignEmail, setAssignEmail] = useState("")

  function toIso(dt: string) {
    return dt ? new Date(dt).toISOString() : null
  }
  function toLocalInput(iso: string) {
    const d = new Date(iso)
    const tzOffset = d.getTimezoneOffset() * 60000
    return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16)
  }

  function onSaveSettings() {
    startTransition(async () => {
      try {
        await updateQuiz(quiz.id, {
          title: title.trim(),
          description: description.trim() || null,
          duration_seconds: Number(duration),
          start_at: toIso(startAt),
          end_at: toIso(endAt),
          show_correct_answers: policy,
          allow_tab_switches: Number(allowSwitches),
          is_public: isPublic === "true",
        })
        toast({ title: "Settings saved" })
      } catch (e: any) {
        toast({ title: "Save failed", description: e?.message || "Please try again.", variant: "destructive" })
      }
    })
  }

  function onAddQuestion() {
    startTransition(async () => {
      try {
        if (!newQPrompt.trim()) throw new Error("Prompt required")
        await addQuestion(quiz.id, newQKind, newQPrompt.trim(), Number(newQPoints))
        toast({ title: "Question added" })
        window.location.reload()
      } catch (e: any) {
        toast({ title: "Add question failed", description: e?.message || "Please try again.", variant: "destructive" })
      }
    })
  }

  function onAddOption(questionId: string, form: HTMLFormElement) {
    startTransition(async () => {
      try {
        const formData = new FormData(form)
        const label = String(formData.get("label") || "").trim()
        const correct = String(formData.get("correct") || "false") === "true"
        if (!label) throw new Error("Option label required")
        await addOption(questionId, label, correct)
        toast({ title: "Option added" })
        window.location.reload()
      } catch (e: any) {
        toast({ title: "Add option failed", description: e?.message || "Please try again.", variant: "destructive" })
      }
    })
  }

  function onAssign() {
    startTransition(async () => {
      try {
        if (!assignEmail.trim()) throw new Error("Email required")
        await assignByEmail(quiz.id, assignEmail.trim())
        toast({ title: "Assigned" })
        window.location.reload()
      } catch (e: any) {
        toast({ title: "Assign failed", description: e?.message || "Please try again.", variant: "destructive" })
      }
    })
  }

  function onRemoveAssignment(userId: string) {
    startTransition(async () => {
      try {
        await removeAssignment(quiz.id, userId)
        toast({ title: "Removed assignment" })
        window.location.reload()
      } catch (e: any) {
        toast({ title: "Remove failed", description: e?.message || "Please try again.", variant: "destructive" })
      }
    })
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Settings</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Show answers</Label>
            <Select value={policy} onValueChange={(v: any) => setPolicy(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="never">Never</SelectItem>
                <SelectItem value="after_due">After due date</SelectItem>
                <SelectItem value="immediate">Immediate</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="duration">Duration (seconds)</Label>
            <Input id="duration" type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="allow">Allowed tab switches</Label>
            <Input
              id="allow"
              type="number"
              value={allowSwitches}
              onChange={(e) => setAllowSwitches(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="start">Start at</Label>
            <Input id="start" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="end">End at</Label>
            <Input id="end" type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Visibility</Label>
            <Select value={isPublic} onValueChange={(v) => setIsPublic(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="false">Assigned only</SelectItem>
                <SelectItem value="true">Public</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={onSaveSettings} disabled={isPending}>
          {isPending ? "Saving..." : "Save settings"}
        </Button>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Questions</h2>
        <Card>
          <CardContent className="space-y-3 pt-6">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="prompt">Prompt</Label>
                <Input
                  id="prompt"
                  value={newQPrompt}
                  onChange={(e) => setNewQPrompt(e.target.value)}
                  placeholder="What is 2 + 2?"
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={newQKind} onValueChange={(v: any) => setNewQKind(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single</SelectItem>
                    <SelectItem value="multiple">Multiple</SelectItem>
                    <SelectItem value="boolean">True/False</SelectItem>
                    <SelectItem value="short">Short Answer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="points">Points</Label>
                <Input
                  id="points"
                  type="number"
                  value={newQPoints}
                  onChange={(e) => setNewQPoints(Number(e.target.value))}
                />
              </div>
            </div>
            <Button onClick={onAddQuestion} disabled={isPending}>
              {isPending ? "Adding..." : "Add question"}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {questions.map((q, idx) => (
            <Card key={q.id}>
              <CardContent className="space-y-3 pt-6">
                <div className="text-sm text-muted-foreground">
                  #{idx + 1} • {q.kind} • {q.points} pts
                </div>
                <div className="font-medium">{q.prompt}</div>
                {q.kind !== "short" && (
                  <div className="space-y-2">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        onAddOption(q.id, e.currentTarget)
                      }}
                      className="flex items-end gap-2"
                    >
                      <div className="flex-1 space-y-1">
                        <Label htmlFor={`opt-${q.id}`}>Option label</Label>
                        <Input id={`opt-${q.id}`} name="label" placeholder="e.g., 4" />
                      </div>
                      <div className="space-y-1">
                        <Label>Correct?</Label>
                        <Select name="correct" defaultValue="false">
                          <SelectTrigger className="w-[130px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="false">No</SelectItem>
                            <SelectItem value="true">Yes</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button type="submit">Add option</Button>
                    </form>
                    <ul className="text-sm">
                      {(q.options ?? []).map((o) => (
                        <li key={o.id}>
                          {o.label}{" "}
                          {o.is_correct ? (
                            <span className="ml-2 rounded bg-secondary px-2 py-0.5 text-xs">Correct</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {q.kind === "short" && (
                  <div className="text-sm text-muted-foreground">Short answers require manual grading.</div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Assignments</h2>
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <Label htmlFor="email">Assign by email</Label>
            <Input
              id="email"
              value={assignEmail}
              onChange={(e) => setAssignEmail(e.target.value)}
              placeholder="student@example.com"
            />
          </div>
          <Button onClick={onAssign} disabled={isPending}>
            {isPending ? "Assigning..." : "Assign"}
          </Button>
        </div>
        <ul className="text-sm">
          {assignedUsers.map((u) => (
            <li key={u.id} className="flex items-center justify-between py-1">
              <span>{u.email || u.id}</span>
              <Button variant="secondary" onClick={() => onRemoveAssignment(u.id)} disabled={isPending}>
                Remove
              </Button>
            </li>
          ))}
          {assignedUsers.length === 0 && <li className="text-muted-foreground">No assignments yet.</li>}
        </ul>
      </section>
    </div>
  )
}
