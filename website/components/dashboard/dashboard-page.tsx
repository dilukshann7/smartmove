"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import {
  ArrowRight,
  CalendarDays,
  CreditCard,
  MapPin,
  Ticket,
  MessageSquareText,
  UserRound,
  Clock3,
} from "lucide-react"
import { SiteShell } from "@/components/site/site-shell"
import { NotificationInbox } from "./notification-inbox"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { lkr, tripDate, tripTime } from "@/lib/trip-format"
import type { PortalBooking, PortalTicket } from "@/lib/portal-types"

export function DashboardPage() {
  const [data, setData] = useState<{
    passenger: { name: string }
    bookings: PortalBooking[]
    tickets: PortalTicket[]
    serverNow: string
  } | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch("/api/dashboard", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json()
        if (!response.ok) throw new Error(body.error)
        setData(body)
      })
      .catch((cause) => setError(cause.message))
      .finally(() => setLoading(false))
  }, [])
  const bookings = data?.bookings ?? []
  const tickets = data?.tickets ?? []
  const upcomingTrips = bookings.filter(
    (item) =>
      item.status === "CONFIRMED" &&
      item.tripStatus === "SCHEDULED" &&
      data &&
      new Date(item.departureAt).getTime() > new Date(data.serverNow).getTime()
  )
  const upcoming = upcomingTrips.sort((a, b) =>
    a.departureAt.localeCompare(b.departureAt)
  )[0]
  const pending = bookings.filter((item) => item.status === "PENDING")
  const history = bookings.filter(
    (item) => item.status === "CONFIRMED" && item.tripStatus === "COMPLETED"
  )
  const cancelled = bookings.filter((item) => item.status === "CANCELLED")
  return (
    <SiteShell>
      <div className="mb-9">
        <Badge className="mb-4 rounded-full bg-[#e7f1ff] text-[#256acb]">
          Passenger dashboard
        </Badge>
        <h1 className="text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
          Your journeys, together.
        </h1>
        <p className="mt-3 text-[#6b7b91]">
          {data
            ? `Welcome back, ${data.passenger.name}.`
            : "Trips, tickets and updates in one place."}
        </p>
      </div>
      {loading && (
        <p role="status" className="rounded-2xl bg-white p-8">
          Loading dashboard…
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-2xl bg-red-50 p-6 text-red-700">
          {error}{" "}
          {error.includes("Sign in") && (
            <Link href="/login?next=%2Fdashboard" className="underline">
              Sign in
            </Link>
          )}
        </p>
      )}
      {data && (
        <>
          <div className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "Upcoming",
                value: upcomingTrips.length,
                icon: CalendarDays,
              },
              { label: "Pending", value: pending.length, icon: Clock3 },
              { label: "Issued tickets", value: tickets.length, icon: Ticket },
              { label: "Completed trips", value: history.length, icon: MapPin },
            ].map((stat) => (
              <Card
                key={stat.label}
                className="rounded-[24px] border-[#e5ebf3] bg-white shadow-sm"
              >
                <CardContent className="flex flex-row items-center justify-between p-6">
                  <div>
                    <p className="text-sm text-[#74859a]">{stat.label}</p>
                    <p className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
                      {stat.value}
                    </p>
                  </div>
                  <span className="grid size-11 place-items-center rounded-2xl bg-[#eaf3ff] text-[#2b70c9]">
                    <stat.icon className="size-5" />
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid gap-7 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)]">
            <div className="space-y-7">
              <Card className="rounded-[28px] border-[#dceaf9] bg-[linear-gradient(120deg,#eaf4ff,#ffffff_70%)] shadow-sm">
                <CardContent className="p-7 sm:p-9">
                  <div className="mb-5 flex items-center justify-between">
                    <h2 className="text-xl font-semibold">Upcoming trip</h2>
                    <CalendarDays className="size-5 text-[#3378cf]" />
                  </div>
                  {upcoming ? (
                    <>
                      <p className="text-3xl font-semibold tracking-[-0.04em]">
                        {upcoming.origin}{" "}
                        <span className="text-[#79a9e3]">→</span>{" "}
                        {upcoming.destination}
                      </p>
                      <p className="mt-3 text-sm text-[#607a98]">
                        {tripDate(upcoming.departureAt)} ·{" "}
                        {tripTime(upcoming.departureAt)} · {upcoming.seatCount}{" "}
                        {upcoming.seatCount === 1 ? "seat" : "seats"}
                      </p>
                      <Link
                        href={`/bookings/${upcoming.id}`}
                        className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#236bcf] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#1d5db9]"
                      >
                        View booking <ArrowRight className="size-4" />
                      </Link>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-[#6e8096]">
                        No confirmed upcoming trip.
                      </p>
                      <Link
                        href="/trips"
                        className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#236bcf]"
                      >
                        Find a trip <ArrowRight className="size-4" />
                      </Link>
                    </>
                  )}
                </CardContent>
              </Card>
              {pending.length > 0 && (
                <Card className="rounded-[26px] border-[#e5ebf3] bg-white shadow-sm">
                  <CardContent className="p-6 sm:p-7">
                    <h2 className="mb-4 text-xl font-semibold">
                      Awaiting payment
                    </h2>
                    <div className="space-y-3">
                      {pending.map((item) => (
                        <Link
                          key={item.id}
                          href={`/bookings/${item.id}`}
                          className="flex items-center justify-between gap-3 rounded-2xl bg-[#fff9ee] p-4 text-sm hover:bg-[#fff3dc]"
                        >
                          <span>
                            {item.origin} → {item.destination}
                            <span className="mt-1 block text-xs text-[#987e54]">
                              Booking #{item.id} · {tripDate(item.departureAt)}
                            </span>
                          </span>
                          <ArrowRight className="size-4 shrink-0" />
                        </Link>
                      ))}
                    </div>
                    <p className="mt-4 text-xs text-[#8b9aad]">
                      Pending seats are held for 30 minutes; staff must record
                      payment.
                    </p>
                  </CardContent>
                </Card>
              )}
              <Card className="rounded-[26px] border-[#e5ebf3] bg-white shadow-sm">
                <CardContent className="p-6 sm:p-7">
                  <div className="mb-5 flex items-center justify-between">
                    <h2 className="text-xl font-semibold">Bookings</h2>
                    <Link
                      href="/bookings"
                      className="text-sm font-semibold text-[#236bcf]"
                    >
                      See all
                    </Link>
                  </div>
                  {bookings.length === 0 ? (
                    <p className="text-sm text-[#8493a7]">No bookings yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {bookings.slice(0, 4).map((item) => (
                        <Link
                          key={item.id}
                          href={`/bookings/${item.id}`}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-[#edf1f6] p-4 hover:border-[#c8dcf4]"
                        >
                          <div>
                            <p className="font-medium">
                              {item.origin} → {item.destination}
                            </p>
                            <p className="mt-1 text-xs text-[#8999ad]">
                              #{item.id} · {tripDate(item.departureAt)}
                            </p>
                          </div>
                          <Badge
                            className={
                              item.status === "CONFIRMED"
                                ? "bg-emerald-50 text-emerald-700"
                                : item.status === "PENDING"
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-[#eef1f5] text-[#64758d]"
                            }
                          >
                            {item.status}
                          </Badge>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card className="rounded-[26px] border-[#e5ebf3] bg-white shadow-sm">
                <CardContent className="p-6 sm:p-7">
                  <div className="mb-5 flex items-center justify-between">
                    <h2 className="text-xl font-semibold">Issued tickets</h2>
                    <Ticket className="size-5 text-[#3176cf]" />
                  </div>
                  {tickets.length === 0 ? (
                    <p className="text-sm text-[#8493a7]">
                      No issued tickets yet.
                    </p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {tickets.slice(0, 4).map((item) => (
                        <Link
                          key={item.id}
                          href={`/tickets/${item.id}`}
                          className="rounded-2xl border border-[#e1ebf7] bg-[#f7fbff] p-4 hover:border-[#9fc3ed]"
                        >
                          <p className="text-xs text-[#7e91a9]">
                            Ticket #{item.id} · Seat {item.seatNumber}
                          </p>
                          <p className="mt-2 font-semibold">
                            {item.origin} → {item.destination}
                          </p>
                          <p className="mt-1 text-xs text-[#7086a0]">
                            {tripDate(item.departureAt)}
                          </p>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
            <div className="space-y-7">
              <NotificationInbox />
              <Card className="rounded-[26px] border-[#e5ebf3] bg-white shadow-sm">
                <CardContent className="p-6 sm:p-7">
                  <h2 className="mb-4 text-xl font-semibold">Travel history</h2>
                  {history.length === 0 ? (
                    <p className="text-sm text-[#8493a7]">
                      Completed trips will appear here.
                    </p>
                  ) : (
                    history.map((item) => (
                      <Link
                        key={item.id}
                        href={`/bookings/${item.id}`}
                        className="mb-2 block rounded-xl border border-[#edf1f6] p-4 hover:border-[#c8dcf4]"
                      >
                        <p className="text-sm font-medium">
                          {item.origin} → {item.destination}
                        </p>
                        <p className="mt-1 text-xs text-[#8999ad]">
                          {tripDate(item.departureAt)}
                        </p>
                      </Link>
                    ))
                  )}
                </CardContent>
              </Card>
              <Card className="rounded-[26px] border-[#e5ebf3] bg-white shadow-sm">
                <CardContent className="p-6 sm:p-7">
                  <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
                    <CreditCard className="size-5 text-[#3176cf]" />{" "}
                    Cancellations & refunds
                  </h2>
                  {cancelled.length === 0 ? (
                    <p className="text-sm text-[#8493a7]">
                      No cancelled bookings.
                    </p>
                  ) : (
                    cancelled.map((item) => (
                      <Link
                        key={item.id}
                        href={`/bookings/${item.id}`}
                        className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-[#edf1f6] p-4 hover:border-[#c8dcf4]"
                      >
                        <span className="text-sm">
                          Booking #{item.id}
                          <span className="block text-xs text-[#8191a7]">
                            {item.origin} → {item.destination}
                          </span>
                        </span>
                        <span className="text-xs font-semibold text-[#60758f]">
                          {item.refundStatus === "RECORDED"
                            ? `Refund recorded · ${lkr(item.refundAmount ?? 0)}`
                            : item.refundStatus === "PENDING"
                              ? "Refund pending"
                              : "No payment"}
                        </span>
                      </Link>
                    ))
                  )}
                  {cancelled.some(
                    (item) => item.refundStatus === "RECORDED"
                  ) && (
                    <p className="mt-3 text-xs text-[#8a99ac]">
                      Actual payouts happen outside SmartMove.
                    </p>
                  )}
                </CardContent>
              </Card>
              <div className="grid grid-cols-2 gap-3">
                <Link
                  href="/feedback"
                  className="flex items-center gap-3 rounded-2xl bg-white p-5 text-sm font-semibold text-[#315878] shadow-sm hover:text-[#236bcf]"
                >
                  <MessageSquareText className="size-5" /> Feedback
                </Link>
                <Link
                  href="/profile"
                  className="flex items-center gap-3 rounded-2xl bg-white p-5 text-sm font-semibold text-[#315878] shadow-sm hover:text-[#236bcf]"
                >
                  <UserRound className="size-5" /> Profile
                </Link>
              </div>
            </div>
          </div>
        </>
      )}
    </SiteShell>
  )
}
