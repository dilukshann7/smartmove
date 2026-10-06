import { NextRequest, NextResponse } from "next/server"
import { getConnection } from "@/lib/server/oracle"
import { mapTrip, type TripRow } from "@/lib/trip-types"

export const runtime = "nodejs"

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const id = Number((await context.params).id)
  if (!Number.isSafeInteger(id) || id < 1) {
    return NextResponse.json({ error: "Invalid trip." }, { status: 400 })
  }
  let connection
  try {
    connection = await getConnection()
    const details = await connection.execute<TripRow>(
      `SELECT
        trip_id,
        route_name,
        origin,
        destination,
        TO_CHAR(departure_at, 'YYYY-MM-DD"T"HH24:MI:SS') || '+05:30' departure_at,
        TO_CHAR(arrival_at, 'YYYY-MM-DD"T"HH24:MI:SS') || '+05:30' arrival_at,
        fare,
        vehicle_type,
        registration_number,
        seat_count,
        available_seats
      FROM smartmove_database.web_trip_search
      WHERE
        trip_id = :id`,
      { id }
    )
    const row = details.rows?.[0]
    if (!row)
      return NextResponse.json(
        { error: "Trip not found or no longer bookable." },
        { status: 404 }
      )
    const seats = await connection.execute<{ SEAT_NUMBER: number }>(
      `SELECT
        tk.seat_number
      FROM smartmove_database.tickets tk
      JOIN smartmove_database.bookings b
        ON b.booking_id = tk.booking_id
      WHERE
        b.trip_id = :id
        AND (
          tk.status = 'ISSUED'
          OR (
            tk.status = 'RESERVED'
            AND b.status = 'PENDING'
            AND b.booked_at > SYSDATE - (30 / 1440)
          )
        )
      ORDER BY
        tk.seat_number`,
      { id }
    )
    return NextResponse.json(
      {
        trip: {
          ...mapTrip(row),
          occupiedSeats: (seats.rows ?? []).map((seat) => seat.SEAT_NUMBER),
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (error) {
    console.error("Trip details failed", error)
    return NextResponse.json(
      { error: "Trip details are temporarily unavailable." },
      { status: 503 }
    )
  } finally {
    await connection?.close()
  }
}
