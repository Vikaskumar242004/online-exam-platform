"use client"

import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { useTransition } from "react"

export default function SignOutButton() {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()

  async function onSignOut() {
    startTransition(async () => {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.auth.signOut()
      if (error) {
        toast({ title: "Sign out failed", description: error.message, variant: "destructive" })
        return
      }
      toast({ title: "Signed out" })
      router.push("/login")
    })
  }

  return (
    <Button onClick={onSignOut} variant="secondary" disabled={isPending}>
      {isPending ? "Signing out..." : "Sign out"}
    </Button>
  )
}
