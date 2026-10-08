import { NextRequest, NextResponse } from "next/server"
import { getPassenger, sameOrigin } from "@/lib/server/auth"
import { getConnection } from "@/lib/server/oracle"
import { newRecordId } from "@/lib/server/record-id"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  let connection
  try {
    connection = await getConnection()
    const passenger = await getPassenger(request, connection)
    if (!passenger)
      return NextResponse.json(
        { error: "Sign in to view bookings." },
        { status: 401 }
      )
    const result = await connection.execute<{
      BOOKING_ID: number
      ORIGIN: string
      DESTINATION: string
      DEPARTURE_AT: string
      STATUS: string
      SEAT_COUNT: number
    }>(
      `SELECT
        b.booking_id,
        r.origin,
        r.destination,
        TO_CHAR(t.departure_at, 'YYYY-MM-DD"T"HH24:MI:SS') || '+05:30' departure_at,
        CASE
          WHEN b.status = 'PENDING'
            AND b.booked_at <= SYSDATE - (30 / 1440)
          THEN 'CANCELLED'
          ELSE b.status
        END status,
        (
          SELECT
            COUNT(*)
          FROM smartmove_database.tickets tk
          WHERE
            tk.booking_id = b.booking_id
        ) seat_count
      FROM smartmove_database.bookings b
      JOIN smartmove_database.trips t
        ON t.trip_id = b.trip_id
      JOIN smartmove_database.routes r
        ON r.route_id = t.route_id
      WHERE
        b.passenger_id = :passengerId
      ORDER BY
        b.booked_at DESC,
        b.booking_id DESC`,
      { passengerId: passenger.id }
    )
    return NextResponse.json(
      {
        bookings: (result.rows ?? []).map((row) => ({
          id: row.BOOKING_ID,
          origin: row.ORIGIN,
          destination: row.DESTINATION,
          departureAt: row.DEPARTURE_AT,
          status: row.STATUS,
          seatCount: row.SEAT_COUNT,
        })),
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (error) {
    console.error("Booking list failed", error)
    return NextResponse.json(
      { error: "Bookings are temporarily unavailable." },
      { status: 503 }
    )
  } finally {
    await connection?.close()
  }
}

export async function POST(request: NextRequest) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return NextResponse.json(
      { error: "Use JSON booking data." },
      { status: 415 }
    )
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 }
    )
  let input: Record<string, unknown>
  try {
    input = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid booking data." },
      { status: 400 }
    )
  }
  const tripId = input.tripId
  const seats = input.seats
  if (
    !Number.isSafeInteger(tripId) ||
    Number(tripId) < 1 ||
    !Array.isArray(seats) ||
    seats.length < 1 ||
    seats.length > 100 ||
    seats.some((seat) => !Number.isSafeInteger(seat) || seat < 1) ||
    new Set(seats).size !== seats.length
  ) {
    return NextResponse.json(
      { error: "Select at least one valid, distinct seat." },
      { status: 400 }
    )
  }

  let connection
  try {
    connection = await getConnection()
    const passenger = await getPassenger(request, connection)
    if (!passenger)
      return NextResponse.json(
        { error: "Sign in before booking." },
        { status: 401 }
      )
    const bookingId = newRecordId()
    await connection.execute(
      `BEGIN
        smartmove_database.create_booking(:bookingId, :passengerId, :tripId);
      END;`,
      { bookingId, passengerId: passenger.id, tripId: Number(tripId) }
    )
    for (const seat of seats) {
      const ticketId = newRecordId()
      await connection.execute(
        `BEGIN
          smartmove_database.reserve_seat(:ticketId, :bookingId, :seatNumber);
        END;`,
        { ticketId, bookingId, seatNumber: seat }
      )
    }
    await connection.commit()
    return NextResponse.json({ bookingId }, { status: 201 })
  } catch (error) {
    await connection?.rollback()
    if (
      error instanceof Error &&
      /ORA-2000[123]|ORA-01403/.test(error.message)
    ) {
      return NextResponse.json(
        {
          error:
            "The trip or one of your selected seats is no longer available. Refresh and try again.",
        },
        { status: 409 }
      )
    }
    console.error("Booking failed", error)
    return NextResponse.json(
      { error: "Booking is temporarily unavailable." },
      { status: 503 }
    )
  } finally {
    await connection?.close()
  }
}
