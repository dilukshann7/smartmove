import "server-only"

import { NextRequest, NextResponse } from "next/server"
import type { Connection } from "oracledb"
import { getAdmin } from "./admin-auth"
import { sameOrigin } from "./auth"
import { getConnection } from "./oracle"
import {
  disableOracleOutput,
  enableOracleOutput,
  readOracleOutput,
} from "./oracle-output"

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
  let outputEnabled = false
  try {
    connection = await getConnection()
    const admin = await getAdmin(request, connection)
    if (!admin)
      return NextResponse.json(
        { error: "Admin sign-in required." },
        { status: 401 }
      )
    if (write) {
      await enableOracleOutput(connection)
      outputEnabled = true
    }
    const result = await task(connection, input)
    if (write) await connection.commit()
    return NextResponse.json(
      { result },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (error) {
    const output =
      outputEnabled && connection
        ? await readOracleOutput(connection).catch(() => [])
        : []
    await connection?.rollback()
    const message = error instanceof Error ? error.message : ""
    if (/^(Enter|Choose|This action|Unknown admin)/.test(message))
      return NextResponse.json({ error: message }, { status: 400 })
    if (message.includes("ORA-01403"))
      return NextResponse.json({ error: "Record not found." }, { status: 404 })
    if (/ORA-(06510|200\d\d|201\d\d)/.test(message)) {
      const explanation = output
        .map((line) => line.trim())
        .filter(Boolean)
        .at(-1)
      const applicationMessage = /ORA-20\d{3}: ([^\r\n]+)/.exec(message)?.[1]
      return NextResponse.json(
        {
          error:
            explanation ||
            applicationMessage ||
            "This operation is not allowed for the record's current state.",
        },
        { status: 409 }
      )
    }
    if (message.includes("ORA-00001"))
      return NextResponse.json(
        { error: "A record with those details already exists." },
        { status: 409 }
      )
    if (message.includes("ORA-02292"))
      return NextResponse.json(
        { error: "This record has related history and cannot be deleted." },
        { status: 409 }
      )
    if (message.includes("ORA-02291"))
      return NextResponse.json(
        {
          error:
            "A selected related record no longer exists. Refresh and choose it again.",
        },
        { status: 409 }
      )
    if (/ORA-(06502|01400|01438|02290|12899|018\d\d)/.test(message))
      return NextResponse.json(
        {
          error:
            "Enter valid values within the allowed lengths, amounts, and dates.",
        },
        { status: 400 }
      )
    console.error("Admin request failed", error)
    return NextResponse.json(
      { error: "Admin action is temporarily unavailable." },
      { status: 503 }
    )
  } finally {
    if (outputEnabled && connection)
      await disableOracleOutput(connection).catch((error) =>
        console.error("Admin output cleanup failed", error)
      )
    await connection?.close()
  }
}
