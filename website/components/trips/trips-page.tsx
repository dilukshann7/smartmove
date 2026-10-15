"use client"

import { apiFetch } from "@/lib/client-auth"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState, type FormEvent } from "react"
import {
  ArrowRight,
  BusFront,
  CalendarDays,
  Clock3,
  MapPin,
  Search,
  SlidersHorizontal,
} from "lucide-react"
import { SiteShell } from "@/components/site/site-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { lkr, tripDate, tripTime } from "@/lib/trip-format"
import type { Trip } from "@/lib/trip-types"

type Search = { origin?: string; destination?: string; date?: string }

export function TripsPage({ initialSearch }: { initialSearch: Search }) {
  const router = useRouter()
  const [origin, setOrigin] = useState(initialSearch.origin ?? "")
  const [destination, setDestination] = useState(
    initialSearch.destination ?? ""
  )
  const [date, setDate] = useState(initialSearch.date ?? "")
  const [error, setError] = useState("")
  const [loadedQuery, setLoadedQuery] = useState("")
  const [trips, setTrips] = useState<Trip[]>([])
  const [maxFare, setMaxFare] = useState("")
  const [period, setPeriod] = useState("all")
  const [minSeats, setMinSeats] = useState("1")

  const query = new URLSearchParams({
    origin: initialSearch.origin ?? "",
    destination: initialSearch.destination ?? "",
    date: initialSearch.date ?? "",
  })
  const queryString = query.toString()
  const loading = Boolean(initialSearch.origin && loadedQuery !== queryString)
  useEffect(() => {
    if (
      !initialSearch.origin ||
      !initialSearch.destination ||
      !initialSearch.date
    )
      return
    const controller = new AbortController()
    apiFetch(`/api/trips?${queryString}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error ?? "Trip search failed.")
        setTrips(data.trips)
        setError("")
      })
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setTrips([])
          setError(cause.message)
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadedQuery(queryString)
      })
    return () => controller.abort()
  }, [
    queryString,
    initialSearch.origin,
    initialSearch.destination,
    initialSearch.date,
  ])

  const filtered = useMemo(
    () =>
      trips.filter((trip) => {
        const hour = Number(
          new Intl.DateTimeFormat("en-GB", {
            timeZone: "Asia/Colombo",
            hour: "2-digit",
            hour12: false,
          }).format(new Date(trip.departureAt))
        )
        return (
          (!maxFare || trip.fare <= Number(maxFare)) &&
          (period === "all" ||
            (period === "morning" && hour < 12) ||
            (period === "afternoon" && hour >= 12 && hour < 18) ||
            (period === "evening" && hour >= 18)) &&
          trip.availableSeats >= Number(minSeats)
        )
      }),
    [trips, maxFare, period, minSeats]
  )

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const from = origin.trim(),
      to = destination.trim()
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Colombo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date())
    if (!from || !to || !date)
      return setError("Enter an origin, destination and date.")
    if (from.toLowerCase() === to.toLowerCase())
      return setError("Origin and destination must be different.")
    if (date < today)
      return setError("Choose today or a future date in Sri Lanka.")
    setError("")
    router.push(
      `/trips?${new URLSearchParams({ origin: from, destination: to, date })}`
    )
  }

  return (
    <SiteShell>
      <div className="mb-9">
        <Badge className="mb-4 rounded-full bg-[#e7f1ff] text-[#256acb]">
          Your next move
        </Badge>
        <h1 className="text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
          Find your trip.
        </h1>
        <p className="mt-3 text-[#6b7b91]">
          Compare departure times, fares and available seats.
        </p>
      </div>
      <div className="grid gap-7 lg:grid-cols-[330px_minmax(0,1fr)]">
        <aside className="space-y-5">
          <Card className="rounded-[26px] border-[#e5ebf3] bg-white shadow-sm">
            <CardContent className="p-6">
              <div className="mb-5 flex items-center gap-2 font-semibold">
                <Search className="size-4 text-[#2d72d2]" /> Search
              </div>
              <form onSubmit={search} className="space-y-4">
                <div>
                  <Label htmlFor="origin">From</Label>
                  <div className="relative mt-2">
                    <MapPin className="pointer-events-none absolute top-3.5 left-3 size-4 text-[#7b95b5]" />
                    <Input
                      id="origin"
                      required
                      value={origin}
                      onChange={(event) => setOrigin(event.target.value)}
                      className="h-11 rounded-xl pl-9"
                      placeholder="Origin city"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="destination">To</Label>
                  <div className="relative mt-2">
                    <MapPin className="pointer-events-none absolute top-3.5 left-3 size-4 text-[#7b95b5]" />
                    <Input
                      id="destination"
                      required
                      value={destination}
                      onChange={(event) => setDestination(event.target.value)}
                      className="h-11 rounded-xl pl-9"
                      placeholder="Destination city"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="travel-date">Departure date</Label>
                  <div className="relative mt-2">
                    <CalendarDays className="pointer-events-none absolute top-3.5 left-3 size-4 text-[#7b95b5]" />
                    <Input
                      id="travel-date"
                      type="date"
                      required
                      value={date}
                      onChange={(event) => setDate(event.target.value)}
                      className="h-11 rounded-xl pl-9"
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  className="h-11 w-full rounded-full bg-[#236bcf] text-white"
                >
                  Search trips <ArrowRight className="size-4" />
                </Button>
              </form>
            </CardContent>
          </Card>
          <Card className="rounded-[26px] border-[#e5ebf3] bg-white shadow-sm">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center gap-2 font-semibold">
                <SlidersHorizontal className="size-4 text-[#2d72d2]" /> Filters
              </div>
              <div>
                <Label htmlFor="time-filter">Departure time</Label>
                <select
                  id="time-filter"
                  value={period}
                  onChange={(event) => setPeriod(event.target.value)}
                  className="mt-2 h-11 w-full rounded-xl border border-[#e2e8f1] bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-[#236bcf]"
                >
                  <option value="all">Any time</option>
                  <option value="morning">Morning, before 12:00</option>
                  <option value="afternoon">Afternoon, 12:00–17:59</option>
                  <option value="evening">Evening, after 18:00</option>
                </select>
              </div>
              <div>
                <Label htmlFor="fare-filter">Maximum fare (LKR)</Label>
                <Input
                  id="fare-filter"
                  type="number"
                  min="1"
                  value={maxFare}
                  onChange={(event) => setMaxFare(event.target.value)}
                  className="mt-2 h-11 rounded-xl"
                  placeholder="Any fare"
                />
              </div>
              <div>
                <Label htmlFor="seats-filter">Seats needed</Label>
                <Input
                  id="seats-filter"
                  type="number"
                  min="1"
                  max="100"
                  value={minSeats}
                  onChange={(event) => setMinSeats(event.target.value)}
                  className="mt-2 h-11 rounded-xl"
                />
              </div>
            </CardContent>
          </Card>
        </aside>
        <section aria-label="Matching trips" className="space-y-4">
          {error && (
            <p
              role="alert"
              className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              {error}
            </p>
          )}
          {loading ? (
            <p
              role="status"
              className="rounded-2xl bg-white p-8 text-[#64758d]"
            >
              Searching trips…
            </p>
          ) : null}
          {!loading && initialSearch.origin && !error && (
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {filtered.length} matching{" "}
                {filtered.length === 1 ? "trip" : "trips"}
              </h2>
              <span className="text-sm text-[#8493a7]">
                {initialSearch.origin} → {initialSearch.destination}
              </span>
            </div>
          )}
          {!loading && !initialSearch.origin && (
            <div className="rounded-[26px] border border-[#e5ebf3] bg-white p-10 text-center text-[#6b7b91]">
              Enter your route and date to see scheduled trips.
            </div>
          )}
          {!loading &&
            initialSearch.origin &&
            !error &&
            filtered.length === 0 && (
              <div className="rounded-[26px] border border-[#e5ebf3] bg-white p-10 text-center text-[#6b7b91]">
                No scheduled trips match these criteria. Try another date or
                adjust your filters.
              </div>
            )}
          {!loading &&
            filtered.map((trip) => (
              <Card
                key={trip.id}
                className="rounded-[26px] border-[#e5ebf3] bg-white shadow-[0_10px_30px_rgba(35,68,110,0.04)]"
              >
                <CardContent className="grid gap-5 p-6 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <Badge className="rounded-full bg-[#e7f1ff] text-[#256acb]">
                        {trip.routeName}
                      </Badge>
                      <span className="text-xs text-[#8b9ab0]">
                        {tripDate(trip.departureAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xl font-semibold tracking-[-0.03em] sm:text-2xl">
                      <span>{tripTime(trip.departureAt)}</span>
                      <span className="h-px w-10 bg-[#c6d6ea]" />
                      <span>{tripTime(trip.arrivalAt)}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-sm text-[#6a7b92]">
                      <MapPin className="size-4" /> {trip.origin} →{" "}
                      {trip.destination}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-4 text-xs text-[#8393a9]">
                      <span className="inline-flex items-center gap-1">
                        <BusFront className="size-3.5" /> {trip.vehicleType}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock3 className="size-3.5" /> {trip.availableSeats}{" "}
                        seats available
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-5 border-t border-[#edf1f6] pt-4 sm:block sm:border-0 sm:pt-0 sm:text-right">
                    <div>
                      <p className="text-xs text-[#8c9aad]">Per seat</p>
                      <p className="text-xl font-semibold text-[#1d3150]">
                        {lkr(trip.fare)}
                      </p>
                    </div>
                    <Link
                      href={`/trips/${trip.id}`}
                      className="inline-flex h-10 items-center gap-2 rounded-full bg-[#236bcf] px-5 text-sm font-medium text-white hover:bg-[#1d5db9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#236bcf]"
                    >
                      View trip <ArrowRight className="size-4" />
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
        </section>
      </div>
    </SiteShell>
  )
}
