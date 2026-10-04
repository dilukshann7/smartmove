import "server-only";

import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import type { Connection } from "oracledb";
import type { NextRequest, NextResponse } from "next/server";
export { sameOrigin } from "./same-origin";

const scrypt = promisify(scryptCallback);
const COOKIE = "smartmove_session";
const SESSION_DAYS = 7;

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

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(
  connection: Connection,
  passengerId: number,
) {
  const token = randomBytes(32).toString("base64url");
  await connection.execute(
    `INSERT INTO smartmove_database.web_sessions (session_hash, passenger_id, expires_at)
    VALUES (:sessionHash, :passengerId, SYSTIMESTAMP + INTERVAL '7' DAY)`,
    { sessionHash: tokenHash(token), passengerId },
  );
  return token;
}

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export function getSessionHash(request: NextRequest) {
  const token = request.cookies.get(COOKIE)?.value;
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? tokenHash(token) : null;
}

export async function getPassenger(
  request: NextRequest,
  connection: Connection,
) {
  const sessionHash = getSessionHash(request);
  if (!sessionHash) return null;
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
    FROM smartmove_database.web_sessions s
    JOIN smartmove_database.web_passenger_login u
      ON u.passenger_id = s.passenger_id
    WHERE
      s.session_hash = :sessionHash
      AND s.expires_at > SYSTIMESTAMP`,
    { sessionHash },
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
