import { hasBearerToken } from "@/lib/server/auth-token"
import { NextRequest, NextResponse } from "next/server"
import { getPassenger } from "@/lib/server/auth"
import { getConnection } from "@/lib/server/oracle"
import { getAdmin } from "@/lib/server/admin-auth"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  let connection
  try {
    connection = await getConnection()
    const passenger = await getPassenger(request, connection)
    const admin = await getAdmin(request, connection)
    if (hasBearerToken(request) && !passenger && !admin)
      return NextResponse.json({ error: "Sign in again." }, { status: 401, headers: { "Cache-Control": "no-store" } })
    return NextResponse.json(
      { passenger, admin },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (error) {
    console.error("Session check failed", error)
    return NextResponse.json(
      { error: "Session check is temporarily unavailable." },
      { status: 503 }
    )
  } finally {
    await connection?.close()
  }
}
