import "server-only";

import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import type { Connection } from "oracledb";
import type { NextRequest } from "next/server";
export { sameOrigin } from "./same-origin";

const scrypt = promisify(scryptCallback);
import { createAuthToken, readAuthToken } from "./auth-token";

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [algorithm, salt, hex] = stored.split(":");
  if (algorithm !== "scrypt" || !salt || !/^[0-9a-f]{128}$/.test(hex))
    return false;
  const expected = Buffer.from(hex, "hex");
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function createSession(connection: Connection, passengerId: number) {
  const result = await connection.execute<{ USER_ID: number }>(
    `SELECT user_id FROM smartmove_database.web_passenger_login WHERE passenger_id = :passengerId`,
    { passengerId },
  );
  const row = result.rows?.[0];
  if (!row) throw new Error("Passenger account not found");
  return createAuthToken(row.USER_ID, "PASSENGER");
}

export async function getPassenger(
  request: NextRequest,
  connection: Connection,
) {
  const token = await readAuthToken(request);
  if (!token || token.role !== "PASSENGER") return null;
  const result = await connection.execute<{
    USER_ID: number;
    PASSENGER_ID: number;
    FULL_NAME: string;
    EMAIL: string;
  }>(
    `SELECT
      u.user_id,
      u.passenger_id,
      u.full_name,
      u.email
    FROM smartmove_database.web_passenger_login u
    WHERE u.user_id = :userId`,
    { userId: token.userId },
  );
  const row = result.rows?.[0];
  return row
    ? {
        id: row.PASSENGER_ID,
        userId: row.USER_ID,
        name: row.FULL_NAME,
        email: row.EMAIL,
      }
    : null;
}
