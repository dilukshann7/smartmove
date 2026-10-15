"use client"

import { apiFetch } from "@/lib/client-auth"

import { useEffect, useState } from "react"
import {
  CalendarDays,
  Download,
  FileBarChart,
  LoaderCircle,
} from "lucide-react"
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
  createReportCsv,
  formatReportValue,
  reportDefinitions,
  reportTypes,
  sriLankaDate,
  type AdminReport,
  type ReportType,
} from "@/lib/admin-reports"

export function AdminReports({ refreshKey }: { refreshKey: number }) {
  const [selected, setSelected] = useState<ReportType>("popular_routes")
  const [passengerId, setPassengerId] = useState("")
  const [asOf, setAsOf] = useState(() => sriLankaDate())
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [report, setReport] = useState<AdminReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState<ReportType | null>(null)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [reloadKey, setReloadKey] = useState(0)
  const maintenanceDate = new Date(`${asOf}T12:00:00+05:30`)
  const needsPassenger = selected === "passenger_history" && !passengerId.trim()

  function reportUrl(type: ReportType) {
    const params = new URLSearchParams({ type })
    if (type === "passenger_history" && passengerId.trim())
      params.set("passengerId", passengerId.trim())
    if (type === "maintenance_due") params.set("asOf", asOf)
    return `/api/admin/reports?${params}`
  }

  const previewUrl = reportUrl(selected)
  useEffect(() => {
    if (needsPassenger) return
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoading(true)
      try {
        const response = await apiFetch(previewUrl, {
          cache: "no-store",
          signal: controller.signal,
        })
        const data = await response.json()
        if (!response.ok)
          throw new Error(data.error ?? "Unable to load report.")
        if (!controller.signal.aborted) {
          setReport(data.result)
          setError("")
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setReport(null)
          setError(
            cause instanceof Error ? cause.message : "Unable to load report."
          )
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 200)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [previewUrl, refreshKey, reloadKey, needsPassenger])

  function selectReport(type: ReportType) {
    setSelected(type)
    setReport(null)
    setLoading(true)
    setReloadKey((value) => value + 1)
    setError("")
    setNotice("")
  }

  async function exportReport(type: ReportType) {
    setExporting(type)
    setError("")
    setNotice("")
    try {
      const response = await apiFetch(reportUrl(type), { cache: "no-store" })
      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error ?? "Unable to export report.")
      const exported: AdminReport = data.result
      const url = URL.createObjectURL(
        new Blob([createReportCsv(exported)], {
          type: "text/csv;charset=utf-8",
        })
      )
      const link = document.createElement("a")
      link.href = url
      const filter =
        type === "passenger_history" && passengerId.trim()
          ? `-passenger-${passengerId.trim()}`
          : type === "maintenance_due"
            ? `-due-${asOf}`
            : ""
      link.download = `smartmove-${type.replaceAll("_", "-")}${filter}-${sriLankaDate(new Date(exported.generatedAt))}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setNotice(`${exported.title} exported (${exported.rows.length} rows).`)
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to export report."
      )
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {reportTypes.map((type) => {
          const definition = reportDefinitions[type]
          return (
            <Card
              key={type}
              className={`gap-0 rounded-[24px] bg-white py-0 shadow-sm ${selected === type ? "border-[#236bcf]" : "border-[#e5ebf3]"}`}
            >
              <CardContent className="flex h-full flex-col gap-0 p-4">
                <div className="flex items-center gap-2">
                  <FileBarChart className="size-5 shrink-0 text-[#236bcf]" />
                  <h2 className="text-base font-semibold">
                    {definition.title}
                  </h2>
                </div>
                <p className="mt-2 flex-1 text-sm leading-5 text-[#77879b]">
                  {definition.description}
                </p>
                <div className="mt-4 grid w-full grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    aria-pressed={selected === type}
                    aria-label={`View ${definition.title.toLowerCase()}`}
                    onClick={() => selectReport(type)}
                    className="h-9 w-full min-w-0 rounded-full"
                  >
                    View report
                  </Button>
                  <Button
                    size="sm"
                    disabled={
                      exporting !== null ||
                      (type === "passenger_history" && !passengerId.trim())
                    }
                    aria-label={`Export ${definition.title.toLowerCase()} as CSV`}
                    onClick={() => exportReport(type)}
                    className="h-9 w-full min-w-0 rounded-full bg-[#236bcf] text-white"
                  >
                    {exporting === type ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      <Download className="size-4" />
                    )}
                    {exporting === type ? "Exporting…" : "Export CSV"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="gap-0 overflow-hidden rounded-[26px] border-[#e5ebf3] bg-white py-0 shadow-sm">
        <CardContent className="gap-0 p-0">
          <div className="border-b border-[#eaf0f7] p-4 sm:p-5">
            <h2 className="text-xl font-semibold">
              {reportDefinitions[selected].title}
            </h2>
            <p className="mt-1 text-sm text-[#77879b]">
              {reportDefinitions[selected].description}
            </p>
            {selected === "passenger_history" && (
              <div className="mt-4 max-w-xs">
                <Label htmlFor="report-passenger">Passenger ID</Label>
                <Input
                  id="report-passenger"
                  type="number"
                  required
                  min="1"
                  step="1"
                  placeholder="Enter passenger ID"
                  value={passengerId}
                  onChange={(event) => {
                    setPassengerId(event.target.value)
                    setReport(null)
                    setLoading(true)
                    setNotice("")
                    setError("")
                  }}
                  className="mt-2 h-11 rounded-xl"
                />
                <p className="mt-2 text-xs text-[#77879b]">
                  Enter a passenger ID to view or export their history.
                </p>
              </div>
            )}
            {selected === "maintenance_due" && (
              <div className="mt-4 max-w-xs">
                <Label id="report-as-of-label" htmlFor="report-as-of">
                  Due on or before
                </Label>
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger
                    id="report-as-of"
                    type="button"
                    render={<Button variant="outline" />}
                    aria-labelledby="report-as-of-label report-as-of-value"
                    className="mt-2 h-10 w-full justify-start gap-2 rounded-xl text-left font-normal"
                  >
                    <CalendarDays
                      className="size-4 text-[#236bcf]"
                      aria-hidden="true"
                    />
                    <span id="report-as-of-value">
                      {new Intl.DateTimeFormat("en-LK", {
                        timeZone: "Asia/Colombo",
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      }).format(maintenanceDate)}
                    </span>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    className="w-auto rounded-2xl bg-white p-0 [--background:#fff] [--foreground:#1d1d1f] [--muted-foreground:#6b7f9c] [--muted:#eff6ff] [--primary-foreground:#fff] [--primary:#236bcf]"
                  >
                    <Calendar
                      mode="single"
                      required
                      autoFocus
                      timeZone="Asia/Colombo"
                      selected={maintenanceDate}
                      defaultMonth={maintenanceDate}
                      onSelect={(date) => {
                        const nextDate = sriLankaDate(date)
                        if (nextDate !== asOf) {
                          setAsOf(nextDate)
                          setReport(null)
                          setLoading(true)
                          setNotice("")
                        }
                        setCalendarOpen(false)
                      }}
                    />
                  </PopoverContent>
                </Popover>
                <p className="mt-2 text-xs text-[#77879b]">
                  Exports use this date.
                </p>
              </div>
            )}
            {report && !loading && (
              <p className="mt-3 text-xs text-[#77879b]">
                {report.scope} · {report.rows.length} rows · Generated{" "}
                {new Intl.DateTimeFormat("en-LK", {
                  timeZone: "Asia/Colombo",
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(report.generatedAt))}{" "}
                (Sri Lanka time)
              </p>
            )}
          </div>
          {error && (
            <p
              role="alert"
              className="m-4 rounded-xl bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </p>
          )}
          {notice && (
            <p
              role="status"
              className="m-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700"
            >
              {notice}
            </p>
          )}
          {needsPassenger ? (
            <p className="p-4 text-sm text-[#77879b]">
              Enter a passenger ID above to generate this report.
            </p>
          ) : loading ? (
            <p role="status" className="p-4 text-sm text-[#77879b]">
              Loading report…
            </p>
          ) : report ? (
            <div className="max-h-[560px] overflow-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <caption className="sr-only">
                  {report.title} · {report.scope}
                </caption>
                <thead className="sticky top-0 bg-[#f9fbfe]">
                  <tr className="border-b border-[#eaf0f7] text-xs text-[#71839a]">
                    {report.columns.map((column) => (
                      <th
                        key={column.key}
                        scope="col"
                        className="px-3 py-2.5 font-semibold"
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.rows.length ? (
                    report.rows.slice(0, 100).map((row, index) => (
                      <tr
                        key={index}
                        className="border-b border-[#edf1f6] last:border-0"
                      >
                        {report.columns.map((column) => (
                          <td key={column.key} className="px-3 py-2.5">
                            {formatReportValue(row[column.key], column)}
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={report.columns.length}
                        className="px-4 py-6 text-center text-[#8b9aae]"
                      >
                        No records match this report.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>
      <p className="text-xs text-[#77879b]">
        Previews show the first 100 rows. CSV exports include every matching row
        and open in Excel or Google Sheets. Amounts are in LKR.
      </p>
    </div>
  )
}
