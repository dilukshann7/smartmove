import { NextRequest, NextResponse } from "next/server"
import {
  clearSessionCookie,
  createSession,
  sameOrigin,
  setSessionCookie,
  verifyPassword,
} from "@/lib/server/auth"
import { getConnection } from "@/lib/server/oracle"
import {
  clearAdminCookie,
  createAdminSession,
  setAdminCookie,
} from "@/lib/server/admin-auth"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return NextResponse.json({ error: "Use JSON form data." }, { status: 415 })
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 }
    )
  let input: Record<string, unknown>
  try {
    input = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 })
  }
  const email =
    typeof input.email === "string" ? input.email.trim().toLowerCase() : ""
  const password = typeof input.password === "string" ? input.password : ""
  if (!email || !password || email.length > 100 || password.length > 128) {
    return NextResponse.json(
      { error: "Enter your email and password." },
      { status: 400 }
    )
  }
  let connection
  try {
    connection = await getConnection()
    const adminResult = await connection.execute<{
      USER_ID: number
      PASSWORD_HASH: string
    }>(
      `SELECT
        user_id,
        password_hash
      FROM smartmove_database.web_admin_login
      WHERE
        email = :email`,
      { email }
    )
    const admin = adminResult.rows?.[0]
    if (admin) {
      if (!(await verifyPassword(password, admin.PASSWORD_HASH))) {
        return NextResponse.json(
          { error: "Incorrect email or password." },
          { status: 401 }
        )
      }
      const token = await createAdminSession(connection, admin.USER_ID)
      await connection.commit()
      const response = NextResponse.json({
        role: "ADMIN",
        destination: "/admin",
      })
      setAdminCookie(response, token)
      clearSessionCookie(response)
      return response
    }
    const result = await connection.execute<{
      PASSENGER_ID: number
      FULL_NAME: string
      PASSWORD_HASH: string
    }>(
      `SELECT
        passenger_id,
        full_name,
        password_hash
      FROM smartmove_database.web_passenger_login
      WHERE
        email = :email`,
      { email }
    )
    const row = result.rows?.[0]
    if (!row || !(await verifyPassword(password, row.PASSWORD_HASH))) {
      return NextResponse.json(
        { error: "Incorrect email or password." },
        { status: 401 }
      )
    }
    const token = await createSession(connection, row.PASSENGER_ID)
    await connection.commit()
    const response = NextResponse.json({
      passenger: { name: row.FULL_NAME, email },
      role: "PASSENGER",
      destination: "/dashboard",
    })
    setSessionCookie(response, token)
    clearAdminCookie(response)
    return response
  } catch (error) {
    await connection?.rollback()
    console.error("Passenger login failed", error)
    return NextResponse.json(
      { error: "Login is temporarily unavailable." },
      { status: 503 }
    )
  } finally {
    await connection?.close()
  }
}
