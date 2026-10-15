import { Binary, ObjectId } from "mongodb"
import { NextRequest, NextResponse } from "next/server"
import { getMongoDb } from "@/lib/server/mongo"

export const runtime = "nodejs"

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  if (!/^[a-f0-9]{24}$/i.test(id))
    return NextResponse.json({ error: "Image not found." }, { status: 404 })
  try {
    const db = await getMongoDb()
    const fileId = new ObjectId(id)
    const image = await db
      .collection<{
        fileId: ObjectId
        mediaType: string
        contentType: string
        data: Binary
      }>("trip_media")
      .findOne({ fileId, mediaType: "IMAGE" })
    if (
      !image ||
      image.contentType !== "image/webp" ||
      !(image.data instanceof Binary)
    )
      return NextResponse.json({ error: "Image not found." }, { status: 404 })
    const bytes = Uint8Array.from(image.data.value())
    return new Response(bytes, {
      headers: {
        "Content-Type": "image/webp",
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "public, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (error) {
    console.error("Image download failed", error)
    return NextResponse.json(
      { error: "Images are temporarily unavailable." },
      { status: 503 }
    )
  }
}
