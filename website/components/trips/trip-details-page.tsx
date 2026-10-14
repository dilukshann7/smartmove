"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import {
  ArrowLeft,
  ArrowRight,
  BusFront,
  Check,
  Clock3,
  MapPin,
  Ticket,
} from "lucide-react"
import { SiteShell } from "@/components/site/site-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { lkr, tripDate, tripTime } from "@/lib/trip-format"
import type { TripDetails } from "@/lib/trip-types"
import { TripImageGallery } from "./trip-image-gallery"

export function TripDetailsPage({ tripId }: { tripId: string }) {
  const router = useRouter()
  const [trip, setTrip] = useState<TripDetails | null>(null)
  const [passenger, setPassenger] = useState<{
    name: string
    email: string
  } | null>(null)
  const [selected, setSelected] = useState<number[]>([])
  const [confirmed, setConfirmed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      fetch(`/api/trips/${tripId}`, {
        signal: controller.signal,
        cache: "no-store",
      }).then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error)
        return data.trip as TripDetails
      }),
      fetch("/api/auth/me", {
        signal: controller.signal,
        cache: "no-store",
      }).then((response) => (response.ok ? response.json() : null)),
    ])
      .then(([details, account]) => {
        setTrip(details)
        setPassenger(account?.passenger ?? null)
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(cause.message ?? "Unable to load trip.")
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [tripId])

  function toggleSeat(seat: number) {
    setConfirmed(false)
    setSelected((current) =>
      current.includes(seat)
        ? current.filter((item) => item !== seat)
        : [...current, seat].sort((a, b) => a - b)
    )
  }

  async function book() {
    if (!trip || !passenger || !confirmed || selected.length === 0) return
    setSubmitting(true)
    setError("")
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId: trip.id, seats: selected }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? "Booking failed.")
      router.push(`/bookings/${data.bookingId}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Booking failed.")
      const response = await fetch(`/api/trips/${tripId}`, {
        cache: "no-store",
      })
      if (response.ok) {
        const fresh = (await response.json()).trip as TripDetails
        setTrip(fresh)
        setSelected((current) => current.filter((seat) => !fresh.occupiedSeats.includes(seat)))
        setConfirmed(false)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SiteShell>
      <Link
        href="/trips"
        className="mb-7 inline-flex items-center gap-2 text-sm text-[#617b9e] hover:text-[#236bcf]"
      >
        <ArrowLeft className="size-4" /> Back to search
      </Link>
      {loading && (
        <p role="status" className="rounded-2xl bg-white p-8">
          Loading trip…
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {trip && (
        <>
          <div className="mb-8">
            <Badge className="mb-4 rounded-full bg-[#e7f1ff] text-[#256acb]">
              Trip #{trip.id}
            </Badge>
            <h1 className="text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
              {trip.origin} to {trip.destination}
            </h1>
            <p className="mt-3 text-[#6b7b91]">
              Choose one or more seats, then confirm your reservation.
            </p>
          </div>
          <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_370px]">
            <div className="space-y-7">
              <TripImageGallery
                key={trip.id}
                tripId={trip.id}
                label={`${trip.origin} to ${trip.destination}`}
              />
              <Card className="rounded-[26px] border-[#e5ebf3] bg-white shadow-sm">
                <CardContent className="p-6 sm:p-8">
                  <h2 className="mb-6 text-xl font-semibold">
                    Trip and vehicle
                  </h2>
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-medium tracking-wider text-[#91a1b5] uppercase">
                        Departure
                      </p>
                      <p className="mt-1 text-2xl font-semibold">
                        {tripTime(trip.departureAt)}
                      </p>
                      <p className="text-sm text-[#6c7e95]">
                        {tripDate(trip.departureAt)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium tracking-wider text-[#91a1b5] uppercase">
                        Arrival
                      </p>
                      <p className="mt-1 text-2xl font-semibold">
                        {tripTime(trip.arrivalAt)}
                      </p>
                      <p className="text-sm text-[#6c7e95]">
                        {tripDate(trip.arrivalAt)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-7 grid gap-3 border-t border-[#edf1f6] pt-6 text-sm text-[#60758f] sm:grid-cols-2">
                    <p className="flex items-center gap-2">
                      <MapPin className="size-4 text-[#3278d2]" />{" "}
                      {trip.routeName}
                    </p>
                    <p className="flex items-center gap-2">
                      <BusFront className="size-4 text-[#3278d2]" />{" "}
                      {trip.vehicleType} · {trip.registrationNumber}
                    </p>
                    <p className="flex items-center gap-2">
                      <Ticket className="size-4 text-[#3278d2]" />{" "}
                      {trip.availableSeats} of {trip.seatCount} seats available
                    </p>
                    <p className="flex items-center gap-2">
                      <Clock3 className="size-4 text-[#3278d2]" /> 30-minute
                      payment hold
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-[26px] border-[#e5ebf3] bg-white shadow-sm">
                <CardContent className="p-6 sm:p-8">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-xl font-semibold">Select seats</h2>
                    <span className="text-sm text-[#72839a]">
                      {selected.length} selected
                    </span>
                  </div>
                  <p className="mb-6 text-sm text-[#8191a7]">
                    Seat numbers follow the vehicle’s numbered seating.
                    Availability is checked again when you confirm.
                  </p>
                  <div className="mb-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-[#7f8ea2]">
                    <span className="flex items-center gap-2">
                      <span className="size-5 rounded-md border border-[#c9d7e8] bg-white" />{" "}
                      Available
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="size-5 rounded-md bg-[#236bcf]" />{" "}
                      Selected
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="size-5 rounded-md bg-[#dfe5ec]" /> Taken
                    </span>
                  </div>
                  <div
                    role="group"
                    aria-label="Choose seats"
                    className="mx-auto grid w-full max-w-[420px] grid-cols-4 gap-4"
                  >
                    {Array.from(
                      { length: trip.seatCount },
                      (_, index) => index + 1
                    ).map((seat) => {
                      const taken = trip.occupiedSeats.includes(seat)
                      const active = selected.includes(seat)
                      return (
                        <button
                          key={seat}
                          type="button"
                          disabled={taken}
                          aria-pressed={active}
                          aria-label={`Seat ${seat}${taken ? ", unavailable" : active ? ", selected" : ", available"}`}
                          onClick={() => toggleSeat(seat)}
                          className={`grid h-16 place-items-center rounded-xl border text-lg font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#236bcf] ${taken ? "cursor-not-allowed border-[#dfe5ec] bg-[#dfe5ec] text-[#a6b2c0]" : active ? "border-[#236bcf] bg-[#236bcf] text-white" : "border-[#c9d7e8] bg-white text-[#41617f] hover:border-[#236bcf] hover:bg-[#f0f7ff]"}`}
                        >
                          {seat}
                        </button>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
            <aside>
              <Card className="sticky top-24 rounded-[26px] border-[#e5ebf3] bg-white shadow-sm">
                <CardContent className="p-6 sm:p-7">
                  <h2 className="text-xl font-semibold">Fare summary</h2>
                  <div className="mt-5 space-y-3 text-sm">
                    <div className="flex justify-between text-[#6a7b92]">
                      <span>Fare per seat</span>
                      <span>{lkr(trip.fare)}</span>
                    </div>
                    <div className="flex justify-between text-[#6a7b92]">
                      <span>
                        Seats {selected.length ? selected.join(", ") : "—"}
                      </span>
                      <span>× {selected.length}</span>
                    </div>
                    <div className="flex justify-between border-t border-[#e9eef5] pt-4 text-lg font-semibold">
                      <span>Total</span>
                      <span>{lkr(trip.fare * selected.length)}</span>
                    </div>
                  </div>
                  <div className="mt-6 rounded-2xl bg-[#f1f7ff] p-4 text-sm text-[#537293]">
                    <p className="font-semibold text-[#275f9f]">
                      Payment pending after booking
                    </p>
                    <p className="mt-1 leading-6">
                      Your selected seats are held for 30 minutes. Staff must
                      record payment before tickets are issued. Online payment
                      is not available here.
                    </p>
                  </div>
                  <div className="mt-6 border-t border-[#e9eef5] pt-5">
                    <h3 className="text-sm font-semibold">
                      Passenger confirmation
                    </h3>
                    {passenger ? (
                      <>
                        <p className="mt-2 text-sm text-[#637991]">
                          {passenger.name}
                          <br />
                          {passenger.email}
                        </p>
                        <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm text-[#496077]">
                          <Checkbox
                            checked={confirmed}
                            onCheckedChange={(value) =>
                              setConfirmed(value === true)
                            }
                            aria-label="Confirm passenger details"
                          />
                          <span>
                            I confirm these passenger details and selected
                            seats.
                          </span>
                        </label>
                      </>
                    ) : (
                      <p className="mt-2 text-sm leading-6 text-[#637991]">
                        Sign in or create a passenger account to reserve seats.
                      </p>
                    )}
                  </div>
                  {passenger ? (
                    <Button
                      onClick={book}
                      disabled={
                        !confirmed || selected.length === 0 || submitting
                      }
                      className="mt-6 h-12 w-full rounded-full bg-[#236bcf] text-white disabled:opacity-50"
                    >
                      {submitting ? "Reserving…" : "Confirm reservation"}
                      <Check className="size-4" />
                    </Button>
                  ) : (
                    <Link
                      href={`/login?next=${encodeURIComponent(`/trips/${trip.id}`)}`}
                      className="mt-6 flex h-12 items-center justify-center gap-2 rounded-full bg-[#236bcf] text-sm font-medium text-white"
                    >
                      Sign in to book <ArrowRight className="size-4" />
                    </Link>
                  )}
                </CardContent>
              </Card>
            </aside>
          </div>
        </>
      )}
    </SiteShell>
  )
}
