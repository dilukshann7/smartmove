import { NextRequest } from "next/server"
import { adminRequest } from "@/lib/server/admin-api"
import { loadAdminSummary } from "@/lib/server/admin-data"

export const runtime = "nodejs"
export function GET(request: NextRequest) {
  return adminRequest(request, false, (connection) =>
    loadAdminSummary(connection)
  )
}
