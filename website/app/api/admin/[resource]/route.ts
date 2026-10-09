import { NextRequest, NextResponse } from "next/server"
import { adminRequest } from "@/lib/server/admin-api"
import {
  adminResources,
  loadAdminResource,
  type AdminResource,
} from "@/lib/server/admin-data"
import { mutateAdminResource } from "@/lib/server/admin-mutations"

export const runtime = "nodejs"
type Context = { params: Promise<{ resource: string }> }
async function resourceFrom(context: Context) {
  const value = (await context.params).resource
  return adminResources.includes(value as AdminResource)
    ? (value as AdminResource)
    : null
}
export async function GET(request: NextRequest, context: Context) {
  const resource = await resourceFrom(context)
  if (!resource)
    return NextResponse.json({ error: "Unknown resource." }, { status: 404 })
  const q = request.nextUrl.searchParams.get("q")?.trim().slice(0, 100) ?? ""
  const offset = Math.max(
    0,
    Math.min(
      10000,
      Number(request.nextUrl.searchParams.get("offset") ?? 0) || 0
    )
  )
  return adminRequest(request, false, (connection) =>
    loadAdminResource(connection, resource, q, offset)
  )
}
async function mutate(
  request: NextRequest,
  context: Context,
  method: "POST" | "PATCH" | "DELETE"
) {
  const resource = await resourceFrom(context)
  if (!resource)
    return NextResponse.json({ error: "Unknown resource." }, { status: 404 })
  return adminRequest(request, true, (connection, input) =>
    mutateAdminResource(connection, resource, method, input)
  )
}
export const POST = (request: NextRequest, context: Context) =>
  mutate(request, context, "POST")
export const PATCH = (request: NextRequest, context: Context) =>
  mutate(request, context, "PATCH")
export const DELETE = (request: NextRequest, context: Context) =>
  mutate(request, context, "DELETE")
