import { NextRequest, NextResponse } from "next/server"
import { getPassenger, sameOrigin } from "@/lib/server/auth"
import { getConnection } from "@/lib/server/oracle"
import { cancelPassengerBooking } from "@/lib/server/booking-actions"
import { getMongoDb } from "@/lib/server/mongo"
import { putNotification } from "@/lib/server/notifications"

export const runtime = "nodejs"

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 }
    )
  const id = Number((await context.params).id)
  if (!Number.isSafeInteger(id) || id < 1)
    return NextResponse.json({ error: "Invalid booking." }, { status: 400 })
  let connection
  try {
    connection = await getConnection()
    const passenger = await getPassenger(request, connection)
    if (!passenger)
      return NextResponse.json(
        { error: "Sign in to cancel this booking." },
        { status: 401 }
      )
    const out = await cancelPassengerBooking(connection, id, passenger.id)
    await connection.commit()
    if (out.changed) {
      try {
        const db = await getMongoDb()
        await putNotification(db, passenger.userId, {
          key: `booking:${id}:cancelled`,
          message: `Booking #${id} was cancelled.`,
          href: `/bookings/${id}`,
          occurredAt: new Date(),
        })
      } catch (error) {
        console.error("Cancellation notification deferred", error)
      }
    }
    return NextResponse.json({
      status: "CANCELLED",
      changed: Boolean(out.changed),
      refund: out.refundAmount
        ? {
            status: "RECORDED",
            amount: out.refundAmount,
            note: "Actual payout happens outside SmartMove.",
          }
        : null,
    })
  } catch (error) {
    await connection?.rollback()
    if (error instanceof Error && error.message.includes("ORA-01403"))
      return NextResponse.json({ error: "Booking not found." }, { status: 404 })
    if (error instanceof Error && error.message.includes("ORA-20021"))
      return NextResponse.json(
        { error: "This trip has departed and can no longer be cancelled." },
        { status: 409 }
      )
    console.error("Passenger cancellation failed", error)
    return NextResponse.json(
      { error: "Cancellation is temporarily unavailable." },
      { status: 503 }
    )
  } finally {
    await connection?.close()
  }
}
