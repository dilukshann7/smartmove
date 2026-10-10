"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowRight, Ticket } from "lucide-react"
import { SiteShell } from "@/components/site/site-shell"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { tripDate, tripTime } from "@/lib/trip-format"

type Summary = {
  id: number
  origin: string
  destination: string
  departureAt: string
  status: string
  seatCount: number
}

export function BookingsPage() {
  const [bookings, setBookings] = useState<Summary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [signedOut, setSignedOut] = useState(false)
  useEffect(() => {
    fetch("/api/bookings", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) {
          setSignedOut(true)
          return
        }
        const data = await response.json()
        if (!response.ok) throw new Error(data.error)
        setBookings(data.bookings)
      })
      .catch((cause) => setError(cause.message))
      .finally(() => setLoading(false))
  }, [])
  return (
    <SiteShell>
      <div className="mb-8">
        <Badge className="mb-4 rounded-full bg-[#e7f1ff] text-[#256acb]">
          Passenger account
        </Badge>
        <h1 className="text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
          My bookings.
        </h1>
        <p className="mt-3 text-[#6b7b91]">
          Review reservations and ticket status.
        </p>
      </div>
      {loading && <p role="status">Loading bookings…</p>}
      {error && (
        <p role="alert" className="rounded-2xl bg-red-50 p-5 text-red-700">
          {error}
        </p>
      )}
      {signedOut && (
        <div className="rounded-[26px] bg-white p-8 text-[#6b7b91]">
          Please{" "}
          <Link
            href="/login?next=%2Fbookings"
            className="font-semibold text-[#236bcf] underline"
          >
            sign in
          </Link>{" "}
          to view your bookings.
        </div>
      )}
      {!loading && !signedOut && !error && bookings.length === 0 && (
        <div className="rounded-[26px] bg-white p-10 text-center text-[#6b7b91]">
          <Ticket className="mx-auto mb-4 size-7 text-[#8cb4e7]" />
          No bookings yet.{" "}
          <Link
            href="/trips"
            className="font-semibold text-[#236bcf] underline"
          >
            Find a trip
          </Link>
          .
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {bookings.map((booking) => (
          <Link
            key={booking.id}
            href={`/bookings/${booking.id}`}
            className="block rounded-[26px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#236bcf]"
          >
            <Card className="h-full rounded-[26px] border-[#e5ebf3] bg-white shadow-sm transition-colors hover:border-[#b8d1ef]">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <Badge className="rounded-full bg-[#e7f1ff] text-[#256acb]">
                    #{booking.id}
                  </Badge>
                  <Badge
                    className={
                      booking.status === "CONFIRMED"
                        ? "bg-emerald-50 text-emerald-700"
                        : booking.status === "PENDING"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-[#eef1f5] text-[#64758d]"
                    }
                  >
                    {booking.status}
                  </Badge>
                </div>
                <h2 className="mt-5 text-xl font-semibold">
                  {booking.origin} → {booking.destination}
                </h2>
                <p className="mt-2 text-sm text-[#71829a]">
                  {tripDate(booking.departureAt)} ·{" "}
                  {tripTime(booking.departureAt)} · {booking.seatCount}{" "}
                  {booking.seatCount === 1 ? "seat" : "seats"}
                </p>
                <p className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#236bcf]">
                  View status <ArrowRight className="size-4" />
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </SiteShell>
  )
}
