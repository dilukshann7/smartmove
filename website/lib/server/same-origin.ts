import type { NextRequest } from "next/server"

export function sameOrigin(request: Pick<NextRequest, "headers" | "url">) {
  const origin = request.headers.get("origin")
  if (!origin) return true

  const requestOrigin = new URL(request.url)
  let requestOriginHeader: URL
  try {
    requestOriginHeader = new URL(origin)
  } catch {
    return false
  }

  if (requestOriginHeader.origin === requestOrigin.origin) return true
  if (process.env.NODE_ENV !== "development") return false

  const loopbackHosts = new Set(["localhost", "127.0.0.1"])
  return (
    loopbackHosts.has(requestOrigin.hostname) &&
    loopbackHosts.has(requestOriginHeader.hostname) &&
    requestOriginHeader.protocol === requestOrigin.protocol &&
    requestOriginHeader.port === requestOrigin.port
  )
}
