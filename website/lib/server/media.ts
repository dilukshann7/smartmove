import "server-only"

import { Binary, ObjectId, type Db } from "mongodb"
import type { Connection } from "oracledb"
import sharp from "sharp"
import type { MediaImage, MediaResource, TripImages } from "../media-types"

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_FORM_BYTES = MAX_IMAGE_BYTES + 64 * 1024
const imageFormats = new Map([
  ["image/jpeg", "jpeg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
])

type Target = { resource: MediaResource; id: number }
type ImageRecord = {
  vehicleId?: string
  tripId?: string
  mediaType?: string
  fileId?: ObjectId
  fileUrl: string
  data?: Binary
  contentType?: string
  width?: number
  height?: number
  caption?: string
  uploadedBy?: string
  createdAt?: Date
}

export function mediaTarget(resource: unknown, value: unknown): Target {
  const id =
    typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value
  if (
    (resource !== "vehicles" && resource !== "trips") ||
    typeof id !== "number" ||
    !Number.isSafeInteger(id) ||
    id < 1
  )
    throw new Error("Choose a valid vehicle or trip.")
  return { resource, id }
}

function source(target: Target) {
  return target.resource === "vehicles"
    ? {
        collection: "trip_media",
        filter: {
          vehicleId: String(target.id),
          mediaType: "IMAGE",
          tripId: { $exists: false },
        },
      }
    : {
        collection: "trip_media",
        filter: { tripId: String(target.id), mediaType: "IMAGE" },
      }
}

export async function requireMediaRecord(
  connection: Connection,
  target: Target
) {
  const result = await connection.execute(
    target.resource === "vehicles"
      ? "SELECT vehicle_id FROM smartmove_database.vehicles WHERE vehicle_id = :id"
      : "SELECT trip_id FROM smartmove_database.trips WHERE trip_id = :id",
    { id: target.id }
  )
  if (!result.rows?.length)
    throw new Error("Choose an existing vehicle or trip.")
}

export async function readImageForm(request: Request) {
  if (Number(request.headers.get("content-length")) > MAX_FORM_BYTES)
    throw new Error("Choose an image up to 5 MB.")
  const reader = request.body?.getReader()
  if (!reader) throw new Error("Choose an image to upload.")
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_FORM_BYTES) {
        await reader.cancel()
        throw new Error("Choose an image up to 5 MB.")
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  try {
    return await new Response(Buffer.concat(chunks), {
      headers: { "Content-Type": request.headers.get("content-type") ?? "" },
    }).formData()
  } catch {
    throw new Error("Enter valid image upload data.")
  }
}

export async function prepareImage(file: File) {
  if (!file.size || file.size > MAX_IMAGE_BYTES)
    throw new Error("Choose an image up to 5 MB.")
  const format = imageFormats.get(file.type)
  if (!format) throw new Error("Choose a JPG, PNG or WebP image.")
  try {
    const input = Buffer.from(await file.arrayBuffer())
    const image = sharp(input, {
      limitInputPixels: 25_000_000,
      failOn: "warning",
    })
    const metadata = await image.metadata()
    if (metadata.format !== format || (metadata.pages ?? 1) > 1)
      throw new Error("Unsupported image")
    // Decode and re-encode to reject corrupt files, orient phone photos, and
    // strip embedded metadata. Large photos are resized for the gallery.
    return await image
      .rotate()
      .resize({
        width: 1920,
        height: 1440,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer({ resolveWithObject: true })
  } catch {
    throw new Error(
      "Choose a valid, non-animated JPG, PNG or WebP image under 25 megapixels."
    )
  }
}

export async function listImages(
  db: Db,
  target: Target
): Promise<MediaImage[]> {
  const { collection, filter } = source(target)
  const images = await db
    .collection<ImageRecord>(collection)
    .find(filter, { projection: { data: 0 } })
    .sort({ createdAt: -1, _id: -1 })
    .limit(100)
    .toArray()
  return images
    .filter((image) =>
      /^\/(?:uploads\/[^?#]+|api\/media\/[a-f0-9]{24})$/i.test(image.fileUrl)
    )
    .map((image) => ({
      id: String(image._id),
      url: image.fileUrl,
      caption: image.caption ?? "",
    }))
}

export async function uploadImage(
  db: Db,
  target: Target,
  file: File,
  caption: string,
  adminId: number
) {
  const { data, info } = await prepareImage(file)
  if (data.length > MAX_IMAGE_BYTES)
    throw new Error("Choose an image up to 5 MB.")
  const id = new ObjectId()
  const fileUrl = `/api/media/${id}`
  const { collection, filter } = source(target)
  // The existence condition is a query constraint, not a stored field.
  const targetId =
    target.resource === "vehicles"
      ? { vehicleId: String(target.id) }
      : { tripId: String(target.id) }
  await db.collection<ImageRecord>(collection).insertOne({
    _id: id,
    ...targetId,
    mediaType: filter.mediaType,
    fileId: id,
    fileUrl,
    data: new Binary(data),
    contentType: "image/webp",
    width: info.width,
    height: info.height,
    caption,
    uploadedBy: String(adminId),
    createdAt: new Date(),
  })
  return { id: String(id), url: fileUrl, caption }
}

export async function removeImage(db: Db, target: Target, mediaId: unknown) {
  if (typeof mediaId !== "string" || !/^[a-f0-9]{24}$/i.test(mediaId))
    throw new Error("Choose a valid image.")
  const { collection, filter } = source(target)
  const images = db.collection<ImageRecord>(collection)
  const image = await images.findOne(
    { ...filter, _id: new ObjectId(mediaId) },
    { projection: { _id: 1 } }
  )
  if (!image)
    throw new Error("Choose an image belonging to this vehicle or trip.")
  await images.deleteOne({ ...filter, _id: image._id })
  return { removed: true }
}

export async function loadTripImages(
  connection: Connection,
  db: Db,
  tripId: number
): Promise<TripImages> {
  const result = await connection.execute<{ VEHICLE_ID: number }>(
    "SELECT vehicle_id FROM smartmove_database.trips WHERE trip_id = :id",
    { id: tripId }
  )
  const row = result.rows?.[0]
  if (!row) throw new Error("Choose an existing trip.")
  const [trip, vehicle] = await Promise.all([
    listImages(db, { resource: "trips", id: tripId }),
    listImages(db, { resource: "vehicles", id: row.VEHICLE_ID }),
  ])
  return { trip, vehicle }
}
