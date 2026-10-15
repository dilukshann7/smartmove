"use client"

import { Fragment, useEffect, useState, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"
import { apiFetch, onAuthChange } from "@/lib/client-auth"

export function PassengerGate({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [userId, setUserId] = useState<number | null>(null)
  const [error, setError] = useState("")
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let controller: AbortController
    const check = async () => {
      controller?.abort()
      controller = new AbortController()
      const signal = controller.signal
      setUserId(null)
      setError("")
      try {
        const response = await apiFetch("/api/auth/me", {
          cache: "no-store",
          signal,
        })
        if (signal.aborted) return
        if (response.status === 401)
          return router.replace(`/login?next=${encodeURIComponent(pathname)}`)
        if (!response.ok)
          throw new Error("Unable to check your sign-in. Please try again.")
        const data = await response.json()
        if (signal.aborted) return
        if (!data.passenger)
          return router.replace(`/login?next=${encodeURIComponent(pathname)}`)
        setUserId(data.passenger.userId)
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
  }, [router, pathname, retry])
  if (error)
    return (
      <div className="p-8">
        <p role="alert">{error}</p>
        <button className="mt-4 underline" onClick={() => setRetry(retry + 1)}>
          Try again
        </button>
      </div>
    )
  if (!userId)
    return (
      <p role="status" className="p-8">
        Checking sign-in…
      </p>
    )
  return <Fragment key={userId}>{children}</Fragment>
}
