import { Readable } from "node:stream"
import { GridFSBucket, ObjectId } from "mongodb"
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
    const [vehicle, trip] = await Promise.all([
      db.collection("vehicle_assets").findOne({ fileId, assetType: "IMAGE" }),
      db.collection("trip_media").findOne({ fileId, mediaType: "IMAGE" }),
    ])
    if (!vehicle && !trip)
      return NextResponse.json({ error: "Image not found." }, { status: 404 })
    const bucket = new GridFSBucket(db, { bucketName: "media_files" })
    const file = await bucket.find({ _id: fileId }).next()
    if (!file || file.metadata?.contentType !== "image/webp")
      return NextResponse.json({ error: "Image not found." }, { status: 404 })
    return new Response(
      Readable.toWeb(bucket.openDownloadStream(fileId)) as ReadableStream,
      {
        headers: {
          "Content-Type": "image/webp",
          "Content-Length": String(file.length),
          "Cache-Control": "public, max-age=3600",
          "X-Content-Type-Options": "nosniff",
        },
      }
    )
  } catch (error) {
    console.error("Image download failed", error)
    return NextResponse.json(
      { error: "Images are temporarily unavailable." },
      { status: 503 }
    )
  }
}
