import { NextRequest, NextResponse } from "next/server"
import { getPassenger } from "@/lib/server/auth"
import { getConnection } from "@/lib/server/oracle"
import type { Booking } from "@/lib/trip-types"

export const runtime = "nodejs"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const id = Number((await context.params).id)
  if (!Number.isSafeInteger(id) || id < 1) {
    return NextResponse.json({ error: "Invalid booking." }, { status: 400 })
  }
  let connection
  try {
    connection = await getConnection()
    const passenger = await getPassenger(request, connection)
    if (!passenger)
      return NextResponse.json(
        { error: "Sign in to view this booking." },
        { status: 401 }
      )
    const result = await connection.execute<{
      BOOKING_ID: number
      TRIP_ID: number
      ORIGIN: string
      DESTINATION: string
      DEPARTURE_AT: string
      ARRIVAL_AT: string
      VEHICLE_TYPE: string
      STATUS: Booking["status"]
      EXPIRES_AT: string
      CAN_CANCEL: number
    }>(
      `SELECT
        b.booking_id,
        b.trip_id,
        r.origin,
        r.destination,
        TO_CHAR(t.departure_at, 'YYYY-MM-DD"T"HH24:MI:SS') || '+05:30' departure_at,
        TO_CHAR(t.arrival_at, 'YYYY-MM-DD"T"HH24:MI:SS') || '+05:30' arrival_at,
        v.vehicle_type,
        CASE
          WHEN b.status = 'PENDING'
            AND b.booked_at <= SYSDATE - (30 / 1440)
          THEN 'CANCELLED'
          ELSE b.status
        END status,
        TO_CHAR(b.booked_at + (30 / 1440), 'YYYY-MM-DD"T"HH24:MI:SS') || '+05:30' expires_at,
        CASE
          WHEN t.departure_at > SYSDATE
            AND b.status IN ('PENDING', 'CONFIRMED')
            AND (b.status = 'CONFIRMED' OR b.booked_at > SYSDATE - (30 / 1440))
          THEN 1
          ELSE 0
        END can_cancel
      FROM smartmove_database.bookings b
      JOIN smartmove_database.trips t
        ON t.trip_id = b.trip_id
      JOIN smartmove_database.routes r
        ON r.route_id = t.route_id
      JOIN smartmove_database.vehicles v
        ON v.vehicle_id = t.vehicle_id
      WHERE
        b.booking_id = :id
        AND b.passenger_id = :passengerId`,
      { id, passengerId: passenger.id }
    )
    const row = result.rows?.[0]
    if (!row)
      return NextResponse.json({ error: "Booking not found." }, { status: 404 })
    const tickets = await connection.execute<{
      TICKET_ID: number
      SEAT_NUMBER: number
      FARE_AMOUNT: number
      STATUS: string
    }>(
      `SELECT
        ticket_id,
        seat_number,
        fare_amount,
        status
      FROM smartmove_database.tickets
      WHERE
        booking_id = :id
      ORDER BY
        seat_number`,
      { id }
    )
    const seats = (tickets.rows ?? []).map((seat) => ({
      id: seat.TICKET_ID,
      number: seat.SEAT_NUMBER,
      fare: seat.FARE_AMOUNT,
      status: row.STATUS === "CANCELLED" ? "CANCELLED" : seat.STATUS,
    }))
    const refund = await connection.execute<{
      PAID_AMOUNT: number | null; REFUND_AMOUNT: number | null
    }>(
      `SELECT
        p.amount paid_amount,
        r.amount refund_amount
      FROM smartmove_database.payments p
      LEFT JOIN smartmove_database.refunds r
        ON r.payment_id = p.payment_id
      WHERE
        p.booking_id = :id`,
      { id },
    )
    const paid = refund.rows?.[0]
    const booking: Booking = {
      id: row.BOOKING_ID,
      tripId: row.TRIP_ID,
      origin: row.ORIGIN,
      destination: row.DESTINATION,
      departureAt: row.DEPARTURE_AT,
      arrivalAt: row.ARRIVAL_AT,
      vehicleType: row.VEHICLE_TYPE,
      status: row.STATUS,
      expiresAt: row.EXPIRES_AT,
      seats,
      totalFare: seats.reduce((sum, seat) => sum + seat.fare, 0),
      canCancel: row.CAN_CANCEL === 1,
      refundStatus: paid?.REFUND_AMOUNT != null ? "RECORDED" :
        row.STATUS === "CANCELLED" && paid?.PAID_AMOUNT != null ? "PENDING" : "NONE",
      refundAmount: paid?.REFUND_AMOUNT ?? null,
    }
    return NextResponse.json(
      { booking },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (error) {
    console.error("Booking details failed", error)
    return NextResponse.json(
      { error: "Booking details are temporarily unavailable." },
      { status: 503 }
    )
  } finally {
    await connection?.close()
  }
}
