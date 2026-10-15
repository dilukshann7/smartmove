"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { apiFetch, onAuthChange } from "@/lib/client-auth"
import { AdminPage } from "@/components/admin/admin-page"

export function AdminGate() {
  const router = useRouter()
  const [admin, setAdmin] = useState<{ email: string } | null>(null)
  const [error, setError] = useState("")
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let controller: AbortController
    const check = async () => {
      controller?.abort()
      controller = new AbortController()
      const signal = controller.signal
      setAdmin(null)
      setError("")
      try {
        const response = await apiFetch("/api/auth/me", {
          cache: "no-store",
          signal,
        })
        if (signal.aborted) return
        if (response.status === 401)
          return router.replace("/login?next=%2Fadmin")
        if (!response.ok)
          throw new Error("Unable to check your sign-in. Please try again.")
        const data = await response.json()
        if (signal.aborted) return
        if (!data.admin) return router.replace("/login?next=%2Fadmin")
        setAdmin(data.admin)
      } catch (cause) {
        if (!signal.aborted)
          setError(
            cause instanceof Error ? cause.message : "Unable to check sign-in."
          )
      }
    }
    void check()
    const unsubscribe = onAuthChange(() => {
      void check()
    })
    return () => {
      controller?.abort()
      unsubscribe()
    }
  }, [router, retry])
  if (error)
    return (
      <div className="p-8">
        <p role="alert">{error}</p>
        <button className="mt-4 underline" onClick={() => setRetry(retry + 1)}>
          Try again
        </button>
      </div>
    )
  if (!admin)
    return (
      <p role="status" className="p-8">
        Checking sign-in…
      </p>
    )
  return <AdminPage email={admin.email} />
}
