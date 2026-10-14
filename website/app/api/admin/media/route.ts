import { NextRequest, NextResponse } from "next/server"
import { adminRequest } from "@/lib/server/admin-api"
import { sameOrigin } from "@/lib/server/same-origin"
import { getMongoDb } from "@/lib/server/mongo"
import {
  listImages,
  mediaTarget,
  readImageForm,
  removeImage,
  requireMediaRecord,
  uploadImage,
} from "@/lib/server/media"

export const runtime = "nodejs"

export function GET(request: NextRequest) {
  return adminRequest(request, false, async (connection) => {
    const target = mediaTarget(
      request.nextUrl.searchParams.get("resource"),
      request.nextUrl.searchParams.get("id")
    )
    await requireMediaRecord(connection, target)
    return listImages(await getMongoDb(), target)
  })
}

export function POST(request: NextRequest) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 }
    )
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data;"))
    return NextResponse.json(
      { error: "Use an image upload form." },
      { status: 415 }
    )
  // MongoDB owns the file and media record. Authenticate before reading the
  // bounded multipart body; no Oracle write or commit is needed for an upload.
  return adminRequest(request, false, async (connection, _input, admin) => {
    const form = await readImageForm(request)
    const target = mediaTarget(form.get("resource"), form.get("id"))
    await requireMediaRecord(connection, target)
    const file = form.get("image")
    if (!(file instanceof File)) throw new Error("Choose an image to upload.")
    const caption = form.get("caption") ?? ""
    if (typeof caption !== "string" || caption.trim().length > 160)
      throw new Error("Enter a caption up to 160 characters.")
    return uploadImage(
      await getMongoDb(),
      target,
      file,
      caption.trim(),
      admin.id
    )
  })
}

export function DELETE(request: NextRequest) {
  return adminRequest(request, true, async (connection, input) => {
    const target = mediaTarget(input.resource, input.id)
    await requireMediaRecord(connection, target)
    return removeImage(await getMongoDb(), target, input.mediaId)
  })
}
