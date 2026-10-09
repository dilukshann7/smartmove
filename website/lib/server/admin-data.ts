import "server-only";

import type { Connection } from "oracledb";
import { getMongoDb, type FeedbackContent } from "./mongo";

export const adminResources = [
  "routes",
  "trips",
  "vehicles",
  "drivers",
  "passengers",
  "maintenance",
  "bookings",
  "refunds",
  "feedback",
] as const;
export type AdminResource = (typeof adminResources)[number];

const queries: Record<
  Exclude<AdminResource, "feedback">,
  { select: string; filter: string; order: string }
> = {
  routes: {
    select: `SELECT
        r.route_id "id",
        r.route_name "name",
        r.origin "origin",
        r.destination "destination",
        r.base_fare "baseFare",
        (
          SELECT
            COUNT(*)
          FROM smartmove_database.trips t
          WHERE
            t.route_id = r.route_id
        ) "tripCount"
      FROM smartmove_database.routes r`,
    filter: `LOWER(r.route_name || ' ' || r.origin || ' ' || r.destination) LIKE :pattern`,
    order: `r.route_id DESC`,
  },
  trips: {
    select: `SELECT
        t.trip_id "id",
        t.route_id "routeId",
        r.route_name "routeName",
        r.origin "origin",
        r.destination "destination",
        t.vehicle_id "vehicleId",
        v.registration_number "vehicle",
        t.driver_id "driverId",
        d.full_name "driver",
        TO_CHAR(t.departure_at, 'YYYY-MM-DD"T"HH24:MI') "departureAt",
        TO_CHAR(t.arrival_at, 'YYYY-MM-DD"T"HH24:MI') "arrivalAt",
        t.fare "fare",
        t.status "status",
        (
          SELECT
            COUNT(*)
          FROM smartmove_database.bookings b
          WHERE
            b.trip_id = t.trip_id
        ) "bookingCount"
      FROM smartmove_database.trips t
      JOIN smartmove_database.routes r
        ON r.route_id = t.route_id
      JOIN smartmove_database.vehicles v
        ON v.vehicle_id = t.vehicle_id
      JOIN smartmove_database.drivers d
        ON d.driver_id = t.driver_id`,
    filter: `LOWER(r.route_name || ' ' || v.registration_number || ' ' || d.full_name || ' ' || TO_CHAR(t.trip_id)) LIKE :pattern`,
    order: `t.departure_at DESC, t.trip_id DESC`,
  },
  vehicles: {
    select: `SELECT
        v.vehicle_id "id",
        v.registration_number "registrationNumber",
        v.vehicle_type "vehicleType",
        v.seat_count "seatCount",
        v.status "status",
        (
          SELECT
            COUNT(*)
          FROM smartmove_database.trips t
          WHERE
            t.vehicle_id = v.vehicle_id
        ) "tripCount"
      FROM smartmove_database.vehicles v`,
    filter: `LOWER(v.registration_number || ' ' || v.vehicle_type) LIKE :pattern`,
    order: `v.vehicle_id DESC`,
  },
  drivers: {
    select: `SELECT
        d.driver_id "id",
        d.full_name "name",
        d.phone "phone",
        d.licence_number "licenceNumber",
        (
          SELECT
            COUNT(*)
          FROM smartmove_database.trips t
          WHERE
            t.driver_id = d.driver_id
        ) "tripCount"
      FROM smartmove_database.drivers d`,
    filter: `LOWER(d.full_name || ' ' || d.licence_number || ' ' || d.phone) LIKE :pattern`,
    order: `d.driver_id DESC`,
  },
  passengers: {
    select: `SELECT
        p.passenger_id "id",
        p.full_name "name",
        p.phone "phone",
        u.email "email",
        (
          SELECT
            COUNT(*)
          FROM smartmove_database.bookings b
          WHERE
            b.passenger_id = p.passenger_id
        ) "bookingCount"
      FROM smartmove_database.passengers p
      JOIN smartmove_database.app_users u
        ON u.user_id = p.user_id`,
    filter: `LOWER(p.full_name || ' ' || p.phone || ' ' || u.email) LIKE :pattern`,
    order: `p.passenger_id DESC`,
  },
  maintenance: {
    select: `SELECT
        m.maintenance_id "id",
        m.vehicle_id "vehicleId",
        v.registration_number "vehicle",
        m.maintenance_type "type",
        TO_CHAR(m.scheduled_date, 'YYYY-MM-DD') "scheduledDate",
        TO_CHAR(m.completed_date, 'YYYY-MM-DD') "completedDate",
        m.cost "cost",
        m.status "status"
      FROM smartmove_database.maintenance_records m
      JOIN smartmove_database.vehicles v
        ON v.vehicle_id = m.vehicle_id`,
    filter: `LOWER(v.registration_number || ' ' || m.maintenance_type) LIKE :pattern`,
    order: `m.scheduled_date DESC, m.maintenance_id DESC`,
  },
  bookings: {
    select: `SELECT
        b.booking_id "id",
        b.passenger_id "passengerId",
        p.full_name "passenger",
        b.trip_id "tripId",
        r.origin "origin",
        r.destination "destination",
        TO_CHAR(t.departure_at, 'YYYY-MM-DD"T"HH24:MI') "departureAt",
        CASE
          WHEN b.status = 'PENDING'
            AND b.booked_at <= SYSDATE - 30 / 1440
          THEN 'CANCELLED'
          ELSE b.status
        END "status",
        (
          SELECT
            COUNT(*)
          FROM smartmove_database.tickets tk
          WHERE
            tk.booking_id = b.booking_id
        ) "seatCount",
        (
          SELECT
            LISTAGG(tk.seat_number, ', ') WITHIN GROUP (ORDER BY tk.seat_number)
          FROM smartmove_database.tickets tk
          WHERE
            tk.booking_id = b.booking_id
        ) "seats",
        (
          SELECT
            LISTAGG(
              '#' || tk.ticket_id || ' seat ' || tk.seat_number || ' ' || CASE
                WHEN tk.status = 'RESERVED'
                  AND b.status = 'PENDING'
                  AND b.booked_at <= SYSDATE - 30 / 1440
                THEN 'CANCELLED'
                ELSE tk.status
              END, ', '
            ) WITHIN GROUP (ORDER BY tk.seat_number)
          FROM smartmove_database.tickets tk
          WHERE
            tk.booking_id = b.booking_id
        ) "tickets",
        (
          SELECT
            NVL(SUM(tk.fare_amount), 0)
          FROM smartmove_database.tickets tk
          WHERE
            tk.booking_id = b.booking_id
        ) "totalFare",
        py.payment_id "paymentId",
        py.amount "paidAmount",
        rf.amount "refundAmount"
      FROM smartmove_database.bookings b
      JOIN smartmove_database.passengers p
        ON p.passenger_id = b.passenger_id
      JOIN smartmove_database.trips t
        ON t.trip_id = b.trip_id
      JOIN smartmove_database.routes r
        ON r.route_id = t.route_id
      LEFT JOIN smartmove_database.payments py
        ON py.booking_id = b.booking_id
      LEFT JOIN smartmove_database.refunds rf
        ON rf.payment_id = py.payment_id`,
    filter: `LOWER(p.full_name || ' ' || r.origin || ' ' || r.destination || ' ' || TO_CHAR(b.booking_id)) LIKE :pattern`,
    order: `b.booking_id DESC`,
  },
  refunds: {
    select: `SELECT
        b.booking_id "id",
        p.full_name "passenger",
        py.payment_id "paymentId",
        py.amount "amount",
        r.origin "origin",
        r.destination "destination",
        TO_CHAR(py.paid_at, 'YYYY-MM-DD"T"HH24:MI') "paidAt"
      FROM smartmove_database.bookings b
      JOIN smartmove_database.passengers p
        ON p.passenger_id = b.passenger_id
      JOIN smartmove_database.payments py
        ON py.booking_id = b.booking_id
      JOIN smartmove_database.trips t
        ON t.trip_id = b.trip_id
      JOIN smartmove_database.routes r
        ON r.route_id = t.route_id
      LEFT JOIN smartmove_database.refunds rf
        ON rf.payment_id = py.payment_id`,
    filter: `b.status = 'CANCELLED'
      AND rf.refund_id IS NULL
      AND LOWER(p.full_name || ' ' || TO_CHAR(b.booking_id)) LIKE :pattern`,
    order: `b.booking_id DESC`,
  },
};

export async function loadAdminResource(
  connection: Connection,
  resource: AdminResource,
  search = "",
  offset = 0,
) {
  if (resource === "feedback")
    return loadAdminFeedback(connection, search, offset);
  const spec = queries[resource];
  const result = await connection.execute<Record<string, unknown>>(
    `${spec.select}
    WHERE
      ${spec.filter}
    ORDER BY
      ${spec.order}
    OFFSET :offset ROWS
    FETCH NEXT 50 ROWS ONLY`,
    { pattern: `%${search.toLowerCase()}%`, offset },
  );
  return result.rows ?? [];
}

async function loadAdminFeedback(
  connection: Connection,
  search: string,
  offset: number,
) {
  const result = await connection.execute<{
    id: number;
    bookingId: number;
    type: string;
    status: string;
    passenger: string;
    route: string;
  }>(
    `SELECT
      f.feedback_id "id",
      f.booking_id "bookingId",
      f.feedback_type "type",
      f.status "status",
      p.full_name "passenger",
      r.route_name "route"
    FROM smartmove_database.feedback_records f
    JOIN smartmove_database.bookings b
      ON b.booking_id = f.booking_id
    JOIN smartmove_database.passengers p
      ON p.passenger_id = b.passenger_id
    JOIN smartmove_database.trips t
      ON t.trip_id = b.trip_id
    JOIN smartmove_database.routes r
      ON r.route_id = t.route_id
    WHERE
      LOWER(p.full_name || ' ' || r.route_name || ' ' || TO_CHAR(f.feedback_id)) LIKE :pattern
    ORDER BY
      f.feedback_id DESC
    OFFSET :offset ROWS
    FETCH NEXT 50 ROWS ONLY`,
    { pattern: `%${search.toLowerCase()}%`, offset },
  );
  const rows = result.rows ?? [];
  if (!rows.length) return [];
  const db = await getMongoDb();
  const content = await db
    .collection<FeedbackContent>("feedback_content")
    .find({ feedbackId: { $in: rows.map((row) => String(row.id)) } })
    .toArray();
  const byId = new Map(content.map((item) => [item.feedbackId, item]));
  return rows.map((row) => ({
    ...row,
    comment: byId.get(String(row.id))?.comment ?? null,
    subject: byId.get(String(row.id))?.subject ?? null,
    vehicleRating: byId.get(String(row.id))?.vehicleRating ?? null,
    driverRating: byId.get(String(row.id))?.driverRating ?? null,
    reply: byId.get(String(row.id))?.reply?.message ?? null,
  }));
}

export async function loadAdminSummary(connection: Connection) {
  const result = await connection.execute<{
    upcomingTrips: number;
    bookingsThisMonth: number;
    grossRevenue: number;
    maintenanceDue: number;
    occupiedSeats: number;
    totalSeats: number;
  }>(
    `SELECT
      (
        SELECT
          COUNT(*)
        FROM smartmove_database.trips
        WHERE
          status = 'SCHEDULED'
          AND departure_at > SYSDATE
      ) "upcomingTrips",
      (
        SELECT
          COUNT(*)
        FROM smartmove_database.bookings
        WHERE
          booked_at >= TRUNC(SYSDATE, 'MM')
          AND booked_at < ADD_MONTHS(TRUNC(SYSDATE, 'MM'), 1)
      ) "bookingsThisMonth",
      (
        SELECT
          NVL(SUM(amount), 0)
        FROM smartmove_database.payments
        WHERE
          paid_at >= TRUNC(SYSDATE, 'MM')
          AND paid_at < ADD_MONTHS(TRUNC(SYSDATE, 'MM'), 1)
      ) "grossRevenue",
      (
        SELECT
          COUNT(*)
        FROM smartmove_database.maintenance_records
        WHERE
          status = 'SCHEDULED'
          AND scheduled_date < TRUNC(SYSDATE) + 8
      ) "maintenanceDue",
      (
        SELECT
          COUNT(*)
        FROM smartmove_database.tickets tk
        JOIN smartmove_database.bookings b
          ON b.booking_id = tk.booking_id
        JOIN smartmove_database.trips t
          ON t.trip_id = b.trip_id
        WHERE
          t.status = 'SCHEDULED'
          AND t.departure_at >= SYSDATE
          AND t.departure_at < SYSDATE + 7
          AND (
            tk.status = 'ISSUED'
            OR (tk.status = 'RESERVED' AND b.status = 'PENDING' AND b.booked_at > SYSDATE - 30 / 1440)
          )
      ) "occupiedSeats",
      (
        SELECT
          NVL(SUM(v.seat_count), 0)
        FROM smartmove_database.trips t
        JOIN smartmove_database.vehicles v
          ON v.vehicle_id = t.vehicle_id
        WHERE
          t.status = 'SCHEDULED'
          AND t.departure_at >= SYSDATE
          AND t.departure_at < SYSDATE + 7
      ) "totalSeats"
    FROM dual`,
  );
  const counts = result.rows?.[0];
  let recentFeedback: Awaited<ReturnType<typeof loadAdminFeedback>> = [];
  let feedbackUnavailable = false;
  try {
    recentFeedback = (await loadAdminFeedback(connection, "", 0)).slice(0, 5);
  } catch (error) {
    console.error("Admin feedback summary unavailable", error);
    feedbackUnavailable = true;
  }
  return {
    ...counts,
    recentFeedback,
    feedbackUnavailable,
  };
}
