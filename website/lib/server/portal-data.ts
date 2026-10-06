import "server-only"

import type { Connection } from "oracledb"
import type { PortalBooking, PortalTicket } from "@/lib/portal-types"

export async function loadPortalBookings(
  connection: Connection,
  passengerId: number
): Promise<PortalBooking[]> {
  const result = await connection.execute<{
    BOOKING_ID: number
    TRIP_ID: number
    ORIGIN: string
    DESTINATION: string
    DEPARTURE_AT: string
    ARRIVAL_AT: string
    TRIP_STATUS: PortalBooking["tripStatus"]
    STATUS: PortalBooking["status"]
    SEAT_COUNT: number
    TOTAL_FARE: number
    CAN_CANCEL: number
    PAID_AMOUNT: number | null
    REFUND_AMOUNT: number | null
  }>(
    `SELECT
      b.booking_id,
      b.trip_id,
      r.origin,
      r.destination,
      TO_CHAR(t.departure_at, 'YYYY-MM-DD"T"HH24:MI:SS') || '+05:30' departure_at,
      TO_CHAR(t.arrival_at, 'YYYY-MM-DD"T"HH24:MI:SS') || '+05:30' arrival_at,
      t.status trip_status,
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
      ) seat_count,
      (
        SELECT
          NVL(SUM(tk.fare_amount), 0)
        FROM smartmove_database.tickets tk
        WHERE
          tk.booking_id = b.booking_id
      ) total_fare,
      CASE
        WHEN t.departure_at > SYSDATE
          AND b.status IN ('PENDING', 'CONFIRMED')
          AND (b.status = 'CONFIRMED' OR b.booked_at > SYSDATE - (30 / 1440))
        THEN 1
        ELSE 0
      END can_cancel,
      p.amount paid_amount,
      rf.amount refund_amount
    FROM smartmove_database.bookings b
    JOIN smartmove_database.trips t
      ON t.trip_id = b.trip_id
    JOIN smartmove_database.routes r
      ON r.route_id = t.route_id
    LEFT JOIN smartmove_database.payments p
      ON p.booking_id = b.booking_id
    LEFT JOIN smartmove_database.refunds rf
      ON rf.payment_id = p.payment_id
    WHERE
      b.passenger_id = :passengerId
    ORDER BY
      t.departure_at DESC,
      b.booking_id DESC`,
    { passengerId }
  )
  return (result.rows ?? []).map((row) => ({
    id: row.BOOKING_ID,
    tripId: row.TRIP_ID,
    origin: row.ORIGIN,
    destination: row.DESTINATION,
    departureAt: row.DEPARTURE_AT,
    arrivalAt: row.ARRIVAL_AT,
    tripStatus: row.TRIP_STATUS,
    status: row.STATUS,
    seatCount: row.SEAT_COUNT,
    totalFare: row.TOTAL_FARE,
    canCancel: row.CAN_CANCEL === 1,
    refundStatus:
      row.REFUND_AMOUNT != null
        ? "RECORDED"
        : row.STATUS === "CANCELLED" && row.PAID_AMOUNT != null
          ? "PENDING"
          : "NONE",
    refundAmount: row.REFUND_AMOUNT,
  }))
}

export async function loadPortalTickets(
  connection: Connection,
  passengerId: number
): Promise<PortalTicket[]> {
  const result = await connection.execute<{
    TICKET_ID: number
    BOOKING_ID: number
    SEAT_NUMBER: number
    FARE_AMOUNT: number
    ORIGIN: string
    DESTINATION: string
    DEPARTURE_AT: string
    ARRIVAL_AT: string
    VEHICLE_TYPE: string
    REGISTRATION_NUMBER: string
  }>(
    `SELECT
      tk.ticket_id,
      tk.booking_id,
      tk.seat_number,
      tk.fare_amount,
      r.origin,
      r.destination,
      TO_CHAR(t.departure_at, 'YYYY-MM-DD"T"HH24:MI:SS') || '+05:30' departure_at,
      TO_CHAR(t.arrival_at, 'YYYY-MM-DD"T"HH24:MI:SS') || '+05:30' arrival_at,
      v.vehicle_type,
      v.registration_number
    FROM smartmove_database.tickets tk
    JOIN smartmove_database.bookings b
      ON b.booking_id = tk.booking_id
    JOIN smartmove_database.trips t
      ON t.trip_id = b.trip_id
    JOIN smartmove_database.routes r
      ON r.route_id = t.route_id
    JOIN smartmove_database.vehicles v
      ON v.vehicle_id = t.vehicle_id
    WHERE
      b.passenger_id = :passengerId
      AND b.status = 'CONFIRMED'
      AND tk.status = 'ISSUED'
    ORDER BY
      t.departure_at DESC,
      tk.seat_number`,
    { passengerId }
  )
  return (result.rows ?? []).map((row) => ({
    id: row.TICKET_ID,
    bookingId: row.BOOKING_ID,
    seatNumber: row.SEAT_NUMBER,
    fare: row.FARE_AMOUNT,
    origin: row.ORIGIN,
    destination: row.DESTINATION,
    departureAt: row.DEPARTURE_AT,
    arrivalAt: row.ARRIVAL_AT,
    vehicleType: row.VEHICLE_TYPE,
    registrationNumber: row.REGISTRATION_NUMBER,
  }))
}
