import { NextRequest, NextResponse } from "next/server"
import { sameOrigin } from "@/lib/server/same-origin"
import { clearLegacyCookies } from "@/lib/server/auth-token"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 })
  const response = NextResponse.json({ ok: true })
  clearLegacyCookies(response)
  return response
}
