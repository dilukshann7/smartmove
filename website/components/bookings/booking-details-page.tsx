"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowLeft, BusFront, Clock3, Ticket } from "lucide-react"
import { SiteShell } from "@/components/site/site-shell"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { lkr, tripDate, tripTime } from "@/lib/trip-format"
import type { Booking } from "@/lib/trip-types"

export function BookingDetailsPage({ bookingId }: { bookingId: string }) {
  const [booking, setBooking] = useState<Booking | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  useEffect(() => {
    fetch(`/api/bookings/${bookingId}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error)
        setBooking(data.booking)
      })
      .catch((cause) => setError(cause.message))
      .finally(() => setLoading(false))
  }, [bookingId])
  async function refreshStatus() {
    setRefreshing(true)
    try {
      const response = await fetch(`/api/bookings/${bookingId}`, {
        cache: "no-store",
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setBooking(data.booking)
      setError("")
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to refresh status."
      )
    } finally {
      setRefreshing(false)
    }
  }
  async function cancelBooking() {
    setCancelling(true)
    setError("")
    try {
      const response = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: "POST",
      })
      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error ?? "Unable to cancel booking.")
      setCancelOpen(false)
      await refreshStatus()
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to cancel booking."
      )
    } finally {
      setCancelling(false)
    }
  }
  return (
    <SiteShell>
      <Link
        href="/bookings"
        className="mb-7 inline-flex items-center gap-2 text-sm text-[#617b9e] hover:text-[#236bcf]"
      >
        <ArrowLeft className="size-4" /> My bookings
      </Link>
      {loading && (
        <p role="status" className="rounded-2xl bg-white p-8">
          Loading booking…
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-2xl bg-red-50 p-5 text-red-700">
          {error}{" "}
          {error.includes("Sign in") && (
            <Link
              href={`/login?next=${encodeURIComponent(`/bookings/${bookingId}`)}`}
              className="underline"
            >
              Sign in
            </Link>
          )}
        </p>
      )}
      {booking && (
        <>
          <div className="mb-8">
            <Badge className="mb-4 rounded-full bg-[#e7f1ff] text-[#256acb]">
              Booking #{booking.id}
            </Badge>
            <h1 className="text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
              Booking status.
            </h1>
            <p className="mt-3 text-[#6b7b91]">
              {booking.origin} → {booking.destination}
            </p>
            <Button
              variant="outline"
              onClick={refreshStatus}
              disabled={refreshing}
              className="mt-5 rounded-full"
            >
              {refreshing ? "Refreshing…" : "Refresh status"}
            </Button>
            {booking.canCancel && (
              <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
                <Button
                  variant="outline"
                  onClick={() => setCancelOpen(true)}
                  className="mt-5 ml-3 rounded-full text-red-700"
                >
                  Cancel booking
                </Button>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Cancel the whole booking?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      All {booking.seats.length} seats will be released.{" "}
                      {booking.status === "CONFIRMED"
                        ? "A full refund will be recorded in SmartMove. Any actual payout happens outside SmartMove."
                        : "There is no payment to refund for this pending booking."}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  {error && (
                    <p
                      role="alert"
                      className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
                    >
                      {error}
                    </p>
                  )}
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={cancelling}>
                      Keep booking
                    </AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      onClick={cancelBooking}
                      disabled={cancelling}
                    >
                      {cancelling ? "Cancelling…" : "Cancel all seats"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
          <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_350px]">
            <Card className="rounded-[26px] border-[#e5ebf3] bg-white shadow-sm">
              <CardContent className="p-6 sm:p-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold">Reservation</h2>
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
                <p className="mt-4 text-sm leading-6 text-[#637991]">
                  {booking.status === "PENDING"
                    ? `Seats are held until ${tripTime(booking.expiresAt)} on ${tripDate(booking.expiresAt)}. Staff must record full payment before then; tickets are not issued yet.`
                    : booking.status === "CONFIRMED"
                      ? "Payment has been recorded and tickets are issued."
                      : "This booking was cancelled or its payment hold expired. These seats are no longer reserved."}
                </p>
                {booking.status === "CANCELLED" &&
                  booking.refundStatus === "RECORDED" && (
                    <p className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">
                      Refund recorded: {lkr(booking.refundAmount ?? 0)}. Any
                      actual payout happens outside SmartMove.
                    </p>
                  )}
                {booking.status === "CANCELLED" &&
                  booking.refundStatus === "PENDING" && (
                    <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">
                      Refund pending. Please contact staff about the refund
                      record; any actual payout happens outside SmartMove.
                    </p>
                  )}
                <div className="mt-7 grid gap-5 border-t border-[#edf1f6] pt-6 sm:grid-cols-2">
                  <div>
                    <p className="text-xs tracking-wider text-[#91a1b5] uppercase">
                      Departure
                    </p>
                    <p className="mt-1 font-semibold">
                      {tripDate(booking.departureAt)}
                    </p>
                    <p className="text-sm text-[#697e97]">
                      {tripTime(booking.departureAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs tracking-wider text-[#91a1b5] uppercase">
                      Arrival
                    </p>
                    <p className="mt-1 font-semibold">
                      {tripDate(booking.arrivalAt)}
                    </p>
                    <p className="text-sm text-[#697e97]">
                      {tripTime(booking.arrivalAt)}
                    </p>
                  </div>
                </div>
                <div className="mt-7 flex flex-wrap gap-5 border-t border-[#edf1f6] pt-6 text-sm text-[#617892]">
                  <span className="inline-flex items-center gap-2">
                    <BusFront className="size-4" /> {booking.vehicleType}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Ticket className="size-4" /> {booking.seats.length} seats
                  </span>
                </div>
              </CardContent>
            </Card>
            <Card className="h-fit rounded-[26px] border-[#e5ebf3] bg-white shadow-sm">
              <CardContent className="p-6 sm:p-7">
                <h2 className="text-xl font-semibold">Seats and fare</h2>
                <div className="mt-5 space-y-3">
                  {booking.seats.map((seat) => (
                    <div
                      key={seat.number}
                      className="flex flex-wrap items-center justify-between gap-2 text-sm"
                    >
                      <span className="text-[#60758f]">
                        Seat {seat.number}{" "}
                        <span className="text-[#9aabba]">
                          · {seat.status.toLowerCase()}
                        </span>
                      </span>
                      <span>{lkr(seat.fare)}</span>
                      {booking.status === "CONFIRMED" &&
                        seat.status === "ISSUED" && (
                          <Link
                            href={`/tickets/${seat.id}`}
                            className="text-[#256acb] underline"
                          >
                            Ticket #{seat.id}
                          </Link>
                        )}
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex justify-between border-t border-[#edf1f6] pt-4 font-semibold">
                  <span>Total fare</span>
                  <span>{lkr(booking.totalFare)}</span>
                </div>
                {booking.status === "PENDING" && (
                  <div className="mt-6 flex gap-2 rounded-2xl bg-[#f1f7ff] p-4 text-sm leading-6 text-[#537293]">
                    <Clock3 className="mt-1 size-4 shrink-0" />
                    <span>
                      Payment must be recorded by staff within the hold period.
                      There is no online payment on this website.
                    </span>
                  </div>
                )}
                <Link
                  href="/feedback"
                  className="mt-6 inline-block text-sm font-medium text-[#256acb] hover:underline"
                >
                  Leave feedback about this booking
                </Link>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </SiteShell>
  )
}
