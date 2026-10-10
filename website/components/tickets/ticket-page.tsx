"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowLeft, BusFront, MapPin, Ticket } from "lucide-react"
import { SiteShell } from "@/components/site/site-shell"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { lkr, tripDate, tripTime } from "@/lib/trip-format"
import type { PortalTicket } from "@/lib/portal-types"

export function TicketPage({ ticketId }: { ticketId: string }) {
  const [ticket, setTicket] = useState<PortalTicket | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch(`/api/tickets/${ticketId}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error)
        setTicket(data.ticket)
      })
      .catch((cause) => setError(cause.message))
      .finally(() => setLoading(false))
  }, [ticketId])
  return (
    <SiteShell>
      <div className="mx-auto max-w-[760px]">
        <Link
          href="/dashboard"
          className="mb-7 inline-flex items-center gap-2 text-sm text-[#617b9e] hover:text-[#236bcf]"
        >
          <ArrowLeft className="size-4" /> Dashboard
        </Link>
        <h1 className="mb-8 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
          Issued ticket.
        </h1>
        {loading && (
          <p role="status" className="rounded-2xl bg-white p-8">
            Loading ticket…
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 p-5 text-red-700">
            {error}{" "}
            {error.includes("Sign in") && (
              <Link
                href={`/login?next=${encodeURIComponent(`/tickets/${ticketId}`)}`}
                className="underline"
              >
                Sign in
              </Link>
            )}
          </p>
        )}
        {ticket && (
          <Card className="overflow-hidden rounded-[28px] border-[#d9e8f9] bg-white shadow-[0_20px_50px_rgba(35,80,135,0.08)]">
            <CardContent className="p-0">
              <div className="bg-[linear-gradient(110deg,#e7f2ff,#f7fbff)] p-7 sm:p-9">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 font-semibold text-[#245f9f]">
                    <Ticket className="size-5" /> SmartMove
                  </span>
                  <Badge className="bg-emerald-50 text-emerald-700">
                    ISSUED
                  </Badge>
                </div>
                <p className="mt-8 text-xs font-semibold tracking-widest text-[#83a1c3] uppercase">
                  Ticket #{ticket.id}
                </p>
                <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
                  {ticket.origin} <span className="text-[#79a9e3]">→</span>{" "}
                  {ticket.destination}
                </h2>
                <p className="mt-2 text-sm text-[#607a98]">
                  {tripDate(ticket.departureAt)}
                </p>
              </div>
              <div className="grid gap-6 p-7 sm:grid-cols-2 sm:p-9">
                <div>
                  <p className="text-xs tracking-wider text-[#91a1b5] uppercase">
                    Departure
                  </p>
                  <p className="mt-1 text-2xl font-semibold">
                    {tripTime(ticket.departureAt)}
                  </p>
                </div>
                <div>
                  <p className="text-xs tracking-wider text-[#91a1b5] uppercase">
                    Arrival
                  </p>
                  <p className="mt-1 text-2xl font-semibold">
                    {tripTime(ticket.arrivalAt)}
                  </p>
                </div>
                <div>
                  <p className="text-xs tracking-wider text-[#91a1b5] uppercase">
                    Seat
                  </p>
                  <p className="mt-1 text-xl font-semibold">
                    {ticket.seatNumber}
                  </p>
                </div>
                <div>
                  <p className="text-xs tracking-wider text-[#91a1b5] uppercase">
                    Fare
                  </p>
                  <p className="mt-1 text-xl font-semibold">
                    {lkr(ticket.fare)}
                  </p>
                </div>
                <div className="border-t border-[#edf1f6] pt-5 text-sm text-[#617892] sm:col-span-2">
                  <p className="flex items-center gap-2">
                    <BusFront className="size-4" /> {ticket.vehicleType} ·{" "}
                    {ticket.registrationNumber}
                  </p>
                  <p className="mt-2 flex items-center gap-2">
                    <MapPin className="size-4" /> Booking #{ticket.bookingId}
                  </p>
                </div>
              </div>
              <div className="border-t border-[#edf1f6] px-7 py-5 text-sm sm:px-9">
                <Link
                  href={`/bookings/${ticket.bookingId}`}
                  className="font-semibold text-[#236bcf] hover:underline"
                >
                  View booking status
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </SiteShell>
  )
}
