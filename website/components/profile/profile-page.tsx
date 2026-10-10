"use client"

import Link from "next/link"
import { useEffect, useState, type FormEvent } from "react"
import { UserRound } from "lucide-react"
import { SiteShell } from "@/components/site/site-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function ProfilePage() {
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    fetch("/api/profile", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error)
        setName(data.profile.name)
        setPhone(data.profile.phone)
        setEmail(data.profile.email)
      })
      .catch((cause) => setError(cause.message))
      .finally(() => setLoading(false))
  }, [])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError("")
    setSaved(false)
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setName(data.profile.name)
      setPhone(data.profile.phone)
      setSaved(true)
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Profile could not be saved."
      )
    } finally {
      setSaving(false)
    }
  }
  return (
    <SiteShell>
      <div className="mx-auto max-w-[720px]">
        <Badge className="mb-4 rounded-full bg-[#e7f1ff] text-[#256acb]">
          Passenger account
        </Badge>
        <h1 className="text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
          Your profile.
        </h1>
        <p className="mt-3 mb-8 text-[#6b7b91]">
          Keep your passenger details up to date.
        </p>
        {loading && (
          <p role="status" className="rounded-2xl bg-white p-8">
            Loading profile…
          </p>
        )}
        {!loading && error.includes("Sign in") && (
          <p className="rounded-2xl bg-white p-6">
            Please{" "}
            <Link
              href="/login?next=%2Fprofile"
              className="font-semibold text-[#236bcf] underline"
            >
              sign in
            </Link>{" "}
            to view your profile.
          </p>
        )}
        {!loading && !error.includes("Sign in") && (
          <Card className="rounded-[26px] border-[#e5ebf3] bg-white shadow-sm">
            <CardContent className="p-6 sm:p-8">
              <div className="mb-7 flex size-12 items-center justify-center rounded-2xl bg-[#e7f1ff] text-[#236bcf]">
                <UserRound className="size-6" />
              </div>
              <form onSubmit={submit} className="space-y-5">
                <div>
                  <Label htmlFor="profile-name">Full name</Label>
                  <Input
                    id="profile-name"
                    required
                    minLength={2}
                    maxLength={100}
                    autoComplete="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="mt-2 h-12 rounded-xl"
                  />
                </div>
                <div>
                  <Label htmlFor="profile-phone">Phone number</Label>
                  <Input
                    id="profile-phone"
                    required
                    maxLength={15}
                    type="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className="mt-2 h-12 rounded-xl"
                  />
                </div>
                <div>
                  <Label htmlFor="profile-email">Email address</Label>
                  <Input
                    id="profile-email"
                    type="email"
                    value={email}
                    readOnly
                    aria-describedby="email-note"
                    className="mt-2 h-12 rounded-xl bg-[#f6f8fb] text-[#708096]"
                  />
                  <p id="email-note" className="mt-2 text-xs text-[#8d9bad]">
                    Email changes are not available in this phase.
                  </p>
                </div>
                {error && (
                  <p
                    role="alert"
                    className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
                  >
                    {error}
                  </p>
                )}
                {saved && (
                  <p
                    role="status"
                    className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700"
                  >
                    Profile updated.
                  </p>
                )}
                <Button
                  type="submit"
                  disabled={saving}
                  className="h-11 rounded-full bg-[#236bcf] px-6 text-white"
                >
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </SiteShell>
  )
}
