"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"

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
    options?: Array<{ id: string; label: string; order_index: number }>
  }>
}

type AnswerDraft = {
  [questionId: string]:
    | { type: "single" | "boolean"; value: string | null }
    | { type: "multiple"; values: Set<string> }
    | { type: "short"; text: string }
}

export default function TakeQuizClient({
  quiz,
  attemptId,
  initialRemainingSec,
}: {
  quiz: Quiz
  attemptId: string
  initialRemainingSec: number
}) {
  const { toast } = useToast()
  const [remaining, setRemaining] = useState(initialRemainingSec)
  const [answers, setAnswers] = useState<AnswerDraft>({})
  const [isPending, startTransition] = useTransition()
  const tabSwitches = useRef(0)

  // Timer countdown
  useEffect(() => {
    if (remaining <= 0) return
    const id = setInterval(() => setRemaining((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [remaining])

  // Anti-cheat monitoring
  useEffect(() => {
    async function log(kind: string, meta?: any) {
      try {
        const res = await fetch("/api/exam/log-anti-cheat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attemptId, kind, meta: meta ?? {} }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || "Log failed")
        if (data?.limitExceeded) {
          toast({ title: "Exam auto-submitting", description: "Tab switch limit exceeded." })
          handleSubmit(true)
        }
      } catch {
        // Best-effort logging; continue
      }
    }

    function onBlur() {
      tabSwitches.current += 1
      log("tab_blur")
    }
    function onVisibility() {
      if (document.visibilityState === "hidden") {
        tabSwitches.current += 1
        log("visibility_hidden")
      }
    }
    function onCopy(e: ClipboardEvent) {
      e.preventDefault()
      log("copy")
    }
    function onPaste(e: ClipboardEvent) {
      e.preventDefault()
      log("paste")
    }
    function onContextMenu(e: MouseEvent) {
      e.preventDefault()
      log("contextmenu")
    }

    window.addEventListener("blur", onBlur)
    document.addEventListener("visibilitychange", onVisibility)
    document.addEventListener("copy", onCopy as any)
    document.addEventListener("paste", onPaste as any)
    document.addEventListener("contextmenu", onContextMenu)

    return () => {
      window.removeEventListener("blur", onBlur)
      document.removeEventListener("visibilitychange", onVisibility)
      document.removeEventListener("copy", onCopy as any)
      document.removeEventListener("paste", onPaste as any)
      document.removeEventListener("contextmenu", onContextMenu)
    }
  }, [attemptId, toast])

  // Auto-submit when the timer reaches zero
  useEffect(() => {
    if (remaining === 0) {
      handleSubmit(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining])

  const displayTime = useMemo(() => {
    const m = Math.floor(remaining / 60)
    const s = remaining % 60
    return `${m}:${s.toString().padStart(2, "0")}`
  }, [remaining])

  function toggleMulti(questionId: string, optionId: string) {
    setAnswers((prev) => {
      const current = prev[questionId]
      const set = current && current.type === "multiple" ? new Set(current.values) : new Set<string>()
      if (set.has(optionId)) set.delete(optionId)
      else set.add(optionId)
      return { ...prev, [questionId]: { type: "multiple", values: set } }
    })
  }

  function setSingle(questionId: string, optionId: string | null) {
    setAnswers((prev) => ({ ...prev, [questionId]: { type: "single", value: optionId } }))
  }

  function setBoolean(questionId: string, optionId: string | null) {
    setAnswers((prev) => ({ ...prev, [questionId]: { type: "boolean", value: optionId } }))
  }

  function setShort(questionId: string, text: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: { type: "short", text } }))
  }

  function serializeForSubmit() {
    return quiz.questions.map((q) => {
      const a = answers[q.id]
      if (!a) return { question_id: q.id, selected_option_ids: [], short_text: null }
      switch (a.type) {
        case "single":
        case "boolean":
          return { question_id: q.id, selected_option_ids: a.value ? [a.value] : [], short_text: null }
        case "multiple":
          return { question_id: q.id, selected_option_ids: Array.from(a.values), short_text: null }
        case "short":
          return { question_id: q.id, selected_option_ids: [], short_text: a.text }
      }
    })
  }

  function handleSubmit(auto = false) {
    if (!auto && remaining > 0) {
      const confirmOk = window.confirm("Submit your answers now?")
      if (!confirmOk) return
    }
    startTransition(async () => {
      try {
        const res = await fetch("/api/exam/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attemptId,
            answers: serializeForSubmit(),
            auto, // inform server for auto_submitted status
          }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data?.error || "Failed to submit attempt")
        }
        toast({
          title: auto ? "Submitted automatically" : "Attempt submitted",
          description: auto ? "Policy/timer triggered auto-submit." : "Your submission has been saved.",
        })
        window.location.href = "/dashboard"
      } catch (e: any) {
        toast({ title: "Submit failed", description: e?.message || "Please try again.", variant: "destructive" })
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Avoid switching tabs or copying content. Violations are logged.
          {typeof quiz.allow_tab_switches === "number" ? (
            <span className="ml-1">(Allowed tab switches: {quiz.allow_tab_switches})</span>
          ) : null}
        </div>
        <div className="rounded-md border px-3 py-1 text-sm font-medium">Time left: {displayTime}</div>
      </div>

      <div className="space-y-6">
        {quiz.questions
          .slice()
          .sort((a, b) => a.order_index - b.order_index)
          .map((q, idx) => (
            <Card key={q.id}>
              <CardContent className="space-y-2 pt-6">
                <div className="font-medium">
                  {idx + 1}. {q.prompt}
                </div>
                {q.kind === "short" ? (
                  <div className="space-y-1">
                    <Label htmlFor={`q-${q.id}`}>Your answer</Label>
                    <Textarea
                      id={`q-${q.id}`}
                      onChange={(e) => setShort(q.id, e.target.value)}
                      placeholder="Type your response"
                    />
                  </div>
                ) : null}
                {q.kind === "single" && q.options ? (
                  <div className="space-y-2">
                    {q.options
                      .sort((a, b) => a.order_index - b.order_index)
                      .map((opt) => (
                        <label key={opt.id} className="flex items-center gap-2">
                          <Input type="radio" name={`q-${q.id}`} onChange={() => setSingle(q.id, opt.id)} />
                          <span>{opt.label}</span>
                        </label>
                      ))}
                  </div>
                ) : null}
                {q.kind === "boolean" && q.options ? (
                  <div className="space-y-2">
                    {q.options
                      .sort((a, b) => a.order_index - b.order_index)
                      .map((opt) => (
                        <label key={opt.id} className="flex items-center gap-2">
                          <Input type="radio" name={`q-${q.id}`} onChange={() => setBoolean(q.id, opt.id)} />
                          <span>{opt.label}</span>
                        </label>
                      ))}
                  </div>
                ) : null}
                {q.kind === "multiple" && q.options ? (
                  <div className="space-y-2">
                    {q.options
                      .sort((a, b) => a.order_index - b.order_index)
                      .map((opt) => (
                        <label key={opt.id} className="flex items-center gap-2">
                          <Input type="checkbox" onChange={() => toggleMulti(q.id, opt.id)} />
                          <span>{opt.label}</span>
                        </label>
                      ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
      </div>

      <div className="flex items-center justify-end gap-3">
        <Button variant="secondary" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          Back to top
        </Button>
        <Button onClick={() => handleSubmit(false)} disabled={isPending || remaining <= 0}>
          {isPending ? "Submitting..." : "Submit"}
        </Button>
      </div>
    </div>
  )
}
