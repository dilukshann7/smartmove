"use client"

const KEY = "smartmove_auth"
const EVENT = "smartmove-auth-change"
type StoredAuth = { token: string; expiresAt: string }

export function clearAuth() {
  try {
    window.localStorage.removeItem(KEY)
  } finally {
    window.dispatchEvent(new Event(EVENT))
  }
}

export function storeAuth(auth: StoredAuth) {
  if (
    !auth.token ||
    !Number.isFinite(Date.parse(auth.expiresAt)) ||
    Date.parse(auth.expiresAt) <= Date.now()
  )
    throw new Error("Unable to sign in. Please try again.")
  window.localStorage.setItem(
    KEY,
    JSON.stringify({ token: auth.token, expiresAt: auth.expiresAt })
  )
  window.dispatchEvent(new Event(EVENT))
}

export function readAuth(): StoredAuth | null {
  if (typeof window === "undefined") return null
  try {
    const value = window.localStorage.getItem(KEY)
    if (!value) return null
    const auth = JSON.parse(value) as StoredAuth
    if (
      typeof auth.token !== "string" ||
      !auth.token ||
      typeof auth.expiresAt !== "string" ||
      !Number.isFinite(Date.parse(auth.expiresAt)) ||
      Date.parse(auth.expiresAt) <= Date.now()
    ) {
      clearAuth()
      return null
    }
    return auth
  } catch {
    try {
      clearAuth()
    } catch {
      /* Storage may be disabled. */
    }
    return null
  }
}

export function onAuthChange(listener: () => void) {
  let timer: ReturnType<typeof setTimeout> | undefined
  const changed = () => {
    clearTimeout(timer)
    listener()
    scheduleExpiry()
  }
  const scheduleExpiry = () => {
    const auth = readAuth()
    if (auth)
      timer = setTimeout(
        () => {
          readAuth()
        },
        Math.min(
          2 ** 31 - 1,
          Math.max(1, Date.parse(auth.expiresAt) - Date.now())
        )
      )
  }
  const storage = (event: StorageEvent) => {
    if (event.key === KEY || event.key === null) changed()
  }
  window.addEventListener(EVENT, changed)
  window.addEventListener("storage", storage)
  scheduleExpiry()
  return () => {
    clearTimeout(timer)
    window.removeEventListener(EVENT, changed)
    window.removeEventListener("storage", storage)
  }
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit) {
  const url = new URL(
    input instanceof Request ? input.url : String(input),
    window.location.origin
  )
  const localApi =
    url.origin === window.location.origin && url.pathname.startsWith("/api/")
  const auth = localApi ? readAuth() : null
  const headers = new Headers(
    init?.headers ?? (input instanceof Request ? input.headers : undefined)
  )
  if (localApi) {
    headers.delete("Authorization")
    if (auth) headers.set("Authorization", `Bearer ${auth.token}`)
  }
  const response = await fetch(input, { ...init, headers })
  // An old failed request must not erase a newer login.
  if (
    localApi &&
    response.status === 401 &&
    auth &&
    readAuth()?.token === auth.token
  )
    clearAuth()
  return response
}

export async function logout() {
  try {
    await apiFetch("/api/auth/logout", { method: "POST" })
  } finally {
    clearAuth()
  }
}
