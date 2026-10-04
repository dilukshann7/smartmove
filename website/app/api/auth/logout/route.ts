import { NextRequest, NextResponse } from "next/server"
import {
  clearSessionCookie,
  getSessionHash,
  sameOrigin,
} from "@/lib/server/auth"
import { getConnection } from "@/lib/server/oracle"
import {
  ADMIN_COOKIE,
  adminSessionHash,
  clearAdminCookie,
} from "@/lib/server/admin-auth"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 }
    )
  let connection
  try {
    const sessionHash = getSessionHash(request)
    const adminHash = adminSessionHash(request.cookies.get(ADMIN_COOKIE)?.value)
    if (sessionHash || adminHash) {
      connection = await getConnection()
      if (sessionHash)
        await connection.execute(
          `DELETE FROM smartmove_database.web_sessions
          WHERE
            session_hash = :sessionHash`,
          { sessionHash }
        )
      if (adminHash)
        await connection.execute(
          `DELETE FROM smartmove_database.web_admin_sessions
          WHERE
            session_hash = :adminHash`,
          { adminHash }
        )
      await connection.commit()
    }
    const response = NextResponse.json({ ok: true })
    clearSessionCookie(response)
    clearAdminCookie(response)
    return response
  } catch (error) {
    await connection?.rollback()
    console.error("Passenger logout failed", error)
    return NextResponse.json(
      { error: "Logout is temporarily unavailable." },
      { status: 503 }
    )
  } finally {
    await connection?.close()
  }
}
