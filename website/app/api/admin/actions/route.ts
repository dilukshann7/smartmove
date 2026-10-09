import { NextRequest } from "next/server"
import { adminRequest } from "@/lib/server/admin-api"
import { runAdminAction } from "@/lib/server/admin-mutations"

export const runtime = "nodejs"
export function POST(request: NextRequest) {
  return adminRequest(request, true, (connection, input) =>
    runAdminAction(connection, input)
  )
}
