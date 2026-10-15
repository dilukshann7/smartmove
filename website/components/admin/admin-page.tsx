"use client"

import { apiFetch, logout as clearLogin } from "@/lib/client-auth"

import Link from "next/link"
import { BrandLogo } from "@/components/site/brand-logo"
import { useRouter } from "next/navigation"
import { useEffect, useState, type FormEvent } from "react"
import {
  ArrowRight,
  Bell,
  BusFront,
  CalendarDays,
  CreditCard,
  FileBarChart,
  ImagePlus,
  LayoutDashboard,
  LogOut,
  MapPinned,
  MessageSquareText,
  Plus,
  RefreshCw,
  Search,
  Ticket,
  Users,
  Wrench,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { DatePicker } from "@/components/ui/date-picker"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { lkr } from "@/lib/trip-format"
import { sriLankaDate } from "@/lib/admin-reports"
import { AdminReports } from "./admin-reports"
import { AdminMediaDialog } from "./admin-media-dialog"
import type { MediaResource } from "@/lib/media-types"

type Section =
  | "overview"
  | "routes"
  | "trips"
  | "vehicles"
  | "drivers"
  | "passengers"
  | "maintenance"
  | "bookings"
  | "refunds"
  | "feedback"
  | "reports"
  | "announcements"
type Row = Record<string, string | number | boolean | null>
type Field = {
  key: string
  label: string
  kind?: "number" | "date" | "datetime-local" | "select" | "textarea"
  options?: string[]
  lookup?: "routes" | "vehicles" | "drivers"
  createOnly?: boolean
  editOnly?: boolean
  min?: number
  max?: number
  step?: number
  maxLength?: number
}
type Config = {
  label: string
  columns: [string, string][]
  fields?: Field[]
  create?: boolean
  edit?: boolean
  remove?: boolean
}

const sections: { id: Section; label: string; icon: typeof LayoutDashboard }[] =
  [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "routes", label: "Routes", icon: MapPinned },
    { id: "trips", label: "Trip schedules", icon: CalendarDays },
    { id: "vehicles", label: "Vehicles", icon: BusFront },
    { id: "drivers", label: "Drivers", icon: Users },
    { id: "passengers", label: "Passengers", icon: Users },
    { id: "maintenance", label: "Maintenance", icon: Wrench },
    { id: "bookings", label: "Bookings & tickets", icon: Ticket },
    { id: "feedback", label: "Feedback", icon: MessageSquareText },
    { id: "reports", label: "Reports", icon: FileBarChart },
    { id: "announcements", label: "Announcements", icon: Bell },
  ]
const config: Record<Exclude<Section, "overview" | "reports">, Config> = {
  routes: {
    label: "Routes",
    columns: [
      ["name", "Route"],
      ["origin", "Origin"],
      ["destination", "Destination"],
      ["baseFare", "Base fare"],
      ["tripCount", "Trips"],
    ],
    create: true,
    edit: true,
    remove: true,
    fields: [
      { key: "name", label: "Route name" },
      { key: "origin", label: "Origin", createOnly: true, maxLength: 50 },
      {
        key: "destination",
        label: "Destination",
        createOnly: true,
        maxLength: 50,
      },
      {
        key: "baseFare",
        label: "Base fare (LKR)",
        kind: "number",
        min: 0.01,
        max: 99_999_999.99,
      },
    ],
  },
  trips: {
    label: "Trip schedules",
    columns: [
      ["routeName", "Route"],
      ["departureAt", "Departure"],
      ["arrivalAt", "Arrival"],
      ["vehicle", "Vehicle"],
      ["driver", "Driver"],
      ["fare", "Fare"],
      ["status", "Status"],
      ["bookingCount", "Bookings"],
    ],
    create: true,
    edit: true,
    remove: true,
    fields: [
      {
        key: "routeId",
        label: "Route",
        kind: "select",
        lookup: "routes",
        createOnly: true,
      },
      {
        key: "vehicleId",
        label: "Vehicle",
        kind: "select",
        lookup: "vehicles",
      },
      { key: "driverId", label: "Driver", kind: "select", lookup: "drivers" },
      {
        key: "departureAt",
        label: "Departure (Sri Lanka time)",
        kind: "datetime-local",
      },
      {
        key: "arrivalAt",
        label: "Arrival (Sri Lanka time)",
        kind: "datetime-local",
      },
    ],
  },
  vehicles: {
    label: "Vehicles",
    columns: [
      ["registrationNumber", "Registration"],
      ["vehicleType", "Type"],
      ["seatCount", "Seats"],
      ["status", "Status"],
      ["tripCount", "Trips"],
    ],
    create: true,
    edit: true,
    remove: true,
    fields: [
      { key: "registrationNumber", label: "Registration", maxLength: 20 },
      { key: "vehicleType", label: "Vehicle type", maxLength: 20 },
      {
        key: "seatCount",
        label: "Seat count",
        kind: "number",
        min: 1,
        max: 999,
        step: 1,
      },
      {
        key: "status",
        label: "Status",
        kind: "select",
        options: ["ACTIVE", "MAINTENANCE"],
        editOnly: true,
      },
    ],
  },
  drivers: {
    label: "Drivers",
    columns: [
      ["name", "Name"],
      ["phone", "Phone"],
      ["licenceNumber", "Licence"],
      ["tripCount", "Trips"],
    ],
    create: true,
    edit: true,
    remove: true,
    fields: [
      { key: "name", label: "Full name" },
      { key: "phone", label: "Phone", maxLength: 15 },
      { key: "licenceNumber", label: "Licence number", maxLength: 30 },
    ],
  },
  passengers: {
    label: "Passengers",
    columns: [
      ["name", "Name"],
      ["email", "Email"],
      ["phone", "Phone"],
      ["bookingCount", "Bookings"],
    ],
    edit: true,
    fields: [
      { key: "name", label: "Full name" },
      { key: "phone", label: "Phone", maxLength: 15 },
    ],
  },
  maintenance: {
    label: "Maintenance",
    columns: [
      ["vehicle", "Vehicle"],
      ["type", "Work"],
      ["scheduledDate", "Scheduled"],
      ["completedDate", "Completed"],
      ["cost", "Cost"],
      ["status", "Status"],
    ],
    create: true,
    edit: true,
    remove: true,
    fields: [
      {
        key: "vehicleId",
        label: "Vehicle",
        kind: "select",
        lookup: "vehicles",
        createOnly: true,
      },
      { key: "type", label: "Maintenance type" },
      { key: "scheduledDate", label: "Scheduled date", kind: "date" },
    ],
  },
  bookings: {
    label: "Bookings & tickets",
    columns: [
      ["id", "Booking"],
      ["passenger", "Passenger"],
      ["origin", "From"],
      ["destination", "To"],
      ["departureAt", "Departure"],
      ["seats", "Seats"],
      ["totalFare", "Fare"],
      ["status", "Status"],
      ["tickets", "Tickets"],
      ["refundAmount", "Refund recorded"],
    ],
  },
  refunds: {
    label: "Eligible refunds",
    columns: [
      ["id", "Booking"],
      ["passenger", "Passenger"],
      ["origin", "From"],
      ["destination", "To"],
      ["amount", "Full refund"],
      ["paidAt", "Paid at"],
    ],
  },
  feedback: {
    label: "Feedback",
    columns: [
      ["id", "ID"],
      ["passenger", "Passenger"],
      ["route", "Route"],
      ["type", "Type"],
      ["status", "Status"],
      ["subject", "Subject"],
      ["comment", "Message"],
      ["vehicleRating", "Vehicle"],
      ["driverRating", "Driver"],
      ["reply", "Staff reply"],
    ],
  },
  announcements: {
    label: "Announcements",
    columns: [
      ["title", "Title"],
      ["body", "Message"],
      ["status", "Status"],
    ],
    create: true,
    edit: true,
    fields: [
      { key: "title", label: "Title" },
      { key: "body", label: "Message", kind: "textarea" },
      {
        key: "status",
        label: "Publication",
        kind: "select",
        options: ["DRAFT", "PUBLISHED", "ARCHIVED"],
      },
    ],
  },
}
type Summary = {
  upcomingTrips: number
  bookingsThisMonth: number
  grossRevenue: number
  maintenanceDue: number
  occupiedSeats: number
  totalSeats: number
  recentFeedback: Row[]
  feedbackUnavailable?: boolean
}

function display(row: Row, key: string) {
  const value = row[key]
  if (value == null || value === "") return "—"
  if (
    [
      "baseFare",
      "fare",
      "totalFare",
      "amount",
      "refundAmount",
      "cost",
    ].includes(key)
  )
    return lkr(Number(value))
  if (["departureAt", "arrivalAt", "paidAt"].includes(key))
    return String(value).replace("T", " ")
  return String(value)
}

export function AdminPage({ email }: { email: string }) {
  const router = useRouter()
  const [section, setSection] = useState<Section>("overview")
  const [search, setSearch] = useState("")
  const [rows, setRows] = useState<Row[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [lookups, setLookups] = useState<Record<string, Row[]>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [edit, setEdit] = useState<{ row: Row | null } | null>(null)
  const [form, setForm] = useState<Row>({})
  const [action, setAction] = useState<{ name: string; row: Row } | null>(null)
  const [paymentMethod, setPaymentMethod] = useState("CASH")
  const [maintenanceCost, setMaintenanceCost] = useState("")
  const [feedbackReply, setFeedbackReply] = useState("")
  const [media, setMedia] = useState<{
    resource: MediaResource
    id: number
    label: string
  } | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (section === "reports") return
    const controller = new AbortController()
    const path =
      section === "overview"
        ? "/api/admin/summary"
        : section === "announcements"
          ? "/api/admin/announcements"
          : `/api/admin/${section}?q=${encodeURIComponent(search)}`
    apiFetch(path, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok)
          throw new Error(data.error ?? "Unable to load admin data.")
        if (section === "overview") setSummary(data.result)
        else setRows(data.result)
        setError("")
      })
      .catch((cause) => {
        if (cause.name !== "AbortError") setError(cause.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [section, search, refreshKey])

  async function loadLookups() {
    const results = await Promise.all(
      ["routes", "vehicles", "drivers"].map(async (name) => {
        const response = await apiFetch(`/api/admin/${name}`, {
          cache: "no-store",
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error)
        return [name, data.result] as const
      })
    )
    setLookups(Object.fromEntries(results))
  }
  function switchSection(next: Section) {
    setSection(next)
    setSearch("")
    setRows([])
    setLoading(next !== "reports")
    setError("")
    setNotice("")
  }
  function refresh() {
    if (section !== "reports") setLoading(true)
    setRefreshKey((value) => value + 1)
  }
  async function openEdit(row: Row | null) {
    setError("")
    setNotice("")
    setEdit({ row })
    setForm(
      row
        ? { ...row }
        : {
            status: section === "announcements" ? "DRAFT" : "ACTIVE",
            ...(section === "maintenance"
              ? { scheduledDate: sriLankaDate() }
              : {}),
          }
    )
    if (section === "trips" || section === "maintenance") {
      try {
        await loadLookups()
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Unable to load options."
        )
      }
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!edit || section === "overview") return
    setBusy(true)
    setError("")
    setNotice("")
    try {
      const response = await apiFetch(`/api/admin/${section}`, {
        method: edit.row ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setEdit(null)
      setNotice(edit.row ? "Record updated." : "Record created.")
      refresh()
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to save record."
      )
    } finally {
      setBusy(false)
    }
  }
  async function remove(row: Row) {
    if (
      !window.confirm(
        `Delete ${section.slice(0, -1)} #${row.id}? Records with related history cannot be deleted.`
      )
    )
      return
    setBusy(true)
    setError("")
    setNotice("")
    try {
      const response = await apiFetch(`/api/admin/${section}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setNotice("Record deleted.")
      refresh()
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to delete record."
      )
    } finally {
      setBusy(false)
    }
  }
  async function submitAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!action) return
    setBusy(true)
    setError("")
    setNotice("")
    try {
      const isFeedback = action.name.endsWith("_feedback")
      const response = await apiFetch(
        isFeedback ? "/api/admin/feedback" : "/api/admin/actions",
        {
          method: isFeedback ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: isFeedback
              ? action.name.replace("_feedback", "")
              : action.name,
            id: action.row.id,
            method: paymentMethod,
            cost: maintenanceCost,
            ...(isFeedback ? { message: feedbackReply } : {}),
          }),
        }
      )
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setAction(null)
      setNotice(
        action.name === "cancel_trip"
          ? `Trip cancelled; ${data.result.refundCount} full refund record(s) created.`
          : action.name === "record_refund" || action.name === "cancel_booking"
            ? "Refund recorded where payment existed. Actual payout happens outside SmartMove."
            : action.name === "reply_feedback"
              ? "Reply saved. The passenger can view it in Feedback."
              : action.name === "resolve_feedback"
                ? "Feedback marked as resolved."
                : action.name === "reopen_feedback"
                  ? "Feedback reopened."
                  : action.name === "complete_trip"
                    ? "Trip marked as completed. Passengers can now review their journey."
                    : "Action completed."
      )
      refresh()
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to complete action."
      )
    } finally {
      setBusy(false)
    }
  }
  async function archive(row: Row) {
    setBusy(true)
    setError("")
    try {
      const response = await apiFetch("/api/admin/announcements", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: row.id,
          title: row.title,
          body: row.body,
          status: "ARCHIVED",
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setNotice("Announcement archived.")
      refresh()
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to archive announcement."
      )
    } finally {
      setBusy(false)
    }
  }
  async function logout() {
    try { await clearLogin() }
    finally {
      router.push("/")
      router.refresh()
    }
  }
  const activeConfig =
    section === "overview" || section === "reports" ? null : config[section]
  return (
    <div className="smartmove-admin min-h-svh bg-[#f5f8fc] text-[#1d1d1f]">
      <header className="sticky top-0 z-30 border-b border-[#e4eaf2] bg-white/95 px-5 py-4 backdrop-blur sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-[1700px] items-center justify-between gap-3">
          <Link href="/" className="smartmove-brand">
            <BrandLogo />
            SmartMove<span className="text-[#2471d2]">.</span>
          </Link>
          <div className="flex items-center gap-3">
            <Badge className="hidden bg-[#eaf3ff] text-[#2869b8] sm:inline-flex">
              ADMIN
            </Badge>
            <span className="hidden max-w-48 truncate text-sm text-[#74849a] md:block">
              {email}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={logout}
              className="rounded-full"
            >
              <LogOut className="size-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1700px] gap-8 px-5 py-8 sm:px-8 lg:grid-cols-[230px_minmax(0,1fr)] lg:px-12 lg:py-10">
        <aside aria-label="Admin navigation" className="hidden lg:block">
          <nav className="sticky top-28 space-y-1 rounded-[24px] border border-[#e5ebf3] bg-white p-3 shadow-sm">
            {sections.map((item) => (
              <button
                key={item.id}
                onClick={() => switchSection(item.id)}
                aria-current={section === item.id ? "page" : undefined}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium focus-visible:outline-2 focus-visible:outline-[#236bcf] ${section === item.id ? "bg-[#eaf3ff] text-[#246bc7]" : "text-[#6c7b8e] hover:bg-[#f6f9fc]"}`}
              >
                <item.icon className="size-4" />
                {item.label}
              </button>
            ))}
          </nav>
        </aside>
        <main className="min-w-0">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <Badge className="mb-3 bg-[#e7f1ff] text-[#256acb]">
                Admin workspace
              </Badge>
              <h1 className="text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
                {section === "overview"
                  ? "Operations at a glance."
                  : section === "reports"
                    ? "Reports"
                    : activeConfig?.label}
              </h1>
              <p className="mt-2 text-sm text-[#77879b]">
                {section === "overview"
                  ? "Live transport and booking activity."
                  : section === "reports"
                    ? "View and export transport, revenue, and passenger reports."
                    : "Manage live SmartMove records."}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={refresh}
              disabled={loading}
              className="rounded-full"
            >
              <RefreshCw className="size-4" /> Refresh
            </Button>
          </div>
          <label
            htmlFor="admin-section"
            className="mb-2 block text-sm font-medium text-[#60758e] lg:hidden"
          >
            Section
          </label>
          <select
            id="admin-section"
            value={section}
            onChange={(event) => switchSection(event.target.value as Section)}
            className="mb-7 h-11 w-full rounded-xl border border-[#dfe7f1] bg-white px-3 lg:hidden"
          >
            {sections.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          {error && (
            <p
              role="alert"
              className="mb-5 rounded-2xl bg-red-50 p-4 text-sm text-red-700"
            >
              {error}
            </p>
          )}
          {notice && (
            <p
              role="status"
              className="mb-5 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-700"
            >
              {notice}
            </p>
          )}
          {loading && (
            <p
              role="status"
              className="rounded-2xl bg-white p-7 text-sm text-[#7d8ba0]"
            >
              Loading {section}…
            </p>
          )}
          {section === "reports" && <AdminReports refreshKey={refreshKey} />}
          {!loading && section === "overview" && summary && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {[
                  {
                    label: "Upcoming trips",
                    value: summary.upcomingTrips,
                    note: "Future scheduled trips",
                    icon: CalendarDays,
                  },
                  {
                    label: "Bookings",
                    value: summary.bookingsThisMonth,
                    note: "Created this month",
                    icon: Ticket,
                  },
                  {
                    label: "Gross revenue",
                    value: lkr(summary.grossRevenue),
                    note: "Payments this month, before refunds",
                    icon: CreditCard,
                  },
                  {
                    label: "Occupancy",
                    value: summary.totalSeats
                      ? `${Math.round((100 * summary.occupiedSeats) / summary.totalSeats)}%`
                      : "—",
                    note: `${summary.occupiedSeats}/${summary.totalSeats} seats · next 7 days`,
                    icon: BusFront,
                  },
                  {
                    label: "Maintenance due",
                    value: summary.maintenanceDue,
                    note: "Overdue and next 7 days",
                    icon: Wrench,
                  },
                  {
                    label: "Recent feedback",
                    value: summary.feedbackUnavailable
                      ? "—"
                      : summary.recentFeedback.length,
                    note: summary.feedbackUnavailable
                      ? "Temporarily unavailable"
                      : "Latest five items",
                    icon: MessageSquareText,
                  },
                ].map((card) => (
                  <Card
                    key={card.label}
                    className="rounded-[24px] border-[#e5ebf3] bg-white py-0 shadow-sm"
                  >
                    <CardContent className="flex flex-row items-start justify-between p-6">
                      <div>
                        <p className="text-sm text-[#74859a]">{card.label}</p>
                        <p className="mt-3 text-3xl font-semibold tracking-[-0.04em]">
                          {card.value}
                        </p>
                        <p className="mt-2 text-xs text-[#93a0af]">
                          {card.note}
                        </p>
                      </div>
                      <span className="grid size-10 place-items-center rounded-xl bg-[#eaf3ff] text-[#2b70c9]">
                        <card.icon className="size-5" />
                      </span>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Card className="mt-7 rounded-[26px] border-[#e5ebf3] bg-white shadow-sm">
                <CardContent className="p-6 sm:p-7">
                  <div className="mb-5 flex items-center justify-between">
                    <h2 className="text-xl font-semibold">Recent feedback</h2>
                    <button
                      onClick={() => switchSection("feedback")}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-[#236bcf]"
                    >
                      View all <ArrowRight className="size-4" />
                    </button>
                  </div>
                  {summary.feedbackUnavailable ? (
                    <p className="text-sm text-[#8291a4]">
                      Feedback is temporarily unavailable.
                    </p>
                  ) : summary.recentFeedback.length ? (
                    summary.recentFeedback.map((item) => (
                      <div
                        key={String(item.id)}
                        className="border-t border-[#edf1f6] py-4"
                      >
                        <p className="text-sm font-semibold">
                          #{item.id} · {item.passenger} · {item.type}
                        </p>
                        <p className="mt-1 text-sm text-[#6f8198]">
                          {item.comment ?? "No content available."}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-[#8291a4]">No feedback yet.</p>
                  )}
                </CardContent>
              </Card>
            </>
          )}
          {!loading && activeConfig && (
            <>
              <div className="mb-5 flex flex-wrap items-center gap-3">
                <div className="relative min-w-56 flex-1">
                  <Search className="absolute top-3.5 left-3 size-4 text-[#8a9aaf]" />
                  <Input
                    aria-label={`Search ${activeConfig.label}`}
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value)
                      setLoading(true)
                    }}
                    placeholder={`Search ${activeConfig.label.toLowerCase()}…`}
                    className="h-11 rounded-xl bg-white pl-10"
                  />
                </div>
                {activeConfig.create && (
                  <Button
                    onClick={() => openEdit(null)}
                    className="h-11 rounded-full bg-[#236bcf] text-white"
                  >
                    <Plus className="size-4" /> Add{" "}
                    {section === "maintenance"
                      ? "service"
                      : section === "announcements"
                        ? "announcement"
                        : section.slice(0, -1)}
                  </Button>
                )}
              </div>
              <Card className="overflow-hidden rounded-[26px] border-[#e5ebf3] bg-white py-0 shadow-sm">
                <CardContent className="p-0">
                  <div
                    className="overflow-x-auto"
                    role="region"
                    aria-label={`${activeConfig.label} table`}
                    tabIndex={0}
                  >
                    <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-[#eaf0f7] bg-[#f9fbfe] text-xs text-[#71839a]">
                          {activeConfig.columns.map(([key, label]) => (
                            <th key={key} className="px-4 py-4 font-semibold">
                              {label}
                            </th>
                          ))}
                          <th className="sticky right-0 z-10 w-52 min-w-52 border-l border-[#eaf0f7] bg-[#f9fbfe] px-4 py-4 font-semibold">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.length === 0 ? (
                          <tr>
                            <td
                              colSpan={activeConfig.columns.length + 1}
                              className="px-5 py-10 text-center text-[#8b9aae]"
                            >
                              No records found.
                            </td>
                          </tr>
                        ) : (
                          rows.map((row) => (
                            <tr
                              key={String(row.id)}
                              className="border-b border-[#edf1f6] align-top last:border-0 hover:bg-[#fbfdff]"
                            >
                              {activeConfig.columns.map(([key]) => (
                                <td key={key} className="px-4 py-4">
                                  {key === "tickets" && row.tickets ? (
                                    <ul className="w-64 space-y-2 text-xs leading-relaxed">
                                      {String(row.tickets)
                                        .split(", ")
                                        .map((ticket) => (
                                          <li
                                            key={ticket}
                                            className="rounded-lg bg-[#f5f8fc] px-2.5 py-2 break-words"
                                          >
                                            {ticket}
                                          </li>
                                        ))}
                                    </ul>
                                  ) : (
                                    <div
                                      className={`max-w-64 [overflow-wrap:anywhere] break-words whitespace-normal ${["comment", "body", "reply"].includes(key) ? "w-64 leading-relaxed" : ["subject", "routeName", "route", "passenger", "name", "email", "driver"].includes(key) ? "min-w-36" : "min-w-20"}`}
                                    >
                                      {display(row, key)}
                                    </div>
                                  )}
                                </td>
                              ))}
                              <td className="sticky right-0 z-10 w-52 min-w-52 border-l border-[#eaf0f7] bg-white px-4 py-3">
                                <div className="flex flex-wrap gap-1.5">
                                  {(section === "vehicles" ||
                                    section === "trips") && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled={busy}
                                      onClick={() =>
                                        setMedia({
                                          resource: section,
                                          id: Number(row.id),
                                          label: String(
                                            row.routeName ??
                                              row.registrationNumber ??
                                              row.id
                                          ),
                                        })
                                      }
                                    >
                                      <ImagePlus className="size-4" /> Images
                                    </Button>
                                  )}
                                  {activeConfig.edit &&
                                    (section !== "maintenance" ||
                                      row.status === "SCHEDULED") &&
                                    (section !== "trips" ||
                                      row.status === "SCHEDULED") && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => openEdit(row)}
                                        disabled={busy}
                                      >
                                        Edit
                                      </Button>
                                    )}
                                  {activeConfig.remove &&
                                    (section !== "maintenance" ||
                                      row.status === "SCHEDULED") &&
                                    (section !== "trips" ||
                                      row.status === "SCHEDULED") && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => remove(row)}
                                        disabled={busy}
                                      >
                                        Delete
                                      </Button>
                                    )}
                                  {section === "trips" &&
                                    row.status === "SCHEDULED" && (
                                      <>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          disabled={busy || !row.canComplete}
                                          title={
                                            row.canComplete
                                              ? "Mark this journey as completed"
                                              : "Available after the scheduled arrival time"
                                          }
                                          onClick={() =>
                                            setAction({
                                              name: "complete_trip",
                                              row,
                                            })
                                          }
                                        >
                                          Mark completed
                                        </Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          disabled={busy}
                                          onClick={() =>
                                            setAction({
                                              name: "cancel_trip",
                                              row,
                                            })
                                          }
                                        >
                                          Cancel
                                        </Button>
                                      </>
                                    )}
                                  {section === "maintenance" &&
                                    row.status === "SCHEDULED" && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          setAction({
                                            name: "complete_maintenance",
                                            row,
                                          })
                                        }
                                      >
                                        Complete
                                      </Button>
                                    )}
                                  {section === "bookings" && (
                                    <>
                                      {row.status === "PENDING" && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() =>
                                            setAction({
                                              name: "record_payment",
                                              row,
                                            })
                                          }
                                        >
                                          Record payment
                                        </Button>
                                      )}
                                      {(row.status === "PENDING" ||
                                        row.status === "CONFIRMED") && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() =>
                                            setAction({
                                              name: "cancel_booking",
                                              row,
                                            })
                                          }
                                        >
                                          Cancel
                                        </Button>
                                      )}
                                    </>
                                  )}
                                  {section === "refunds" && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        setAction({
                                          name: "record_refund",
                                          row,
                                        })
                                      }
                                    >
                                      Record refund
                                    </Button>
                                  )}
                                  {section === "passengers" && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        switchSection("bookings")
                                        setSearch(String(row.name))
                                        setLoading(true)
                                      }}
                                    >
                                      Bookings
                                    </Button>
                                  )}
                                  {section === "feedback" && (
                                    <>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={busy}
                                        onClick={() => {
                                          setFeedbackReply(
                                            String(row.reply ?? "")
                                          )
                                          setError("")
                                          setAction({
                                            name: "reply_feedback",
                                            row,
                                          })
                                        }}
                                      >
                                        {row.reply ? "Edit reply" : "Reply"}
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={busy}
                                        onClick={() => {
                                          setError("")
                                          setAction({
                                            name:
                                              row.status === "RESOLVED"
                                                ? "reopen_feedback"
                                                : "resolve_feedback",
                                            row,
                                          })
                                        }}
                                      >
                                        {row.status === "RESOLVED"
                                          ? "Reopen"
                                          : "Resolve"}
                                      </Button>
                                    </>
                                  )}
                                  {section === "announcements" &&
                                    row.status !== "ARCHIVED" && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => archive(row)}
                                      >
                                        Archive
                                      </Button>
                                    )}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
              {section === "bookings" && (
                <p className="mt-3 text-xs text-[#8b9bad]">
                  Ticket status follows booking and payment status; it cannot be
                  edited directly.
                </p>
              )}
              {section === "refunds" && (
                <p className="mt-3 text-xs text-[#8b9bad]">
                  Refund records represent full amounts. Actual payouts happen
                  outside SmartMove.
                </p>
              )}
              {section === "trips" && (
                <p className="mt-3 text-xs text-[#8b9bad]">
                  Use Mark completed after the scheduled arrival time. This
                  closes unpaid bookings and lets passengers review confirmed
                  journeys.
                </p>
              )}
            </>
          )}
        </main>
      </div>
      {media && (
        <AdminMediaDialog
          key={`${media.resource}-${media.id}`}
          target={media}
          onClose={() => setMedia(null)}
        />
      )}
      <Dialog
        open={edit !== null}
        onOpenChange={(open) => {
          if (!open) setEdit(null)
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {edit?.row ? "Edit" : "Add"} {activeConfig?.label.toLowerCase()}
            </DialogTitle>
            <DialogDescription>
              {section === "maintenance"
                ? "Choose today or a future day without scheduled trips for this vehicle."
                : section === "trips"
                  ? "Use future departure times and an available vehicle and driver. Trips with booking history cannot be rescheduled."
                  : "Update the details below and save your changes."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            {activeConfig?.fields
              ?.filter((field) =>
                edit?.row ? !field.createOnly : !field.editOnly
              )
              .map((field) => (
                <div key={field.key}>
                  <Label htmlFor={`admin-${field.key}`}>{field.label}</Label>
                  {field.kind === "textarea" ? (
                    <Textarea
                      id={`admin-${field.key}`}
                      required
                      minLength={10}
                      maxLength={1000}
                      value={String(form[field.key] ?? "")}
                      onChange={(event) =>
                        setForm({ ...form, [field.key]: event.target.value })
                      }
                      className="mt-2 min-h-32"
                    />
                  ) : field.kind === "select" ? (
                    <select
                      id={`admin-${field.key}`}
                      required
                      value={String(form[field.key] ?? "")}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          [field.key]: field.lookup
                            ? Number(event.target.value)
                            : event.target.value,
                        })
                      }
                      className="mt-2 h-11 w-full rounded-xl border border-[#dfe7f1] bg-white px-3"
                    >
                      <option value="">
                        Choose {field.label.toLowerCase()}
                      </option>
                      {field.lookup
                        ? (lookups[field.lookup] ?? []).map((item) => (
                            <option
                              key={String(item.id)}
                              value={String(item.id)}
                            >
                              {field.lookup === "routes"
                                ? `${item.name} (${item.origin} → ${item.destination})`
                                : field.lookup === "vehicles"
                                  ? `${item.registrationNumber} · ${item.seatCount} seats · ${item.status}`
                                  : `${item.name} · ${item.licenceNumber}`}
                            </option>
                          ))
                        : field.options?.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                    </select>
                  ) : field.kind === "date" ? (
                    <DatePicker
                      id={`admin-${field.key}`}
                      required
                      value={String(form[field.key] ?? "")}
                      minDate={sriLankaDate()}
                      onChange={(value) =>
                        setForm({ ...form, [field.key]: value })
                      }
                    />
                  ) : (
                    <Input
                      id={`admin-${field.key}`}
                      required
                      type={field.kind ?? "text"}
                      step={
                        field.kind === "number"
                          ? (field.step ?? 0.01)
                          : undefined
                      }
                      min={
                        field.min ??
                        (field.kind === "datetime-local"
                          ? `${sriLankaDate()}T00:00`
                          : undefined)
                      }
                      max={field.max}
                      maxLength={
                        field.maxLength ?? (field.kind ? undefined : 100)
                      }
                      value={String(form[field.key] ?? "")}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          [field.key]:
                            field.kind === "number"
                              ? Number(event.target.value)
                              : event.target.value,
                        })
                      }
                      className="mt-2 h-11 rounded-xl"
                    />
                  )}
                </div>
              ))}
            {error && (
              <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-700">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEdit(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={busy}
                className="bg-[#236bcf] text-white"
              >
                {busy ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={action !== null}
        onOpenChange={(open) => {
          if (!open) setAction(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{action?.name.replaceAll("_", " ")}</DialogTitle>
            <DialogDescription>
              {action?.name === "cancel_trip"
                ? "All active bookings will be cancelled and full refunds recorded for paid bookings in one transaction."
                : action?.name === "cancel_booking"
                  ? "All seats in this booking will be released. A full refund is recorded if paid."
                  : action?.name === "record_refund"
                    ? "Record the full eligible refund. Actual payout happens outside SmartMove."
                    : action?.name === "complete_trip"
                      ? "Mark this journey as completed. Unpaid bookings will be cancelled and passengers with confirmed bookings can leave a review."
                      : action?.name === "reply_feedback"
                        ? "Your reply will appear in the passenger's feedback history."
                        : action?.name === "resolve_feedback"
                          ? "Mark this feedback as resolved. The message and staff reply will be kept."
                          : action?.name === "reopen_feedback"
                            ? "Reopen this feedback for follow-up."
                            : "Confirm this operation."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitAction} className="space-y-4">
            {action?.name === "reply_feedback" && (
              <div className="space-y-3">
                <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl bg-[#f5f8fc] p-3 text-sm break-words whitespace-pre-wrap">
                  {action.row.subject && (
                    <p className="font-semibold">
                      {String(action.row.subject)}
                    </p>
                  )}
                  <p>{String(action.row.comment || "No message recorded.")}</p>
                </div>
                <Label htmlFor="feedback-reply">Staff reply</Label>
                <Textarea
                  id="feedback-reply"
                  required
                  maxLength={2000}
                  value={feedbackReply}
                  onChange={(event) => setFeedbackReply(event.target.value)}
                  placeholder="Write a reply to the passenger…"
                  className="min-h-32"
                />
              </div>
            )}
            {action?.name === "record_payment" && (
              <div>
                <Label htmlFor="payment-method">Payment method</Label>
                <select
                  id="payment-method"
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                  className="mt-2 h-11 w-full rounded-xl border border-[#dfe7f1] px-3"
                >
                  <option value="CASH">Cash</option>
                  <option value="CARD">Card</option>
                  <option value="BANK_TRANSFER">Bank transfer</option>
                </select>
                <p className="mt-2 text-xs text-[#8090a4]">
                  Full fare: {lkr(Number(action.row.totalFare))}. Tickets will
                  be issued after payment is recorded.
                </p>
              </div>
            )}
            {action?.name === "complete_maintenance" && (
              <div>
                <Label htmlFor="maintenance-cost">Cost (LKR)</Label>
                <Input
                  id="maintenance-cost"
                  type="number"
                  min="0"
                  step="0.01"
                  max="99999999.99"
                  required
                  value={maintenanceCost}
                  onChange={(event) => setMaintenanceCost(event.target.value)}
                  className="mt-2"
                />
              </div>
            )}
            {error && (
              <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-700">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAction(null)}
              >
                Back
              </Button>
              <Button
                type="submit"
                disabled={busy}
                className="bg-[#236bcf] text-white"
              >
                {busy ? "Working…" : "Confirm"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
