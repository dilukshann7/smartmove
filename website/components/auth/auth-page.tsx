"use client"

import { apiFetch, storeAuth } from "@/lib/client-auth"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"
import {
  ArrowRight,
  BusFront,
  LockKeyhole,
  ShieldCheck,
  Ticket,
} from "lucide-react"
import { SiteShell } from "@/components/site/site-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function AuthPage({
  mode,
  nextPath,
}: {
  mode: "login" | "signup"
  nextPath?: string
}) {
  const router = useRouter()
  const safeNext =
    nextPath?.startsWith("/") &&
    !nextPath.startsWith("//") &&
    !nextPath.includes("\\")
      ? nextPath
      : "/dashboard"
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError("")
    try {
      const response = await apiFetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "signup"
            ? { name, phone, email, password }
            : { email, password }
        ),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? "Something went wrong.")
      storeAuth({ token: data.token, expiresAt: data.expiresAt })
      const destination =
        data.role === "ADMIN"
          ? safeNext.startsWith("/admin")
            ? safeNext
            : "/admin"
          : safeNext.startsWith("/admin")
            ? "/dashboard"
            : safeNext
      router.push(destination)
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SiteShell>
      <div className="smartmove-auth">
        <div className="smartmove-auth-story">
          <span className="journey-kicker">A LITTLE LESS PLANNING</span>
          <h2>
            Your next move.
            <br />
            <span>All yours.</span>
          </h2>
          <p>
            A window seat. A change of scenery. Keep your journeys together and
            make room for wherever comes next.
          </p>
          <div className="smartmove-auth-features">
            <span>
              <BusFront aria-hidden="true" /> Find a trip that fits your day
            </span>
            <span>
              <Ticket aria-hidden="true" /> Keep your bookings and tickets
              together
            </span>
            <span>
              <ShieldCheck aria-hidden="true" /> Manage your trips from your
              account
            </span>
          </div>
        </div>
        <div className="smartmove-auth-form">
          <div className="mb-7 text-center">
            <span className="mx-auto mb-5 grid size-12 place-items-center rounded-2xl bg-[#e7f1ff] text-[#236bcf]">
              <LockKeyhole className="size-5" />
            </span>
            <h1 className="text-4xl font-semibold tracking-[-0.05em]">
              {mode === "signup" ? "Create your account." : "Welcome back."}
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#71829a]">
              {mode === "signup"
                ? "Your bookings will be saved to your passenger account."
                : "Sign in to continue to your SmartMove workspace."}
            </p>
          </div>
          <Card className="rounded-[26px] border-[#e5ebf3] bg-white shadow-sm">
            <CardContent className="p-6 sm:p-8">
              <form onSubmit={submit} className="space-y-5">
                {mode === "signup" && (
                  <>
                    <div>
                      <Label htmlFor="full-name">Full name</Label>
                      <Input
                        id="full-name"
                        autoComplete="name"
                        required
                        minLength={2}
                        maxLength={100}
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        className="mt-2 h-12 rounded-xl"
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone number</Label>
                      <Input
                        id="phone"
                        type="tel"
                        autoComplete="tel"
                        required
                        maxLength={15}
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        className="mt-2 h-12 rounded-xl"
                      />
                    </div>
                  </>
                )}
                <div>
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={100}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="mt-2 h-12 rounded-xl"
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete={
                      mode === "signup" ? "new-password" : "current-password"
                    }
                    required
                    minLength={mode === "signup" ? 8 : undefined}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="mt-2 h-12 rounded-xl"
                  />
                  {mode === "signup" && (
                    <p className="mt-2 text-xs text-[#8493a7]">
                      Use at least 8 characters.
                    </p>
                  )}
                </div>
                {error && (
                  <p
                    role="alert"
                    className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
                  >
                    {error}
                  </p>
                )}
                <Button
                  type="submit"
                  disabled={submitting}
                  className="h-12 w-full rounded-full bg-[#236bcf] text-white"
                >
                  {submitting
                    ? "Please wait…"
                    : mode === "signup"
                      ? "Create account"
                      : "Sign in"}
                  <ArrowRight className="size-4" />
                </Button>
              </form>
            </CardContent>
          </Card>
          <p className="mt-6 text-center text-sm text-[#71829a]">
            {mode === "signup"
              ? "Already have an account?"
              : "New to SmartMove?"}{" "}
            <Link
              href={`${mode === "signup" ? "/login" : "/signup"}?next=${encodeURIComponent(safeNext)}`}
              className="font-semibold text-[#236bcf] hover:underline"
            >
              {mode === "signup" ? "Sign in" : "Create an account"}
            </Link>
          </p>
        </div>
      </div>
    </SiteShell>
  )
}
