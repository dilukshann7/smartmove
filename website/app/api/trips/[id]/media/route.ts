import { NextRequest, NextResponse } from "next/server"
import { getConnection } from "@/lib/server/oracle"
import { getMongoDb } from "@/lib/server/mongo"
import { loadTripImages, mediaTarget } from "@/lib/server/media"

export const runtime = "nodejs"

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  let connection
  try {
    const target = mediaTarget("trips", id)
    connection = await getConnection()
    const images = await loadTripImages(
      connection,
      await getMongoDb(),
      target.id
    )
    return NextResponse.json(
      { images },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : ""
    if (message.startsWith("Choose"))
      return NextResponse.json(
        { error: message },
        { status: message.includes("existing") ? 404 : 400 }
      )
    console.error("Trip images failed", error)
    return NextResponse.json(
      { error: "Images are temporarily unavailable." },
      { status: 503 }
    )
  } finally {
    await connection?.close()
  }
}
