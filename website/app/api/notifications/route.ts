import { NextRequest, NextResponse } from "next/server"
import { getPassenger } from "@/lib/server/auth"
import { getConnection } from "@/lib/server/oracle"
import { getMongoDb, type NotificationContent } from "@/lib/server/mongo"
import { reconcileNotifications } from "@/lib/server/notifications"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  let connection
  try {
    connection = await getConnection()
    const passenger = await getPassenger(request, connection)
    if (!passenger)
      return NextResponse.json(
        { error: "Sign in to view notifications." },
        { status: 401 }
      )
    const db = await getMongoDb()
    await reconcileNotifications(connection, db, passenger.userId, passenger.id)
    const rows = await db
      .collection<NotificationContent>("notifications")
      .find({ userId: String(passenger.userId) })
      .sort({ createdAt: -1, _id: -1 })
      .limit(100)
      .toArray()
    return NextResponse.json(
      {
        notifications: rows.map((row) => ({
          id: row._id?.toString(),
          message: row.message,
          isRead: row.isRead,
          createdAt: row.createdAt?.toISOString() ?? null,
          href:
            row.href?.startsWith("/") && !row.href.startsWith("//")
              ? row.href
              : null,
        })),
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (error) {
    console.error("Notifications failed", error)
    return NextResponse.json(
      { error: "Notifications are temporarily unavailable." },
      { status: 503 }
    )
  } finally {
    await connection?.close()
  }
}
