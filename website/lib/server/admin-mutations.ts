import "server-only";

import type { Connection } from "oracledb";
import { newRecordId } from "./record-id";
import { cancelPassengerBooking } from "./booking-actions";
import type { AdminResource } from "./admin-data";
import { sriLankaDate } from "../admin-reports";
import { getMongoDb, type FeedbackContent } from "./mongo";

type Form = Record<string, unknown>;
function string(value: unknown, label: string, max = 100) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    throw new Error(`Enter a valid ${label}.`);
  return value.trim();
}
function id(value: unknown, label = "record") {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1)
    throw new Error(`Choose a valid ${label}.`);
  return value;
}
function amount(value: unknown, label: string, allowZero = false) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    (allowZero ? value < 0 : value <= 0) ||
    value > 99_999_999.99
  )
    throw new Error(`Enter a valid ${label}.`);
  if (Math.abs(value * 100 - Math.round(value * 100)) > 0.000001)
    throw new Error(`Enter a valid ${label} with up to two decimal places.`);
  return value;
}
function localDate(value: unknown, time = false) {
  const text = string(value, "date", 20);
  if (
    !(time ? /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/ : /^\d{4}-\d{2}-\d{2}$/).test(
      text,
    )
  )
    throw new Error("Choose a valid Sri Lanka date and time.");
  const parsed = new Date(time ? `${text}:00Z` : `${text}T00:00:00Z`);
  if (
    text.startsWith("0000-") ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, text.length) !== text
  )
    throw new Error("Choose a valid Sri Lanka date and time.");
  return text;
}
export async function mutateAdminResource(
  connection: Connection,
  resource: AdminResource,
  method: string,
  form: Form,
) {
  const recordId = method === "POST" ? null : id(form.id);
  if (resource === "feedback") {
    if (method !== "PATCH")
      throw new Error("Unknown admin feedback operation.");
    const operation = form.action;
    if (!["reply", "resolve", "reopen"].includes(String(operation)))
      throw new Error("Choose a valid feedback action.");
    const message =
      operation === "reply" ? string(form.message, "reply", 2000) : "";
    const result = await connection.execute<{ STATUS: string }>(
      `SELECT status FROM smartmove_database.feedback_records
       WHERE feedback_id = :id FOR UPDATE`,
      { id: recordId },
    );
    if (!result.rows?.[0])
      throw new Error("This action requires existing feedback.");
    if (operation === "reply") {
      const db = await getMongoDb();
      // Keep the passenger's original feedback and ratings intact.
      await db.collection<FeedbackContent>("feedback_content").updateOne(
        { feedbackId: String(recordId) },
        {
          $set: {
            reply: {
              staffName: "SmartMove admin",
              message,
              repliedAt: new Date(),
            },
          },
          $setOnInsert: { comment: "" },
        },
        { upsert: true },
      );
      return { replied: true };
    }
    const status = operation === "resolve" ? "RESOLVED" : "OPEN";
    await connection.execute(
      `BEGIN smartmove_database.update_feedback_status(:id, :status); END;`,
      { id: recordId, status },
    );
    return { status };
  }
  if (resource === "routes") {
    const name = method === "DELETE" ? "" : string(form.name, "route name");
    const fare = method === "DELETE" ? 0 : amount(form.baseFare, "fare");
    if (method === "POST") {
      const created = newRecordId();
      const origin = string(form.origin, "origin", 50);
      const destination = string(form.destination, "destination", 50);
      if (origin.toUpperCase() === destination.toUpperCase())
        throw new Error("Choose different origin and destination locations.");
      await connection.execute(
        `BEGIN
          smartmove_database.add_route(
            :id,
            :name,
            :origin,
            :destination,
            :fare
          );
        END;`,
        {
          id: created,
          name,
          origin,
          destination,
          fare,
        },
      );
      return { id: created };
    }
    if (method === "PATCH")
      await connection.execute(
        `BEGIN
          smartmove_database.update_route(:id, :name, :fare);
        END;`,
        { id: recordId, name, fare },
      );
    if (method === "DELETE")
      await connection.execute(
        `BEGIN
          smartmove_database.delete_route(:id);
        END;`,
        { id: recordId },
      );
  } else if (resource === "vehicles") {
    if (method === "DELETE")
      await connection.execute(
        `BEGIN
          smartmove_database.delete_vehicle(:id);
        END;`,
        { id: recordId },
      );
    else {
      const registration = string(form.registrationNumber, "registration", 20);
      const vehicleType = string(form.vehicleType, "vehicle type", 20);
      const seats = id(form.seatCount, "seat count");
      if (seats > 999) throw new Error("Enter a seat count between 1 and 999.");
      if (method === "POST") {
        const created = newRecordId();
        await connection.execute(
          `BEGIN
            smartmove_database.add_vehicle(
              :id,
              :registration,
              :vehicleType,
              :seats
            );
          END;`,
          { id: created, registration, vehicleType, seats },
        );
        return { id: created };
      }
      if (form.status !== "ACTIVE" && form.status !== "MAINTENANCE")
        throw new Error("Choose a vehicle status.");
      await connection.execute(
        `BEGIN
          smartmove_database.update_vehicle(
            :id,
            :registration,
            :vehicleType,
            :seats,
            :status
          );
        END;`,
        { id: recordId, registration, vehicleType, seats, status: form.status },
      );
    }
  } else if (resource === "drivers") {
    if (method === "DELETE")
      await connection.execute(
        `BEGIN
          smartmove_database.delete_driver(:id);
        END;`,
        { id: recordId },
      );
    else {
      const name = string(form.name, "driver name");
      const phone = string(form.phone, "phone", 15);
      const licence = string(form.licenceNumber, "licence number", 30);
      if (method === "POST") {
        const created = newRecordId();
        await connection.execute(
          `BEGIN
            smartmove_database.add_driver(
              :id,
              :name,
              :phone,
              :licence
            );
          END;`,
          { id: created, name, phone, licence },
        );
        return { id: created };
      }
      await connection.execute(
        `BEGIN
          smartmove_database.update_driver(
            :id,
            :name,
            :phone,
            :licence
          );
        END;`,
        { id: recordId, name, phone, licence },
      );
    }
  } else if (resource === "trips") {
    if (method === "DELETE")
      await connection.execute(
        `BEGIN
          smartmove_database.delete_trip(:id);
        END;`,
        {
          id: recordId,
        },
      );
    else {
      const vehicleId = id(form.vehicleId, "vehicle");
      const driverId = id(form.driverId, "driver");
      const departureAt = localDate(form.departureAt, true);
      const arrivalAt = localDate(form.arrivalAt, true);
      if (arrivalAt <= departureAt)
        throw new Error("Choose an arrival time after departure.");
      if (method === "POST") {
        const created = newRecordId();
        await connection.execute(
          `BEGIN
            smartmove_database.schedule_trip(
              :id,
              :routeId,
              :vehicleId,
              :driverId,
              TO_DATE(:departureAt, 'YYYY-MM-DD"T"HH24:MI'),
              TO_DATE(:arrivalAt, 'YYYY-MM-DD"T"HH24:MI')
            );
          END;`,
          {
            id: created,
            routeId: id(form.routeId, "route"),
            vehicleId,
            driverId,
            departureAt,
            arrivalAt,
          },
        );
        return { id: created };
      }
      await connection.execute(
        `BEGIN
          smartmove_database.reschedule_trip(
            :id,
            :vehicleId,
            :driverId,
            TO_DATE(:departureAt, 'YYYY-MM-DD"T"HH24:MI'),
            TO_DATE(:arrivalAt, 'YYYY-MM-DD"T"HH24:MI')
          );
        END;`,
        { id: recordId, vehicleId, driverId, departureAt, arrivalAt },
      );
    }
  } else if (resource === "maintenance") {
    if (method === "DELETE")
      await connection.execute(
        `BEGIN
          smartmove_database.delete_maintenance(:id);
        END;`,
        { id: recordId },
      );
    else {
      const type = string(form.type, "maintenance type");
      const scheduledDate = localDate(form.scheduledDate);
      if (scheduledDate < sriLankaDate())
        throw new Error("Choose today or a future date for maintenance.");
      if (method === "POST") {
        const created = newRecordId();
        await connection.execute(
          `BEGIN
            smartmove_database.schedule_maintenance(
              :id,
              :vehicleId,
              :type,
              TO_DATE(:scheduledDate, 'YYYY-MM-DD')
            );
          END;`,
          {
            id: created,
            vehicleId: id(form.vehicleId, "vehicle"),
            type,
            scheduledDate,
          },
        );
        return { id: created };
      }
      await connection.execute(
        `BEGIN
          smartmove_database.update_maintenance(:id, :type, TO_DATE(:scheduledDate, 'YYYY-MM-DD'));
        END;`,
        { id: recordId, type, scheduledDate },
      );
    }
  } else if (resource === "passengers" && method === "PATCH") {
    await connection.execute(
      `BEGIN
        smartmove_database.update_passenger(:id, :name, :phone);
      END;`,
      {
        id: recordId,
        name: string(form.name, "passenger name"),
        phone: string(form.phone, "phone", 15),
      },
    );
  } else throw new Error("This action is not available for this record.");
  return { id: recordId };
}

export async function runAdminAction(connection: Connection, input: Form) {
  const action = string(input.action, "action", 40);
  const bookingId =
    action.includes("booking") ||
    action === "record_payment" ||
    action === "record_refund"
      ? id(input.id, "booking")
      : null;
  if (action === "record_payment") {
    if (!["CASH", "CARD", "BANK_TRANSFER"].includes(String(input.method)))
      throw new Error("Choose a payment method.");
    const total = await connection.execute<{ AMOUNT: number | null }>(
      `SELECT
        SUM(fare_amount) amount
      FROM smartmove_database.tickets
      WHERE
        booking_id = :id
        AND status = 'RESERVED'`,
      { id: bookingId },
    );
    const paidAmount = total.rows?.[0]?.AMOUNT;
    if (paidAmount == null)
      throw new Error("This action requires reserved seats.");
    const paymentId = newRecordId();
    await connection.execute(
      `BEGIN
        smartmove_database.record_payment(
          :paymentId,
          :id,
          :amount,
          :method
        );
      END;`,
      {
        id: bookingId,
        method: String(input.method),
        paymentId,
        amount: paidAmount,
      },
    );
    return { paymentId, amount: paidAmount };
  }
  if (action === "cancel_booking") {
    const booking = await connection.execute<{ PASSENGER_ID: number }>(
      `SELECT
        passenger_id
      FROM smartmove_database.bookings
      WHERE
        booking_id = :id`,
      { id: bookingId },
    );
    const passengerId = booking.rows?.[0]?.PASSENGER_ID;
    if (!passengerId)
      throw new Error("This action requires an existing booking.");
    return cancelPassengerBooking(connection, bookingId!, passengerId);
  }
  if (action === "record_refund") {
    const booking = await connection.execute<{ STATUS: string }>(
      `SELECT
        status
      FROM smartmove_database.bookings
      WHERE
        booking_id = :id
      FOR UPDATE`,
      { id: bookingId },
    );
    if (booking.rows?.[0]?.STATUS !== "CANCELLED")
      throw new Error("This action requires a cancelled booking.");
    const payment = await connection.execute<{
      PAYMENT_ID: number;
      AMOUNT: number;
      REFUND_ID: number | null;
    }>(
      `SELECT
        p.payment_id,
        p.amount,
        r.refund_id
      FROM smartmove_database.payments p
      LEFT JOIN smartmove_database.refunds r
        ON r.payment_id = p.payment_id
      WHERE
        p.booking_id = :id`,
      { id: bookingId },
    );
    const row = payment.rows?.[0];
    if (!row) throw new Error("This action requires a paid booking.");
    if (row.REFUND_ID != null) return { changed: 0, amount: row.AMOUNT };
    await connection.execute(
      `BEGIN
        smartmove_database.process_refund(:refundId, :paymentId, :reason);
      END;`,
      {
        refundId: newRecordId(),
        paymentId: row.PAYMENT_ID,
        reason: "Admin recorded eligible full refund",
      },
    );
    return { changed: 1, amount: row.AMOUNT };
  }
  if (action === "cancel_trip") {
    const tripId = id(input.id, "trip");
    // New bookings wait on this trip until the caller commits every cancellation.
    const trip = await connection.execute<{
      STATUS: string;
      CAN_CANCEL: number;
    }>(
      `SELECT
        status,
        CASE
          WHEN departure_at > SYSDATE
          THEN 1
          ELSE 0
        END can_cancel
      FROM smartmove_database.trips
      WHERE
        trip_id = :id
      FOR UPDATE`,
      { id: tripId },
    );
    const row = trip.rows?.[0];
    if (row?.STATUS === "CANCELLED") return { changed: 0, refundCount: 0 };
    if (row?.STATUS !== "SCHEDULED" || row.CAN_CANCEL !== 1)
      throw new Error("This action requires a future scheduled trip.");
    const bookings = await connection.execute<{
      BOOKING_ID: number;
      PASSENGER_ID: number;
    }>(
      `SELECT
        booking_id,
        passenger_id
      FROM smartmove_database.bookings
      WHERE
        trip_id = :id
        AND status <> 'CANCELLED'
      ORDER BY
        booking_id`,
      { id: tripId },
      { maxRows: 0 },
    );
    let refundCount = 0;
    for (const booking of bookings.rows ?? []) {
      const cancelled = await cancelPassengerBooking(
        connection,
        booking.BOOKING_ID,
        booking.PASSENGER_ID,
      );
      if (cancelled.refundAmount > 0) refundCount++;
    }
    await connection.execute(
      `BEGIN
        smartmove_database.cancel_trip(:id);
      END;`,
      { id: tripId },
    );
    return { changed: 1, refundCount };
  }
  if (action === "complete_trip") {
    const tripId = id(input.id, "trip");
    // Serialize completion with booking/cancellation workflows; the procedure
    // validates the status and arrival time using the database clock.
    await connection.execute(
      `SELECT trip_id FROM smartmove_database.trips WHERE trip_id = :id FOR UPDATE`,
      { id: tripId },
    );
    await connection.execute(
      `BEGIN
        smartmove_database.complete_trip(:id);
      END;`,
      {
        id: tripId,
      },
    );
    return { completed: true };
  }
  if (action === "complete_maintenance") {
    const cost =
      input.cost === "" || input.cost == null ? 0 : Number(input.cost);
    amount(cost, "maintenance cost", true);
    await connection.execute(
      `BEGIN
        smartmove_database.complete_maintenance(:id, :cost);
      END;`,
      { id: id(input.id, "maintenance"), cost },
    );
    return { completed: true };
  }
  throw new Error("Unknown admin action.");
}
