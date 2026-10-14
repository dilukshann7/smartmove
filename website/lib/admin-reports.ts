import { lkr } from "./trip-format"

export const reportTypes = [
  "popular_routes",
  "revenue",
  "passenger_history",
  "maintenance_due",
  "trip_occupancy",
] as const

export type ReportType = (typeof reportTypes)[number]
export type ReportRow = Record<string, string | number | null>
export type ReportColumn = {
  key: string
  label: string
  format?: "currency" | "percent" | "datetime"
}
export type AdminReport = {
  type: ReportType
  title: string
  description: string
  columns: ReportColumn[]
  rows: ReportRow[]
  scope: string
  generatedAt: string
}

export const reportDefinitions: Record<
  ReportType,
  { title: string; description: string; columns: ReportColumn[] }
> = {
  popular_routes: {
    title: "Popular routes",
    description: "Routes ranked by issued tickets across all trips.",
    columns: [
      { key: "routeName", label: "Route" },
      { key: "ticketsSold", label: "Issued tickets" },
    ],
  },
  revenue: {
    title: "Revenue",
    description: "All recorded payments, refunds, and net revenue.",
    columns: [
      { key: "payments", label: "Payments (LKR)", format: "currency" },
      { key: "refunds", label: "Refunds (LKR)", format: "currency" },
      { key: "netRevenue", label: "Net revenue (LKR)", format: "currency" },
    ],
  },
  passenger_history: {
    title: "Passenger history",
    description: "Booking and ticket history for your selected passenger.",
    columns: [
      { key: "passengerId", label: "Passenger ID" },
      { key: "bookingId", label: "Booking ID" },
      { key: "routeName", label: "Route" },
      { key: "seatNumber", label: "Seat" },
      { key: "bookingStatus", label: "Booking status" },
    ],
  },
  maintenance_due: {
    title: "Maintenance due",
    description: "Scheduled maintenance due on or before your selected date.",
    columns: [
      { key: "maintenanceId", label: "Maintenance ID" },
      { key: "vehicle", label: "Vehicle" },
      { key: "maintenanceType", label: "Work" },
    ],
  },
  trip_occupancy: {
    title: "Trip occupancy",
    description:
      "Issued seats and occupancy for every trip. Pending holds are excluded.",
    columns: [
      { key: "tripId", label: "Trip ID" },
      { key: "occupiedSeats", label: "Issued seats" },
      { key: "totalSeats", label: "Total seats" },
      { key: "occupancyPercent", label: "Occupancy (%)", format: "percent" },
    ],
  },
}

export function sriLankaDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

export function formatReportValue(
  value: ReportRow[string],
  column: ReportColumn
) {
  if (value === null || value === undefined || value === "") return "—"
  if (column.format === "currency") return lkr(Number(value))
  if (column.format === "percent") return `${Number(value).toFixed(2)}%`
  if (column.format === "datetime") return String(value).replace("T", " ")
  return String(value)
}

function csvCell(value: ReportRow[string]) {
  let text = value == null ? "" : String(value)
  // Keep database text from being interpreted as a spreadsheet formula.
  if (typeof value === "string" && /^[\s]*[=+\-@]/.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}

export function createReportCsv(report: AdminReport) {
  const lines = [
    report.columns.map((column) => csvCell(column.label)).join(","),
    ...report.rows.map((row) =>
      report.columns.map((column) => csvCell(row[column.key])).join(",")
    ),
  ]
  // UTF-8 BOM lets spreadsheet apps open names and route text correctly.
  return `\uFEFF${lines.join("\r\n")}\r\n`
}
