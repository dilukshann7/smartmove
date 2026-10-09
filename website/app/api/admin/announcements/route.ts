import { ObjectId } from "mongodb"
import { NextRequest } from "next/server"
import { adminRequest } from "@/lib/server/admin-api"
import { getMongoDb } from "@/lib/server/mongo"

export const runtime = "nodejs"
function validate(input: Record<string, unknown>) {
  const title = typeof input.title === "string" ? input.title.trim() : ""
  const body = typeof input.body === "string" ? input.body.trim() : ""
  const status = input.status
  if (
    title.length < 3 ||
    title.length > 100 ||
    body.length < 10 ||
    body.length > 1000 ||
    !["DRAFT", "PUBLISHED", "ARCHIVED"].includes(String(status))
  )
    throw new Error("Enter a title, message and publication status.")
  return { title, body, status: status as "DRAFT" | "PUBLISHED" | "ARCHIVED" }
}
export function GET(request: NextRequest) {
  return adminRequest(request, false, async () => {
    const db = await getMongoDb()
    const rows = await db
      .collection("announcements")
      .find({ audience: "PASSENGERS" })
      .sort({ updatedAt: -1, _id: -1 })
      .limit(100)
      .toArray()
    return rows.map((row) => ({
      id: row._id.toString(),
      title: row.title,
      body: row.body,
      status: row.status ?? "PUBLISHED",
      sample: !row.status,
    }))
  })
}
export function POST(request: NextRequest) {
  return adminRequest(request, true, async (_connection, input) => {
    const data = validate(input)
    const db = await getMongoDb()
    const now = new Date()
    const result = await db
      .collection("announcements")
      .insertOne({
        ...data,
        audience: "PASSENGERS",
        createdAt: now,
        updatedAt: now,
        ...(data.status === "PUBLISHED" ? { publishedAt: now } : {}),
      })
    return { id: result.insertedId.toString() }
  })
}
export function PATCH(request: NextRequest) {
  return adminRequest(request, true, async (_connection, input) => {
    if (typeof input.id !== "string" || !/^[0-9a-f]{24}$/i.test(input.id))
      throw new Error("Choose a valid announcement.")
    const data = validate(input)
    const db = await getMongoDb()
    const collection = db.collection("announcements")
    const existing = await collection.findOne({
      _id: new ObjectId(input.id),
      audience: "PASSENGERS",
    })
    if (!existing) throw new Error("Choose a valid announcement.")
    await collection.updateOne(
      { _id: existing._id },
      {
        $set: {
          ...data,
          updatedAt: new Date(),
          ...(data.status === "PUBLISHED" && !existing.publishedAt
            ? { publishedAt: new Date() }
            : {}),
        },
      }
    )
    return { id: input.id }
  })
}
