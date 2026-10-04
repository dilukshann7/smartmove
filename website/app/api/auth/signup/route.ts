import { NextRequest, NextResponse } from "next/server"
import {
  createSession,
  hashPassword,
  sameOrigin,
  setSessionCookie,
} from "@/lib/server/auth"
import { getConnection } from "@/lib/server/oracle"
import { newRecordId } from "@/lib/server/record-id"
import { clearAdminCookie } from "@/lib/server/admin-auth"

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
  const name = typeof input.name === "string" ? input.name.trim() : ""
  const email =
    typeof input.email === "string" ? input.email.trim().toLowerCase() : ""
  const phone = typeof input.phone === "string" ? input.phone.trim() : ""
  const password = typeof input.password === "string" ? input.password : ""
  if (
    name.length < 2 ||
    name.length > 100 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 100 ||
    !/^[0-9+()\s-]{7,15}$/.test(phone) ||
    password.length < 8 ||
    password.length > 128
  ) {
    return NextResponse.json(
      {
        error:
          "Enter a valid name, email, phone and password (8–128 characters).",
      },
      { status: 400 }
    )
  }
  let connection
  try {
    const passwordHash = await hashPassword(password)
    connection = await getConnection()
    const userId = newRecordId()
    const passengerId = newRecordId()
    await connection.execute(
      `BEGIN
        smartmove_database.web_register_passenger(
          :email,
          :passwordHash,
          :fullName,
          :phone,
          :userId,
          :passengerId
        );
      END;`,
      {
        email,
        passwordHash,
        fullName: name,
        phone,
        userId,
        passengerId,
      }
    )
    const token = await createSession(connection, passengerId)
    await connection.commit()
    const response = NextResponse.json(
      { passenger: { name, email } },
      { status: 201 }
    )
    setSessionCookie(response, token)
    clearAdminCookie(response)
    return response
  } catch (error) {
    await connection?.rollback()
    if (error instanceof Error && error.message.includes("ORA-00001")) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      )
    }
    console.error("Passenger signup failed", error)
    return NextResponse.json(
      { error: "Account creation is temporarily unavailable." },
      { status: 503 }
    )
  } finally {
    await connection?.close()
  }
}
