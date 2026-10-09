import "server-only"

import { createHash, randomBytes } from "node:crypto"
import type { Connection } from "oracledb"
import type { NextRequest, NextResponse } from "next/server"

export const ADMIN_COOKIE = "smartmove_admin_session"

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

export function adminSessionHash(token: string | undefined) {
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? hashToken(token) : null
}

export async function createAdminSession(
  connection: Connection,
  userId: number
) {
  const token = randomBytes(32).toString("base64url")
  await connection.execute(
    `INSERT INTO smartmove_database.web_admin_sessions (session_hash, user_id, expires_at)
    VALUES (:hash, :userId, SYSTIMESTAMP + INTERVAL '7' DAY)`,
    { hash: hashToken(token), userId }
  )
  return token
}

export function setAdminCookie(response: NextResponse, token: string) {
  response.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  })
}

export function clearAdminCookie(response: NextResponse) {
  response.cookies.set(ADMIN_COOKIE, "", { path: "/", maxAge: 0 })
}

export async function getAdminByToken(
  connection: Connection,
  token: string | undefined
) {
  const hash = adminSessionHash(token)
  if (!hash) return null
  const result = await connection.execute<{ USER_ID: number; EMAIL: string }>(
    `SELECT
      u.user_id,
      u.email
    FROM smartmove_database.web_admin_sessions s
    JOIN smartmove_database.web_admin_login u
      ON u.user_id = s.user_id
    WHERE
      s.session_hash = :hash
      AND s.expires_at > SYSTIMESTAMP`,
    { hash }
  )
  const row = result.rows?.[0]
  return row
    ? { id: row.USER_ID, email: row.EMAIL, role: "ADMIN" as const }
    : null
}

export function getAdmin(request: NextRequest, connection: Connection) {
  return getAdminByToken(connection, request.cookies.get(ADMIN_COOKIE)?.value)
}
