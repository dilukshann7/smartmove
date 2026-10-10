"use client"

import Link from "next/link"
import { useEffect, useState, type FormEvent } from "react"
import { MessageSquareText, Send, Star } from "lucide-react"
import { SiteShell } from "@/components/site/site-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { tripDate } from "@/lib/trip-format"
import type { PortalBooking, PortalFeedback } from "@/lib/portal-types"

export function FeedbackPage() {
  const [bookings, setBookings] = useState<PortalBooking[]>([])
  const [items, setItems] = useState<PortalFeedback[]>([])
  const [type, setType] = useState<"REVIEW" | "COMPLAINT">("REVIEW")
  const [bookingId, setBookingId] = useState("")
  const [subject, setSubject] = useState("")
  const [comment, setComment] = useState("")
  const [vehicleRating, setVehicleRating] = useState("5")
  const [driverRating, setDriverRating] = useState("5")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  async function load() {
    const [dashboardResponse, feedbackResponse] = await Promise.all([
      fetch("/api/dashboard", { cache: "no-store" }),
      fetch("/api/feedback", { cache: "no-store" }),
    ])
    const dashboard = await dashboardResponse.json()
    const feedback = await feedbackResponse.json()
    if (!dashboardResponse.ok) throw new Error(dashboard.error)
    if (!feedbackResponse.ok) throw new Error(feedback.error)
    setBookings(dashboard.bookings)
    setItems(feedback.feedback)
  }
  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard", { cache: "no-store" }),
      fetch("/api/feedback", { cache: "no-store" }),
    ])
      .then(async ([dashboardResponse, feedbackResponse]) => {
        const dashboard = await dashboardResponse.json()
        const feedback = await feedbackResponse.json()
        if (!dashboardResponse.ok) throw new Error(dashboard.error)
        if (!feedbackResponse.ok) throw new Error(feedback.error)
        setBookings(dashboard.bookings)
        setItems(feedback.feedback)
      })
      .catch((cause) => setError(cause.message))
      .finally(() => setLoading(false))
  }, [])
  const eligible =
    type === "REVIEW"
      ? bookings.filter(
          (item) =>
            item.status === "CONFIRMED" &&
            item.tripStatus === "COMPLETED" &&
            !items.some(
              (feedback) =>
                feedback.bookingId === item.id && feedback.type === "REVIEW"
            )
        )
      : bookings
  const selectedBooking = eligible.find((item) => String(item.id) === bookingId)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setSuccess("")
    setSubmitting(true)
    try {
      if (!selectedBooking) throw new Error("Choose an eligible booking.")
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: selectedBooking.id,
          type,
          comment,
          ...(type === "REVIEW"
            ? {
                vehicleRating: Number(vehicleRating),
                driverRating: Number(driverRating),
              }
            : { subject }),
        }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error)
      setSuccess(
        `${type === "REVIEW" ? "Review" : "Complaint"} #${body.feedbackId} submitted.`
      )
      setComment("")
      setSubject("")
      setBookingId("")
      await load()
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Feedback could not be saved."
      )
    } finally {
      setSubmitting(false)
    }
  }
  return (
    <SiteShell>
      <div className="mb-9">
        <Badge className="mb-4 rounded-full bg-[#e7f1ff] text-[#256acb]">
          Passenger feedback
        </Badge>
        <h1 className="text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
          Share your experience.
        </h1>
        <p className="mt-3 text-[#6b7b91]">
          Review a completed journey or send a complaint about a booking.
        </p>
      </div>
      {loading && (
        <p role="status" className="rounded-2xl bg-white p-8">
          Loading feedback…
        </p>
      )}
      {!loading && error.includes("Sign in") && (
        <p className="mb-5 rounded-2xl bg-white p-5 text-sm">
          Please{" "}
          <Link
            href="/login?next=%2Ffeedback"
            className="font-semibold text-[#236bcf] underline"
          >
            sign in
          </Link>{" "}
          to use feedback.
        </p>
      )}
      {!loading && !error.includes("Sign in") && (
        <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.85fr)]">
          <Card className="h-fit rounded-[26px] border-[#e5ebf3] bg-white shadow-sm">
            <CardContent className="p-6 sm:p-8">
              <h2 className="mb-5 flex items-center gap-2 text-xl font-semibold">
                <MessageSquareText className="size-5 text-[#3176cf]" /> New
                feedback
              </h2>
              <form onSubmit={submit} className="space-y-5">
                <div>
                  <Label htmlFor="feedback-type">Feedback type</Label>
                  <select
                    id="feedback-type"
                    value={type}
                    onChange={(event) => {
                      setType(event.target.value as "REVIEW" | "COMPLAINT")
                      setBookingId("")
                    }}
                    className="mt-2 h-11 w-full rounded-xl border border-[#dfe7f1] bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-[#236bcf]"
                  >
                    <option value="REVIEW">
                      Review after a completed trip
                    </option>
                    <option value="COMPLAINT">Complaint about a booking</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="feedback-booking">Booking</Label>
                  <select
                    id="feedback-booking"
                    required
                    value={bookingId}
                    onChange={(event) => setBookingId(event.target.value)}
                    className="mt-2 h-11 w-full rounded-xl border border-[#dfe7f1] bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-[#236bcf]"
                  >
                    <option value="">Choose a booking</option>
                    {eligible.map((item) => (
                      <option key={item.id} value={item.id}>
                        #{item.id} · {item.origin} → {item.destination} ·{" "}
                        {tripDate(item.departureAt)}
                      </option>
                    ))}
                  </select>
                  {eligible.length === 0 && (
                    <p className="mt-2 text-xs text-[#8191a7]">
                      {type === "REVIEW"
                        ? "No completed paid trips awaiting a review."
                        : "No bookings available for a complaint."}
                    </p>
                  )}
                </div>
                {type === "REVIEW" ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="vehicle-rating">Vehicle rating</Label>
                      <select
                        id="vehicle-rating"
                        value={vehicleRating}
                        onChange={(event) =>
                          setVehicleRating(event.target.value)
                        }
                        className="mt-2 h-11 w-full rounded-xl border border-[#dfe7f1] bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-[#236bcf]"
                      >
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>
                            {n} / 5
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="driver-rating">Driver rating</Label>
                      <select
                        id="driver-rating"
                        value={driverRating}
                        onChange={(event) =>
                          setDriverRating(event.target.value)
                        }
                        className="mt-2 h-11 w-full rounded-xl border border-[#dfe7f1] bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-[#236bcf]"
                      >
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>
                            {n} / 5
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div>
                    <Label htmlFor="complaint-subject">Subject</Label>
                    <Input
                      id="complaint-subject"
                      required
                      minLength={3}
                      maxLength={100}
                      value={subject}
                      onChange={(event) => setSubject(event.target.value)}
                      className="mt-2 h-11 rounded-xl"
                    />
                  </div>
                )}
                <div>
                  <Label htmlFor="feedback-comment">
                    {type === "REVIEW" ? "Your review" : "What happened?"}
                  </Label>
                  <Textarea
                    id="feedback-comment"
                    required
                    minLength={10}
                    maxLength={2000}
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    className="mt-2 min-h-32 rounded-xl"
                    placeholder="Write at least 10 characters…"
                  />
                </div>
                {error && (
                  <p
                    role="alert"
                    className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
                  >
                    {error}
                  </p>
                )}
                {success && (
                  <p
                    role="status"
                    className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700"
                  >
                    {success}
                  </p>
                )}
                <Button
                  type="submit"
                  disabled={submitting || eligible.length === 0}
                  className="h-11 w-full rounded-full bg-[#236bcf] text-white"
                >
                  {submitting ? "Submitting…" : "Submit feedback"}
                  <Send className="size-4" />
                </Button>
              </form>
            </CardContent>
          </Card>
          <section aria-label="Your feedback">
            <h2 className="mb-5 text-xl font-semibold">Your feedback</h2>
            {items.length === 0 && (
              <div className="rounded-[26px] bg-white p-7 text-sm text-[#8493a7]">
                No reviews or complaints yet.
              </div>
            )}
            <div className="space-y-4">
              {items.map((item) => (
                <Card
                  key={item.id}
                  className="rounded-[24px] border-[#e5ebf3] bg-white shadow-sm"
                >
                  <CardContent className="p-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="bg-[#e7f1ff] text-[#256acb]">
                        {item.type}
                      </Badge>
                      <Badge
                        className={
                          item.status === "RESOLVED"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700"
                        }
                      >
                        {item.status}
                      </Badge>
                      <span className="ml-auto text-xs text-[#91a1b5]">
                        #{item.id} · Booking #{item.bookingId}
                      </span>
                    </div>
                    <h3 className="mt-4 font-semibold">
                      {item.subject || item.route}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-[#627891]">
                      {item.comment ?? "Content is temporarily unavailable."}
                    </p>
                    {item.type === "REVIEW" &&
                      item.vehicleRating &&
                      item.driverRating && (
                        <p className="mt-3 flex items-center gap-1 text-xs text-[#6f8aaa]">
                          <Star className="size-3.5" /> Vehicle{" "}
                          {item.vehicleRating}/5 · Driver {item.driverRating}/5
                        </p>
                      )}
                    {item.reply && (
                      <div className="mt-5 rounded-2xl bg-[#f1f7ff] p-4">
                        <p className="text-xs font-semibold text-[#2f6ebc]">
                          Reply from {item.reply.staffName}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-[#53708d]">
                          {item.reply.message}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        </div>
      )}
    </SiteShell>
  )
}
