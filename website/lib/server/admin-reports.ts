import "server-only"

import type { BindParameters, Connection } from "oracledb"
import { oracledb } from "./oracle"
import {
  reportDefinitions,
  sriLankaDate,
  type AdminReport,
  type ReportRow,
  type ReportType,
} from "../admin-reports"

const procedureCalls: Record<ReportType, string> = {
  popular_routes: "BEGIN smartmove_database.popular_routes; END;",
  revenue: "BEGIN smartmove_database.revenue; END;",
  passenger_history:
    "BEGIN smartmove_database.passenger_history(:passengerId); END;",
  maintenance_due:
    "BEGIN smartmove_database.maintenance_due(TO_DATE(:asOf, 'YYYY-MM-DD')); END;",
  trip_occupancy: "BEGIN smartmove_database.trip_occupancy; END;",
}

function outputNumber(value: string) {
  if (!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:E[+-]?\d+)?$/i.test(value))
    throw new Error("Unexpected numeric value in report procedure output.")
  const number = Number(value.replace(",", "."))
  if (!Number.isFinite(number))
    throw new Error("Unexpected numeric value in report procedure output.")
  return number
}

export function parseReportOutput(
  type: ReportType,
  lines: string[],
  passengerId: number | null
): ReportRow[] {
  function match(line: string, pattern: RegExp) {
    const result = pattern.exec(line)
    if (!result) throw new Error(`Unexpected ${type} procedure output.`)
    return result
  }
  if (type === "revenue") {
    const keys: Record<string, string> = {
      Payments: "payments",
      Refunds: "refunds",
      "Net revenue": "netRevenue",
    }
    const totals: ReportRow = {}
    for (const line of lines) {
      const result = match(line, /^(Payments|Refunds|Net revenue): (.+)$/)
      totals[keys[result[1]]] = outputNumber(result[2])
    }
    if (lines.length !== 3 || Object.keys(totals).length !== 3)
      throw new Error("Incomplete revenue procedure output.")
    return [totals]
  }
  return lines.map((line): ReportRow => {
    if (type === "popular_routes") {
      const result = match(line, /^([\s\S]*): (\d+) tickets$/)
      return { routeName: result[1], ticketsSold: outputNumber(result[2]) }
    }
    if (type === "passenger_history") {
      const result = match(
        line,
        /^Booking (\d+): ([\s\S]*), Seat (\d+), (PENDING|CONFIRMED|CANCELLED)$/
      )
      return {
        passengerId,
        bookingId: outputNumber(result[1]),
        routeName: result[2],
        seatNumber: outputNumber(result[3]),
        bookingStatus: result[4],
      }
    }
    if (type === "maintenance_due") {
      const result = match(line, /^Maintenance (\d+): ([\s\S]*?), ([\s\S]*)$/)
      return {
        maintenanceId: outputNumber(result[1]),
        vehicle: result[2],
        maintenanceType: result[3],
      }
    }
    const result = match(line, /^Trip (\d+): (\d+)\/(\d+) seats, (.+)%$/)
    return {
      tripId: outputNumber(result[1]),
      occupiedSeats: outputNumber(result[2]),
      totalSeats: outputNumber(result[3]),
      occupancyPercent: outputNumber(result[4]),
    }
  })
}

async function runReportProcedure(
  connection: Connection,
  type: ReportType,
  binds: BindParameters
) {
  const lines: string[] = []
  const batchSize = 100
  try {
    // Each request owns the output buffer on its existing admin connection.
    await connection.execute(
      "BEGIN DBMS_OUTPUT.DISABLE; DBMS_OUTPUT.ENABLE(NULL); END;"
    )
    await connection.execute(procedureCalls[type], binds)
    while (true) {
      const result = await connection.execute(
        "BEGIN DBMS_OUTPUT.GET_LINES(:lines, :lineCount); END;",
        {
          lines: {
            dir: oracledb.BIND_OUT,
            type: oracledb.STRING,
            maxArraySize: batchSize,
            maxSize: 32767,
          },
          lineCount: {
            dir: oracledb.BIND_INOUT,
            type: oracledb.NUMBER,
            val: batchSize,
          },
        }
      )
      const output = result.outBinds as {
        lines: (string | null)[]
        lineCount: number
      }
      lines.push(
        ...output.lines.slice(0, output.lineCount).map((line) => line ?? "")
      )
      if (output.lineCount < batchSize) break
    }
    return lines
  } finally {
    // Clear output before the pooled connection is used by another request.
    await connection.execute("BEGIN DBMS_OUTPUT.DISABLE; END;")
  }
}

export async function loadAdminReport(
  connection: Connection,
  type: ReportType,
  filters: { passengerId?: string | null; asOf?: string | null } = {}
): Promise<AdminReport> {
  let passengerId: number | null = null
  if (type === "passenger_history") {
    const value = filters.passengerId?.trim() ?? ""
    if (!/^\d+$/.test(value)) throw new Error("Enter a valid passenger ID.")
    passengerId = Number(value)
    if (!Number.isSafeInteger(passengerId) || passengerId < 1)
      throw new Error("Enter a valid passenger ID.")
  }
  const asOf = filters.asOf ?? sriLankaDate()
  if (type === "maintenance_due") {
    const parsed = new Date(`${asOf}T00:00:00Z`)
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(asOf) ||
      asOf.startsWith("0000-") ||
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== asOf
    )
      throw new Error("Choose a valid maintenance date.")
  }

  const binds: BindParameters =
    type === "passenger_history"
      ? { passengerId }
      : type === "maintenance_due"
        ? { asOf }
        : {}
  const lines = await runReportProcedure(connection, type, binds)
  return {
    type,
    ...reportDefinitions[type],
    rows: parseReportOutput(type, lines, passengerId),
    scope:
      type === "maintenance_due"
        ? `Due on or before ${asOf}`
        : type === "passenger_history"
          ? `Passenger #${passengerId} · all time`
          : "All time",
    generatedAt: new Date().toISOString(),
  }
}
