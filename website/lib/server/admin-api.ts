import "server-only"

import { NextRequest, NextResponse } from "next/server"
import type { Connection } from "oracledb"
import { getAdmin } from "./admin-auth"
import { sameOrigin } from "./auth"
import { getConnection } from "./oracle"

export async function adminRequest(
  request: NextRequest,
  write: boolean,
  task: (
    connection: Connection,
    input: Record<string, unknown>
  ) => Promise<unknown>
) {
  if (write && !sameOrigin(request))
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 }
    )
  let input: Record<string, unknown> = {}
  if (write) {
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      return NextResponse.json(
        { error: "Use JSON form data." },
        { status: 415 }
      )
    try {
      input = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid form data." }, { status: 400 })
    }
  }
  let connection: Connection | undefined
  try {
    connection = await getConnection()
    const admin = await getAdmin(request, connection)
    if (!admin)
      return NextResponse.json(
        { error: "Admin sign-in required." },
        { status: 401 }
      )
    const result = await task(connection, input)
    if (write) await connection.commit()
    return NextResponse.json(
      { result },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (error) {
    await connection?.rollback()
    const message = error instanceof Error ? error.message : ""
    if (/^(Enter|Choose|This action|Unknown admin)/.test(message))
      return NextResponse.json({ error: message }, { status: 400 })
    if (message.includes("ORA-01403"))
      return NextResponse.json({ error: "Record not found." }, { status: 404 })
    if (/ORA-(00001|02292|200\d\d|201\d\d)/.test(message))
      return NextResponse.json(
        {
          error:
            "This action conflicts with the record's current state or related history.",
        },
        { status: 409 }
      )
    console.error("Admin request failed", error)
    return NextResponse.json(
      { error: "Admin action is temporarily unavailable." },
      { status: 503 }
    )
  } finally {
    await connection?.close()
  }
}
