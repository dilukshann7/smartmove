import "server-only"

import { SignJWT, jwtVerify } from "jose"
import type { NextRequest, NextResponse } from "next/server"

export type AuthRole = "ADMIN" | "PASSENGER"
const ISSUER = "smartmove"
const AUDIENCE = "smartmove-web"
const LIFETIME = 7 * 24 * 60 * 60

function signingKey() {
  const encoded = process.env.AUTH_TOKEN_SECRET
  if (!encoded || !/^[A-Za-z0-9+/]{43}=$/.test(encoded))
    throw new Error("AUTH_TOKEN_SECRET must contain 32 random bytes in base64")
  const key = Buffer.from(encoded, "base64")
  if (key.length !== 32) throw new Error("Invalid AUTH_TOKEN_SECRET")
  return key
}

export async function createAuthToken(userId: number, role: AuthRole) {
  const issuedAt = Math.floor(Date.now() / 1000)
  const expires = issuedAt + LIFETIME
  const token = await new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(String(userId))
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(issuedAt)
    .setExpirationTime(expires)
    .sign(signingKey())
  return { token, expiresAt: new Date(expires * 1000).toISOString() }
}

export function hasBearerToken(request: Pick<NextRequest, "headers">) {
  return request.headers.has("authorization")
}

export async function readAuthToken(request: Pick<NextRequest, "headers">) {
  const header = request.headers.get("authorization")
  if (!header) return null
  const match = /^Bearer ([A-Za-z0-9_.-]{1,4096})$/i.exec(header)
  if (!match) return null
  const key = signingKey()
  try {
    const { payload } = await jwtVerify(match[1], key, {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: AUDIENCE,
      requiredClaims: ["sub", "role", "iat", "exp"],
      maxTokenAge: LIFETIME,
    })
    const userId = Number(payload.sub)
    if (
      !/^[1-9]\d*$/.test(payload.sub ?? "") ||
      !Number.isSafeInteger(userId) ||
      (payload.role !== "ADMIN" && payload.role !== "PASSENGER") ||
      typeof payload.iat !== "number" ||
      typeof payload.exp !== "number" ||
      payload.exp - payload.iat !== LIFETIME ||
      payload.iat > Math.floor(Date.now() / 1000)
    )
      return null
    return { userId, role: payload.role as AuthRole }
  } catch {
    return null
  }
}

export function clearLegacyCookies(response: NextResponse) {
  for (const name of ["smartmove_session", "smartmove_admin_session"])
    response.cookies.set(name, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    })
  response.headers.set("Cache-Control", "no-store")
}
