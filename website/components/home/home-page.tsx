"use client"

import { apiFetch } from "@/lib/client-auth"

import { useEffect, useRef, useState, type FormEvent } from "react"
import Link from "next/link"
import { BrandLogo } from "@/components/site/brand-logo"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import {
  ArrowRight,
  ArrowUpRight,
  BusFront,
  CalendarDays,
  Check,
  Compass,
  MoveUpRight,
  ShieldCheck,
  ChevronRight,
  MapPin,
  Megaphone,
  Menu,
  Route,
  Search,
  Ticket,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

const featuredRoutes = [
  {
    number: "01",
    origin: "Colombo",
    destination: "Kandy",
    fare: 500,
    theme: "hills",
    caption: "A little closer to the hills.",
    region: "Hill country",
  },
  {
    number: "02",
    origin: "Colombo",
    destination: "Galle",
    fare: 800,
    theme: "coast",
    caption: "Take the scenic way south.",
    region: "South coast",
  },
] as const

const navigation = [
  { label: "Home", href: "#home" },
  { label: "Routes", href: "#featured-routes" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Announcements", href: "#announcements" },
] as const

type SearchErrors = { origin?: string; destination?: string; date?: string }

function sriLankaTodayKey() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? ""
  return `${part("year")}-${part("month")}-${part("day")}`
}

function dateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function goToSearch() {
  document.getElementById("trip-search")?.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
    block: "center",
  })
}

export function HomePage() {
  const router = useRouter()
  const [origin, setOrigin] = useState("")
  const [destination, setDestination] = useState("")
  const [departureDate, setDepartureDate] = useState<Date | undefined>()
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [signedIn, setSignedIn] = useState<"ADMIN" | "PASSENGER" | null>(null)
  const [announcements, setAnnouncements] = useState<
    { id: string; title: string; body: string; sample: boolean }[]
  >([])
  const [announcementsUnavailable, setAnnouncementsUnavailable] =
    useState(false)
  const [errors, setErrors] = useState<SearchErrors>({})
  const originRef = useRef<HTMLInputElement>(null)
  const destinationRef = useRef<HTMLInputElement>(null)
  const dateTriggerRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    apiFetch("/api/auth/me", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) =>
        setSignedIn(data.admin ? "ADMIN" : data.passenger ? "PASSENGER" : null)
      )
      .catch(() => setSignedIn(null))
    apiFetch("/api/announcements", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Announcements unavailable")
        const data = await response.json()
        setAnnouncements(data.announcements)
        setAnnouncementsUnavailable(false)
      })
      .catch(() => setAnnouncementsUnavailable(true))
  }, [])
  const links =
    signedIn === "ADMIN"
      ? [...navigation, { label: "Admin workspace", href: "/admin" }]
      : signedIn === "PASSENGER"
        ? [
            ...navigation,
            { label: "Dashboard", href: "/dashboard" },
            { label: "My bookings", href: "/bookings" },
          ]
        : navigation

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cleanOrigin = origin.trim()
    const cleanDestination = destination.trim()
    const nextErrors: SearchErrors = {}

    if (!cleanOrigin) nextErrors.origin = "Enter an origin city."
    if (!cleanDestination) nextErrors.destination = "Enter a destination city."
    if (
      cleanOrigin &&
      cleanDestination &&
      cleanOrigin.toLowerCase() === cleanDestination.toLowerCase()
    ) {
      nextErrors.destination = "Choose a destination different from the origin."
    }
    if (!departureDate) {
      nextErrors.date = "Choose a departure date."
    } else if (dateKey(departureDate) < sriLankaTodayKey()) {
      nextErrors.date = "Choose today or a future date in Sri Lanka."
    }

    setErrors(nextErrors)
    if (nextErrors.origin) originRef.current?.focus()
    else if (nextErrors.destination) destinationRef.current?.focus()
    else if (nextErrors.date) dateTriggerRef.current?.focus()
    else if (departureDate) {
      router.push(
        `/trips?${new URLSearchParams({ origin: cleanOrigin, destination: cleanDestination, date: dateKey(departureDate) })}`
      )
    }
  }

  function chooseFeaturedRoute(route: (typeof featuredRoutes)[number]) {
    setOrigin(route.origin)
    setDestination(route.destination)
    setErrors({})
    goToSearch()
    dateTriggerRef.current?.focus()
  }

  return (
    <div className="smartmove-home smartmove-landing">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <header className="smartmove-header">
        <div className="smartmove-nav">
          <Link
            href="/"
            className="smartmove-brand"
            aria-label="SmartMove home"
          >
            <BrandLogo />
            <span>
              SmartMove<span className="brand-dot">.</span>
            </span>
          </Link>
          <nav
            aria-label="Main navigation"
            className="hidden items-center gap-1 xl:flex"
          >
            {links.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="smartmove-nav-link"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="hidden items-center gap-3 xl:flex">
            <Link
              href={
                signedIn === "ADMIN"
                  ? "/admin"
                  : signedIn
                    ? "/dashboard"
                    : "/login"
              }
              className="smartmove-nav-link"
            >
              {signedIn === "ADMIN"
                ? "Admin"
                : signedIn
                  ? "Dashboard"
                  : "Sign in"}
            </Link>
            <Button onClick={goToSearch} className="smartmove-dark-button">
              Find a trip <ArrowUpRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger
              aria-label="Open navigation"
              className="smartmove-menu-button xl:hidden"
            >
              <Menu className="size-5" aria-hidden="true" />
            </SheetTrigger>
            <SheetContent
              side="right"
              className="smartmove-mobile-sheet w-[min(85vw,360px)]"
            >
              <SheetHeader>
                <SheetTitle>SmartMove.</SheetTitle>
              </SheetHeader>
              <nav
                aria-label="Mobile navigation"
                className="flex flex-col gap-2 p-4"
              >
                {links.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="smartmove-nav-link"
                  >
                    {item.label}
                  </a>
                ))}
                <Link
                  href={
                    signedIn === "ADMIN"
                      ? "/admin"
                      : signedIn
                        ? "/dashboard"
                        : "/login"
                  }
                  onClick={() => setMobileMenuOpen(false)}
                  className="smartmove-nav-link"
                >
                  {signedIn ? "Your workspace" : "Sign in"}
                </Link>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main id="main-content">
        <section
          id="home"
          aria-labelledby="hero-title"
          className="journey-hero section-anchor"
        >
          <div className="smartmove-container">
            <div className="journey-hero-grid">
              <div className="journey-hero-copy">
                <span className="journey-eyebrow">
                  <span className="status-dot" /> A better way to get there
                </span>
                <h1 id="hero-title">
                  Less planning.
                  <br />
                  <span>More going.</span>
                </h1>
                <p>
                  From the city to your next little escape. Find your trip, pick
                  your seat, and make your next move a good one.
                </p>
                <div className="journey-hero-actions">
                  <Button
                    onClick={goToSearch}
                    className="journey-primary-button"
                  >
                    Let’s find your ride{" "}
                    <ArrowUpRight className="size-4" aria-hidden="true" />
                  </Button>
                  <a href="#how-it-works" className="journey-text-link">
                    How it works{" "}
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </a>
                </div>
                <div className="journey-hero-assurance">
                  <ShieldCheck className="size-4" aria-hidden="true" />
                  <span>Your trip. Your seat. All in one place.</span>
                </div>
              </div>

              <div
                className="journey-board"
                aria-label="Explore sample journeys from Colombo to Kandy and Galle"
              >
                <div className="journey-board-top">
                  <span>
                    <Compass className="size-4" aria-hidden="true" /> ROOM TO
                    ROAM
                  </span>
                  <span>SRI LANKA</span>
                </div>
                <div className="journey-board-heading">
                  Good things
                  <br />
                  are on the way<span>.</span>
                </div>
                <svg
                  className="journey-map"
                  viewBox="0 0 520 400"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M-20 285C85 285 50 78 177 95S291 343 535 190"
                    className="map-road"
                  />
                  <path
                    d="M-15 340C103 270 163 370 227 242S370 75 546 120"
                    className="map-road"
                  />
                  <path
                    d="M137 410C130 300 332 250 293 145S348 3 412-20"
                    className="map-road"
                  />
                  <path
                    d="M-20 205C127 237 113 303 246 303S343 358 544 307"
                    className="map-road"
                  />
                  <path
                    d="M-30 70C78 110 135 33 248 39S368 31 546 69"
                    className="map-road"
                  />
                  <path
                    d="M144 237C232 237 162 126 325 126"
                    stroke="#b4d2ff"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M144 237C249 237 164 328 278 328"
                    stroke="#b4d2ff"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray="5 9"
                  />
                  <circle
                    cx="144"
                    cy="237"
                    r="22"
                    fill="#bdd8ff"
                    fillOpacity=".12"
                  />
                  <circle cx="144" cy="237" r="8" fill="white" />
                  <circle cx="144" cy="237" r="3" fill="#2667ee" />
                  <circle cx="325" cy="126" r="8" fill="white" />
                  <circle cx="325" cy="126" r="3" fill="#2667ee" />
                  <circle cx="278" cy="328" r="6" fill="white" />
                  <text x="79" y="273" className="map-city">
                    Colombo
                  </text>
                  <text x="342" y="132" className="map-city">
                    Kandy
                  </text>
                  <text x="296" y="334" className="map-city">
                    Galle
                  </text>
                </svg>
                <div className="journey-ticket-preview">
                  <span className="journey-ticket-icon">
                    <BusFront className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <span className="journey-ticket-label">
                      YOUR NEXT CHAPTER
                    </span>
                    <strong>
                      Colombo{" "}
                      <ArrowRight className="size-3" aria-hidden="true" /> Kandy
                    </strong>
                    <span className="journey-ticket-note">
                      Sample route · Hill country
                    </span>
                  </div>
                  <MoveUpRight
                    className="ml-auto size-5 text-[#2463eb]"
                    aria-hidden="true"
                  />
                </div>
                <span className="journey-board-bottom">
                  A small island. A world of possibilities.
                </span>
              </div>
            </div>

            <Card id="trip-search" className="smartmove-search-card">
              <CardContent className="journey-search-content">
                <div className="journey-search-heading">
                  <span>
                    <Search className="size-4" aria-hidden="true" /> Where are
                    we heading?
                  </span>
                  <span className="journey-live-label">
                    <span className="status-dot" /> Live trip search
                  </span>
                </div>
                <form
                  onSubmit={submitSearch}
                  noValidate
                  className="journey-search-form"
                >
                  <div className="journey-search-cities">
                    <div>
                      <Label
                        htmlFor="trip-origin"
                        className="mb-2 text-[13px] font-semibold text-[#4d5664]"
                      >
                        From
                      </Label>
                      <div className="relative">
                        <MapPin
                          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#5e91d1]"
                          aria-hidden="true"
                        />
                        <Input
                          ref={originRef}
                          id="trip-origin"
                          name="origin"
                          value={origin}
                          onChange={(event) => {
                            setOrigin(event.target.value)
                            setErrors((current) => ({
                              ...current,
                              origin: undefined,
                              destination: undefined,
                            }))
                          }}
                          onBlur={() => {
                            if (!origin.trim()) {
                              setErrors((current) => ({
                                ...current,
                                origin: "Enter an origin city.",
                              }))
                            }
                          }}
                          placeholder="Origin city"
                          autoComplete="off"
                          aria-required="true"
                          aria-invalid={Boolean(errors.origin)}
                          aria-describedby={
                            errors.origin ? "origin-error" : undefined
                          }
                          className="h-14 rounded-2xl border-transparent bg-[#f4f6f8] pl-10 text-[15px] shadow-none focus-visible:border-[#2d72d2] focus-visible:ring-[#2d72d2]/15 dark:bg-[#f4f6f8]"
                        />
                      </div>
                      {errors.origin && (
                        <p
                          id="origin-error"
                          role="alert"
                          className="mt-1.5 text-xs text-red-600"
                        >
                          {errors.origin}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label
                        htmlFor="trip-destination"
                        className="mb-2 text-[13px] font-semibold text-[#4d5664]"
                      >
                        To
                      </Label>
                      <div className="relative">
                        <MapPin
                          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#5e91d1]"
                          aria-hidden="true"
                        />
                        <Input
                          ref={destinationRef}
                          id="trip-destination"
                          name="destination"
                          value={destination}
                          onChange={(event) => {
                            setDestination(event.target.value)
                            setErrors((current) => ({
                              ...current,
                              destination: undefined,
                            }))
                          }}
                          onBlur={() => {
                            const cleanDestination = destination.trim()
                            if (!cleanDestination) {
                              setErrors((current) => ({
                                ...current,
                                destination: "Enter a destination city.",
                              }))
                            } else if (
                              cleanDestination.toLowerCase() ===
                              origin.trim().toLowerCase()
                            ) {
                              setErrors((current) => ({
                                ...current,
                                destination:
                                  "Choose a destination different from the origin.",
                              }))
                            }
                          }}
                          placeholder="Destination city"
                          autoComplete="off"
                          aria-required="true"
                          aria-invalid={Boolean(errors.destination)}
                          aria-describedby={
                            errors.destination ? "destination-error" : undefined
                          }
                          className="h-14 rounded-2xl border-transparent bg-[#f4f6f8] pl-10 text-[15px] shadow-none focus-visible:border-[#2d72d2] focus-visible:ring-[#2d72d2]/15 dark:bg-[#f4f6f8]"
                        />
                      </div>
                      {errors.destination && (
                        <p
                          id="destination-error"
                          role="alert"
                          className="mt-1.5 text-xs text-red-600"
                        >
                          {errors.destination}
                        </p>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label
                      htmlFor="trip-date"
                      className="mb-2 text-[13px] font-semibold text-[#4d5664]"
                    >
                      Departure date
                    </Label>
                    <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                      <PopoverTrigger
                        ref={dateTriggerRef}
                        id="trip-date"
                        type="button"
                        aria-required="true"
                        aria-invalid={Boolean(errors.date)}
                        aria-describedby={
                          errors.date ? "date-error" : undefined
                        }
                        className="flex h-14 w-full items-center gap-3 rounded-2xl border border-transparent bg-[#f4f6f8] px-3 text-left text-[15px] text-[#4d5664] transition-shadow outline-none focus-visible:border-[#2d72d2] focus-visible:ring-3 focus-visible:ring-[#2d72d2]/15 aria-invalid:border-red-500"
                      >
                        <CalendarDays
                          className="size-4 text-[#5e91d1]"
                          aria-hidden="true"
                        />
                        <span
                          className={
                            departureDate ? "text-[#203653]" : "text-[#8290a3]"
                          }
                        >
                          {departureDate
                            ? format(departureDate, "EEE, dd MMM yyyy")
                            : "Choose a date"}
                        </span>
                        <ChevronRight
                          className="ml-auto size-4 rotate-90 text-[#91a1b5]"
                          aria-hidden="true"
                        />
                      </PopoverTrigger>
                      <PopoverContent
                        align="start"
                        className="w-auto rounded-[20px] bg-white p-2 text-[#1d1d1f] shadow-[0_18px_60px_rgba(20,50,90,0.18)] [--background:#fff] [--foreground:#1d1d1f] [--muted-foreground:#6b7f9c] [--muted:#eff6ff] [--primary-foreground:#fff] [--primary:#236bcf] motion-reduce:animate-none"
                      >
                        <Calendar
                          mode="single"
                          selected={departureDate}
                          onSelect={(date) => {
                            setDepartureDate(date)
                            setErrors((current) => ({
                              ...current,
                              date: undefined,
                            }))
                            if (date) setCalendarOpen(false)
                          }}
                          disabled={(day) => dateKey(day) < sriLankaTodayKey()}
                        />
                      </PopoverContent>
                    </Popover>
                    {errors.date && (
                      <p
                        id="date-error"
                        role="alert"
                        className="mt-1.5 text-xs text-red-600"
                      >
                        {errors.date}
                      </p>
                    )}
                  </div>
                  <Button
                    type="submit"
                    className="h-13 w-full rounded-full bg-[#236bcf] text-[15px] font-semibold text-white shadow-[0_10px_24px_rgba(35,107,207,0.18)] transition-[background-color,transform] duration-150 hover:bg-[#1d5db9] active:scale-[0.985] motion-reduce:transform-none motion-reduce:transition-none"
                  >
                    Search trips{" "}
                    <ArrowRight className="ml-1 size-4" aria-hidden="true" />
                  </Button>
                </form>
                <p className="journey-search-note">
                  Explore schedules and available seats. Sign in when you’re
                  ready to book.
                </p>
              </CardContent>
            </Card>
            <div className="journey-quick-routes">
              <span>A little inspiration</span>
              {featuredRoutes.map((route) => (
                <button
                  key={route.number}
                  type="button"
                  onClick={() => chooseFeaturedRoute(route)}
                >
                  {route.origin}
                  <ArrowRight className="size-3" aria-hidden="true" />
                  {route.destination}
                  <ArrowUpRight className="size-3" aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
        </section>

        <section
          id="featured-routes"
          aria-labelledby="routes-title"
          className="journey-section section-anchor"
        >
          <div className="smartmove-container">
            <div className="journey-section-heading">
              <div>
                <p className="journey-kicker">THE JOURNEY IS THE GOOD PART</p>
                <h2 id="routes-title">Somewhere worth going.</h2>
                <p>Two routes to spark your next adventure.</p>
              </div>
              <Badge variant="secondary" className="journey-sample-badge">
                Sample routes &amp; fares
              </Badge>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              {featuredRoutes.map((route) => (
                <Card
                  key={route.number}
                  className={"journey-route-card journey-route-" + route.theme}
                >
                  <CardContent className="journey-route-content">
                    <div className="journey-route-top">
                      <span>
                        <MapPin className="size-3.5" aria-hidden="true" />{" "}
                        {route.region}
                      </span>
                      <span className="journey-route-number">
                          {route.number}
                      </span>
                    </div>
                    <div className="journey-route-line" aria-hidden="true">
                      <span />
                      <div />
                      <ArrowRight className="size-5" />
                      <div />
                      <span />
                    </div>
                    <h3>
                      {route.origin} <ArrowUpRight aria-hidden="true" />{" "}
                      {route.destination}
                    </h3>
                    <p>{route.caption}</p>
                    <div className="journey-route-footer">
                      <div>
                        <span>Example fare / person</span>
                        <strong>
                          LKR {route.fare.toLocaleString("en-LK")}
                        </strong>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => chooseFeaturedRoute(route)}
                        className="journey-route-button"
                      >
                        Explore route{" "}
                        <ArrowUpRight className="size-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section
          id="how-it-works"
          aria-labelledby="steps-title"
          className="journey-how section-anchor"
        >
          <div className="smartmove-container">
            <div className="journey-section-heading">
              <div>
                <p className="journey-kicker">LESS FRICTION. MORE FREEDOM.</p>
                <h2 id="steps-title">A few taps. You’re on your way.</h2>
                <p>A simple journey, from the very first step.</p>
              </div>
              <span className="journey-how-symbol" aria-hidden="true">
                <Route />
              </span>
            </div>
            <div className="journey-steps">
              {[
                {
                  number: "01",
                  title: "Find your trip",
                  description: "Choose your cities and the day you want to go.",
                  icon: Search,
                },
                {
                  number: "02",
                  title: "Make it your seat",
                  description:
                    "Compare trips and pick the seats that suit you.",
                  icon: BusFront,
                },
                {
                  number: "03",
                  title: "Save your spot",
                  description:
                    "Reserve your seats. Staff will record your payment.",
                  icon: Check,
                },
                {
                  number: "04",
                  title: "You’re good to go",
                  description: "Your ticket is ready once payment is recorded.",
                  icon: Ticket,
                },
              ].map((step) => (
                <div key={step.number} className="journey-step">
                  <div className="journey-step-top">
                    <span className="journey-step-icon">
                      <step.icon className="size-5" aria-hidden="true" />
                    </span>
                    <span>{step.number}</span>
                  </div>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </div>
              ))}
            </div>
            <p className="journey-payment-note">
              <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />{" "}
              Pending seats are held for 30 minutes. Payment is recorded by
              staff; online payment is not available.
            </p>
          </div>
        </section>

        <section
          id="announcements"
          aria-labelledby="announcements-title"
          className="journey-section section-anchor"
        >
          <div className="smartmove-container">
            <div className="journey-section-heading">
              <div>
                <p className="journey-kicker">BEFORE YOU GO</p>
                <h2 id="announcements-title">In the loop.</h2>
                <p>The latest updates for a smoother journey.</p>
              </div>
              <Megaphone className="size-6 text-[#8a94a6]" aria-hidden="true" />
            </div>
            {announcementsUnavailable || announcements.length === 0 ? (
              <div className="journey-empty-update">
                <span>
                  <Megaphone className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <h3>
                    {announcementsUnavailable
                      ? "Updates will be back soon."
                      : "You’re all caught up."}
                  </h3>
                  <p>
                    {announcementsUnavailable
                      ? "Announcements are temporarily unavailable. Please check again later."
                      : "No current announcements. Check back for service updates."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid gap-5 lg:grid-cols-2">
                {announcements.map((item) => (
                  <Card key={item.id} className="journey-announcement">
                    <CardContent className="p-7 sm:p-8">
                      <Badge variant="secondary" className="mb-4 w-fit">
                        {item.sample ? "Sample announcement" : "Service update"}
                      </Badge>
                      <h3 className="text-xl font-semibold tracking-tight">
                        {item.title}
                      </h3>
                      <p className="mt-3 text-sm leading-7 text-[#697386]">
                        {item.body}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="journey-final-cta" aria-labelledby="cta-title">
          <div className="smartmove-container">
            <div>
              <span className="journey-kicker">YOUR NEXT MOVE</span>
              <h2 id="cta-title">Go somewhere good.</h2>
              <p>Start with a destination. We’ll help with the rest.</p>
            </div>
            <Button onClick={goToSearch} className="journey-primary-button">
              Find your next trip{" "}
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </section>
      </main>
      <footer className="smartmove-footer">
        <div className="smartmove-container">
          <Link href="/" className="smartmove-brand">
            <BrandLogo />
            <span>
              SmartMove<span className="brand-dot">.</span>
            </span>
          </Link>
          <span>Made for the journey.</span>
          <span className="smartmove-footer-note">
            Coursework project · Sample content
          </span>
        </div>
      </footer>
    </div>
  )
}
