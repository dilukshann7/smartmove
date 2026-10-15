import "server-only"

import type { Connection } from "oracledb"
import type { NextRequest } from "next/server"
import { createAuthToken, readAuthToken } from "./auth-token"

export async function createAdminSession(connection: Connection, userId: number) {
  const result = await connection.execute<{ USER_ID: number }>(
    `SELECT user_id FROM smartmove_database.web_admin_login WHERE user_id = :userId`,
    { userId }
  )
  if (!result.rows?.length) throw new Error("Admin account not found")
  return createAuthToken(userId, "ADMIN")
}

export async function getAdmin(request: NextRequest, connection: Connection) {
  const token = await readAuthToken(request)
  if (!token || token.role !== "ADMIN") return null
  const result = await connection.execute<{ USER_ID: number; EMAIL: string }>(
    `SELECT user_id, email FROM smartmove_database.web_admin_login WHERE user_id = :userId`,
    { userId: token.userId }
  )
  const row = result.rows?.[0]
  return row ? { id: row.USER_ID, email: row.EMAIL, role: "ADMIN" as const } : null
}
