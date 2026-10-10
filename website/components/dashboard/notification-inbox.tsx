"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Bell, Check, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

type Notice = {
  id: string
  message: string
  isRead: boolean
  createdAt: string | null
  href: string | null
}

export function NotificationInbox() {
  const [items, setItems] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  async function load() {
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" })
      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error ?? "Unable to load notifications.")
      setItems(data.notifications)
      setError("")
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to load notifications."
      )
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    fetch("/api/notifications", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok)
          throw new Error(data.error ?? "Unable to load notifications.")
        setItems(data.notifications)
      })
      .catch((cause) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to load notifications."
        )
      )
      .finally(() => setLoading(false))
  }, [])
  async function markRead(id: string) {
    try {
      const response = await fetch(`/api/notifications/${id}`, {
        method: "PATCH",
      })
      if (!response.ok) throw new Error("Unable to mark notification read.")
      setItems((current) =>
        current.map((item) =>
          item.id === id ? { ...item, isRead: true } : item
        )
      )
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to update notification."
      )
    }
  }
  return (
    <Card className="rounded-[26px] border-[#e5ebf3] bg-white shadow-sm">
      <CardContent className="p-6 sm:p-7">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <Bell className="size-5 text-[#3176cf]" /> Notifications{" "}
            {items.filter((item) => !item.isRead).length > 0 && (
              <span className="rounded-full bg-[#e8f2ff] px-2 py-0.5 text-xs text-[#236bcf]">
                {items.filter((item) => !item.isRead).length}
              </span>
            )}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setLoading(true)
              void load()
            }}
            disabled={loading}
            aria-label="Refresh notifications"
          >
            <RefreshCw className="size-4" />
          </Button>
        </div>
        {loading && (
          <p role="status" className="text-sm text-[#7a8ca2]">
            Loading notifications…
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        {!loading && !error && items.length === 0 && (
          <p className="text-sm text-[#8191a7]">No notifications yet.</p>
        )}
        <div className="max-h-[380px] space-y-2 overflow-y-auto">
          {items.map((item) => (
            <div
              key={item.id}
              className={`rounded-2xl border p-4 ${item.isRead ? "border-[#eef1f5] bg-white" : "border-[#d8e9ff] bg-[#f5f9ff]"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  {item.href ? (
                    <Link
                      href={item.href}
                      className="text-sm leading-6 font-medium text-[#34516e] hover:text-[#236bcf] hover:underline"
                    >
                      {item.message}
                    </Link>
                  ) : (
                    <p className="text-sm leading-6 text-[#34516e]">
                      {item.message}
                    </p>
                  )}
                  {item.createdAt && (
                    <p className="mt-1 text-xs text-[#91a1b5]">
                      {new Date(item.createdAt).toLocaleString("en-LK", {
                        timeZone: "Asia/Colombo",
                      })}
                    </p>
                  )}
                </div>
                {!item.isRead && (
                  <button
                    type="button"
                    onClick={() => markRead(item.id)}
                    aria-label="Mark notification read"
                    className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-[#236bcf] hover:bg-[#e5f0ff] focus-visible:outline-2 focus-visible:outline-[#236bcf]"
                  >
                    <Check className="size-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
