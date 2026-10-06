import { NextRequest, NextResponse } from "next/server"
import { getPassenger } from "@/lib/server/auth"
import { getConnection } from "@/lib/server/oracle"
import { loadPortalBookings, loadPortalTickets } from "@/lib/server/portal-data"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  let connection
  try {
    connection = await getConnection()
    const passenger = await getPassenger(request, connection)
    if (!passenger)
      return NextResponse.json(
        { error: "Sign in to view your dashboard." },
        { status: 401 }
      )
    const bookings = await loadPortalBookings(connection, passenger.id)
    const tickets = await loadPortalTickets(connection, passenger.id)
    return NextResponse.json(
      { passenger, bookings, tickets, serverNow: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (error) {
    console.error("Dashboard failed", error)
    return NextResponse.json(
      { error: "Dashboard is temporarily unavailable." },
      { status: 503 }
    )
  } finally {
    await connection?.close()
  }
}
