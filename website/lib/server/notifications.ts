import "server-only"

import type { Connection } from "oracledb"
import type { Db } from "mongodb"
import type { FeedbackContent, NotificationContent } from "./mongo"

type Event = { key: string; message: string; href: string; occurredAt: Date }

export async function putNotification(db: Db, userId: number, event: Event) {
  try {
    await db.collection<NotificationContent>("notifications").updateOne(
      { userId: String(userId), eventKey: event.key },
      {
        $setOnInsert: {
          userId: String(userId),
          eventKey: event.key,
          message: event.message,
          isRead: false,
          href: event.href,
          createdAt: event.occurredAt,
        },
      },
      { upsert: true }
    )
  } catch (error) {
    // A simultaneous reconciliation may have inserted the same event first.
    if (!(error instanceof Error && "code" in error && error.code === 11000))
      throw error
  }
}

export async function reconcileNotifications(
  connection: Connection,
  db: Db,
  userId: number,
  passengerId: number
) {
  const bookings = await connection.execute<{
    BOOKING_ID: number
    BOOKED_AT: Date
  }>(
    `SELECT
      b.booking_id,
      b.booked_at
    FROM smartmove_database.bookings b
    CROSS JOIN smartmove_database.web_notification_baseline n
    WHERE
      b.passenger_id = :passengerId
      AND b.booked_at >= n.started_at`,
    { passengerId }
  )
  const changes = await connection.execute<{
    BOOKING_ID: number
    NEW_STATUS: string
    CHANGED_AT: Date
  }>(
    `SELECT
      h.booking_id,
      h.new_status,
      h.changed_at
    FROM smartmove_database.booking_status_history h
    JOIN smartmove_database.bookings b
      ON b.booking_id = h.booking_id
    CROSS JOIN smartmove_database.web_notification_baseline n
    WHERE
      b.passenger_id = :passengerId
      AND h.changed_at >= n.started_at
      AND h.new_status IN ('CONFIRMED', 'CANCELLED')
    UNION ALL
    SELECT
      b.booking_id,
      'CANCELLED',
      b.booked_at + (30 / 1440)
    FROM smartmove_database.bookings b
    CROSS JOIN smartmove_database.web_notification_baseline n
    WHERE
      b.passenger_id = :passengerId
      AND b.status = 'PENDING'
      AND b.booked_at <= SYSDATE - (30 / 1440)
      AND b.booked_at + (30 / 1440) >= n.started_at`,
    { passengerId }
  )
  const refunds = await connection.execute<{
    REFUND_ID: number
    BOOKING_ID: number
    AMOUNT: number
    REFUNDED_AT: Date
  }>(
    `SELECT
      r.refund_id,
      p.booking_id,
      r.amount,
      r.refunded_at
    FROM smartmove_database.refunds r
    JOIN smartmove_database.payments p
      ON p.payment_id = r.payment_id
    JOIN smartmove_database.bookings b
      ON b.booking_id = p.booking_id
    CROSS JOIN smartmove_database.web_notification_baseline n
    WHERE
      b.passenger_id = :passengerId
      AND r.refunded_at >= n.started_at`,
    { passengerId }
  )
  const events: Event[] = [
    ...(bookings.rows ?? []).map((row) => ({
      key: `booking:${row.BOOKING_ID}:created`,
      message: `Booking #${row.BOOKING_ID} was created.`,
      href: `/bookings/${row.BOOKING_ID}`,
      occurredAt: row.BOOKED_AT,
    })),
    ...(changes.rows ?? []).map((row) => ({
      key: `booking:${row.BOOKING_ID}:${row.NEW_STATUS.toLowerCase()}`,
      message: `Booking #${row.BOOKING_ID} is ${row.NEW_STATUS.toLowerCase()}.`,
      href: `/bookings/${row.BOOKING_ID}`,
      occurredAt: row.CHANGED_AT,
    })),
    ...(refunds.rows ?? []).map((row) => ({
      key: `refund:${row.REFUND_ID}:recorded`,
      message: `Full refund of LKR ${row.AMOUNT} was recorded for booking #${row.BOOKING_ID}. Actual payout happens outside SmartMove.`,
      href: `/bookings/${row.BOOKING_ID}`,
      occurredAt: row.REFUNDED_AT,
    })),
  ]
  const feedback = await connection.execute<{
    FEEDBACK_ID: number
    FEEDBACK_TYPE: string
    STATUS: string
  }>(
    `SELECT
      f.feedback_id,
      f.feedback_type,
      f.status
    FROM smartmove_database.feedback_records f
    JOIN smartmove_database.bookings b
      ON b.booking_id = f.booking_id
    WHERE
      b.passenger_id = :passengerId
      AND f.feedback_id >= 100000`,
    { passengerId }
  )
  const ids = (feedback.rows ?? []).map((row) => String(row.FEEDBACK_ID))
  if (ids.length) {
    const contents = await db
      .collection<FeedbackContent>("feedback_content")
      .find({ feedbackId: { $in: ids } })
      .toArray()
    const byId = new Map(contents.map((item) => [item.feedbackId, item]))
    for (const row of feedback.rows ?? []) {
      const item = byId.get(String(row.FEEDBACK_ID))
      if (!item) continue
      events.push({
        key: `feedback:${row.FEEDBACK_ID}:submitted`,
        message: `Your ${row.FEEDBACK_TYPE.toLowerCase()} #${row.FEEDBACK_ID} was received.`,
        href: "/feedback",
        occurredAt: item.createdAt ?? new Date(),
      })
      if (row.STATUS === "RESOLVED")
        events.push({
          key: `feedback:${row.FEEDBACK_ID}:resolved`,
          message: `Feedback #${row.FEEDBACK_ID} was resolved.`,
          href: "/feedback",
          occurredAt: item.reply?.repliedAt ?? new Date(),
        })
      if (item.reply?.message)
        events.push({
          key: `feedback:${row.FEEDBACK_ID}:reply`,
          message: `Staff replied to feedback #${row.FEEDBACK_ID}.`,
          href: "/feedback",
          occurredAt: item.reply.repliedAt ?? new Date(),
        })
    }
  }
  if (events.length)
    await Promise.all(events.map((event) => putNotification(db, userId, event)))
}
