import { NextRequest, NextResponse } from "next/server"
import { reportTypes, type ReportType } from "@/lib/admin-reports"
import { adminRequest } from "@/lib/server/admin-api"
import { loadAdminReport } from "@/lib/server/admin-reports"

export const runtime = "nodejs"

export function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type")
  if (!reportTypes.includes(type as ReportType))
    return NextResponse.json({ error: "Unknown report." }, { status: 400 })
  return adminRequest(request, false, (connection) =>
    loadAdminReport(connection, type as ReportType, {
      passengerId: request.nextUrl.searchParams.get("passengerId"),
      asOf: request.nextUrl.searchParams.get("asOf"),
    })
  )
}
