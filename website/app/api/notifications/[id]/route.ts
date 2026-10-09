import { ObjectId } from "mongodb"
import { NextRequest, NextResponse } from "next/server"
import { getPassenger, sameOrigin } from "@/lib/server/auth"
import { getConnection } from "@/lib/server/oracle"
import { getMongoDb } from "@/lib/server/mongo"

export const runtime = "nodejs"

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 }
    )
  const id = (await context.params).id
  if (!/^[0-9a-f]{24}$/i.test(id))
    return NextResponse.json(
      { error: "Invalid notification." },
      { status: 400 }
    )
  let connection
  try {
    connection = await getConnection()
    const passenger = await getPassenger(request, connection)
    if (!passenger)
      return NextResponse.json(
        { error: "Sign in to update notifications." },
        { status: 401 }
      )
    const db = await getMongoDb()
    const result = await db
      .collection("notifications")
      .updateOne(
        { _id: new ObjectId(id), userId: String(passenger.userId) },
        { $set: { isRead: true } }
      )
    if (!result.matchedCount)
      return NextResponse.json(
        { error: "Notification not found." },
        { status: 404 }
      )
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Notification update failed", error)
    return NextResponse.json(
      { error: "Notification update is temporarily unavailable." },
      { status: 503 }
    )
  } finally {
    await connection?.close()
  }
}
