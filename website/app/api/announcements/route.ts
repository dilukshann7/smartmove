import { NextResponse } from "next/server"
import { getMongoDb } from "@/lib/server/mongo"

export const runtime = "nodejs"
export async function GET() {
  try {
    const db = await getMongoDb()
    const rows = await db
      .collection("announcements")
      .find({
        audience: "PASSENGERS",
        $or: [{ status: "PUBLISHED" }, { status: { $exists: false } }],
      })
      .sort({ publishedAt: -1, _id: -1 })
      .limit(10)
      .toArray()
    return NextResponse.json(
      {
        announcements: rows.map((row) => ({
          id: row._id.toString(),
          title: row.title,
          body: row.body,
          sample: !row.status,
        })),
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (error) {
    console.error("Announcements lookup failed", error)
    return NextResponse.json(
      { error: "Announcements are temporarily unavailable." },
      { status: 503 }
    )
  }
}
