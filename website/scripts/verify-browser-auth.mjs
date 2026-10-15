// node --env-file=.env.local scripts/verify-browser-auth.mjs
// Real handlers and Oracle run on one rollback-only connection. No server needed.
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import { randomBytes, randomInt } from "node:crypto"
import { SignJWT } from "jose"

const website = fileURLToPath(new URL("../", import.meta.url))
const require = createRequire(import.meta.url)
const ts = require("typescript")
const oracle = require("oracledb")
const { NextRequest } = require("next/server")
oracle.outFormat = oracle.OUT_FORMAT_OBJECT
const connection = await oracle.getConnection({
  user: process.env.ORACLE_USER,
  password: process.env.ORACLE_PASSWORD,
  connectString: process.env.ORACLE_CONNECT_STRING,
})
const modules = new Map()
const tracked = {
  execute: (...a) => connection.execute(...a),
  commit: async () => {},
  rollback: () => connection.execute("ROLLBACK TO auth_request"),
  close: async () => {},
}
function load(relative) {
  const filename = path.resolve(website, relative)
  if (filename === path.join(website, "lib/server/oracle.ts"))
    return { oracledb: oracle, getConnection: async () => tracked }
  if (modules.has(filename)) return modules.get(filename).exports
  const loaded = { exports: {} }
  modules.set(filename, loaded)
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText
  new Function("require", "module", "exports", code)(
    (name) => {
      if (name === "server-only") return {}
      if (name.startsWith("@/")) return load(`${name.slice(2)}.ts`)
      if (name.startsWith("."))
        return load(path.resolve(path.dirname(filename), `${name}.ts`))
      return require(name)
    },
    loaded,
    loaded.exports
  )
  return loaded.exports
}
const req = (token, url = "/api/auth/me", extras = {}) =>
  new NextRequest(`http://localhost${url}`, {
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...extras,
    },
  })
let assertions = 0
const check = (a, b, reason) => {
  assert.deepEqual(a, b, reason)
  assertions++
}
const core = [
  ...fs
    .readFileSync(
      path.join(website, "../database/database/oracle/02_schema.sql"),
      "utf8"
    )
    .matchAll(/^CREATE TABLE (\w+)/gm),
].map((m) => m[1])
const counts = async () =>
  Object.fromEntries(
    await Promise.all(
      core.map(async (t) => [
        t,
        (
          await connection.execute(
            `SELECT COUNT(*) N FROM smartmove_database.${t}`
          )
        ).rows[0].N,
      ])
    )
  )
const before = await counts()
try {
  const auth = load("lib/server/auth.ts"),
    adminAuth = load("lib/server/admin-auth.ts"),
    jwt = load("lib/server/auth-token.ts")
  const passenger = (
    await connection.execute(
      "SELECT user_id, passenger_id FROM smartmove_database.web_passenger_login FETCH FIRST 1 ROW ONLY"
    )
  ).rows[0]
  const admin = (
    await connection.execute(
      "SELECT user_id FROM smartmove_database.web_admin_login FETCH FIRST 1 ROW ONLY"
    )
  ).rows[0]
  const { token: pt, expiresAt } = await auth.createSession(
    connection,
    passenger.PASSENGER_ID
  )
  const { token: at } = await adminAuth.createAdminSession(
    connection,
    admin.USER_ID
  )
  check(
    (await auth.getPassenger(req(pt), connection)).userId,
    passenger.USER_ID,
    "Passenger identity"
  )
  check(
    (await adminAuth.getAdmin(req(at), connection)).id,
    admin.USER_ID,
    "Admin identity"
  )
  check(
    await adminAuth.getAdmin(req(pt), connection),
    null,
    "Passenger cannot become admin"
  )
  check(
    await auth.getPassenger(req(at), connection),
    null,
    "Admin token cannot impersonate passenger"
  )
  check(
    await jwt.readAuthToken(
      req(undefined, undefined, {
        cookie: `smartmove_session=${pt}; smartmove_admin_session=${at}`,
      })
    ),
    null,
    "Cookies no longer authenticate"
  )
  const parts = pt.split(".")
  parts[1] = Buffer.from(
    JSON.stringify({
      ...JSON.parse(Buffer.from(parts[1], "base64url")),
      role: "ADMIN",
    })
  ).toString("base64url")
  check(
    await jwt.readAuthToken(req(parts.join("."))),
    null,
    "Modified role rejected"
  )
  check(
    await jwt.readAuthToken(req("broken.token.value")),
    null,
    "Malformed JWT rejected"
  )
  const now = Math.floor(Date.now() / 1000),
    week = 604800
  async function signed(key, options = {}) {
    return new SignJWT({ role: options.role ?? "PASSENGER" })
      .setProtectedHeader({ alg: options.alg ?? "HS256" })
      .setSubject(String(passenger.USER_ID))
      .setIssuer(options.issuer ?? "smartmove")
      .setAudience(options.audience ?? "smartmove-web")
      .setIssuedAt(options.iat ?? now)
      .setExpirationTime(options.exp ?? now + week)
      .sign(key)
  }
  const key = Buffer.from(process.env.AUTH_TOKEN_SECRET, "base64")
  for (const token of [
    await signed(randomBytes(32)),
    await signed(key, { exp: now - 1, iat: now - week - 1 }),
    await signed(key, { issuer: "wrong" }),
    await signed(key, { audience: "wrong" }),
    await signed(key, { alg: "HS384" }),
    await signed(key, { role: "STAFF" }),
  ])
    check(await jwt.readAuthToken(req(token)), null, "Invalid token rejected")
  const payload = JSON.parse(Buffer.from(pt.split(".")[1], "base64url"))
  check(payload.exp - payload.iat, week, "Fixed seven-day expiry")
  check(
    new Date(expiresAt).getTime(),
    payload.exp * 1000,
    "Response expiry agrees with JWT"
  )
  const roleChanged = { execute: async () => ({ rows: [] }) }
  check(
    await adminAuth.getAdmin(req(at), roleChanged),
    null,
    "Deleted or demoted account denied"
  )
  check(
    await auth.getPassenger(req(pt), roleChanged),
    null,
    "Removed passenger denied"
  )

  const me = load("app/api/auth/me/route.ts")
  check((await me.GET(req(pt))).status, 200, "Current passenger endpoint")
  check((await me.GET(req("broken"))).status, 401, "Invalid current identity")
  const booking = (
    await connection.execute(
      "SELECT booking_id FROM smartmove_database.bookings WHERE passenger_id <> :id FETCH FIRST 1 ROW ONLY",
      { id: passenger.PASSENGER_ID }
    )
  ).rows[0]
  if (booking)
    check(
      (
        await load("app/api/bookings/[id]/route.ts").GET(
          req(pt, `/api/bookings/${booking.BOOKING_ID}`),
          { params: Promise.resolve({ id: String(booking.BOOKING_ID) }) }
        )
      ).status,
      404,
      "Another passenger's booking is denied"
    )

  // Real signup and both login roles, with every inserted Oracle row rolled back.
  await connection.execute("SAVEPOINT auth_request")
  const stamp = randomBytes(8).toString("hex"),
    password = randomBytes(18).toString("base64url")
  const signupBody = {
    name: "Authentication check",
    phone: "0771234567",
    email: `auth-${stamp}@example.test`,
    password,
  }
  const post = (url, body) =>
    new NextRequest(`http://localhost${url}`, {
      method: "POST",
      headers: {
        origin: "http://localhost",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    })
  const signup = await load("app/api/auth/signup/route.ts").POST(
    post("/api/auth/signup", signupBody)
  )
  check(signup.status, 201, "Signup succeeds")
  const created = await signup.json()
  check(
    Boolean(created.token && created.expiresAt),
    true,
    "Signup returns browser credentials"
  )
  check(
    Boolean(await auth.getPassenger(req(created.token), connection)),
    true,
    "Signup token validates"
  )
  const login = await load("app/api/auth/login/route.ts").POST(
    post("/api/auth/login", signupBody)
  )
  check(login.status, 200, "Passenger login succeeds")
  check((await login.json()).role, "PASSENGER", "Passenger login role")
  const adminId = randomInt(1_000_000, 2 ** 40),
    adminEmail = `admin-${stamp}@example.test`
  await connection.execute(
    "BEGIN smartmove_database.add_app_user(:id,:email,:hash,'ADMIN'); END;",
    { id: adminId, email: adminEmail, hash: await auth.hashPassword(password) }
  )
  const adminLogin = await load("app/api/auth/login/route.ts").POST(
    post("/api/auth/login", { email: adminEmail, password })
  )
  check(adminLogin.status, 200, "Admin login succeeds")
  check(
    Boolean(
      await adminAuth.getAdmin(req((await adminLogin.json()).token), connection)
    ),
    true,
    "Admin login token validates"
  )
  await connection.rollback()

  // Compare real Oracle event queries with the former baseline-table queries.
  const queries = [],
    noEvents = {
      execute: async (sql, binds) => {
        queries.push([sql, binds])
        return { rows: [] }
      },
    }
  const noMongo = {
    collection: () => {
      throw new Error("No events should access MongoDB")
    },
  }
  const notifications = load("lib/server/notifications.ts")
  await notifications.reconcileNotifications(
    noEvents,
    noMongo,
    passenger.USER_ID,
    passenger.PASSENGER_ID
  )
  check(queries.length, 4, "All notification queries captured")
  const baselinePresent = (
    await connection.execute(
      "SELECT COUNT(*) N FROM all_tables WHERE owner='SMARTMOVE_DATABASE' AND table_name='WEB_NOTIFICATION_BASELINE'"
    )
  ).rows[0].N
  for (const [index, [sql, binds]] of queries.entries()) {
    const current = (await connection.execute(sql, binds)).rows
    check(
      Array.isArray(current),
      true,
      "Notification query works against the current Oracle schema"
    )
    if (baselinePresent && index < 3) {
      const oldSql = sql.replace(
        /:startedAt/g,
        "(SELECT started_at FROM smartmove_database.web_notification_baseline WHERE baseline_id=1)"
      )
      check(
        current,
        (
          await connection.execute(oldSql, {
            passengerId: passenger.PASSENGER_ID,
          })
        ).rows,
        "Configured cutoff preserves original query results"
      )
    }
  }
  const cutoff = process.env.NOTIFICATIONS_START_AT
  for (const value of [undefined, "invalid", "1"]) {
    if (value === undefined) delete process.env.NOTIFICATIONS_START_AT
    else process.env.NOTIFICATIONS_START_AT = value
    await assert.rejects(
      () => notifications.reconcileNotifications(noEvents, noMongo, 1, 1),
      /NOTIFICATIONS_START_AT/
    )
    assertions++
  }
  process.env.NOTIFICATIONS_START_AT = cutoff

  const events = new Map(),
    eventDate = new Date(cutoff),
    fakeDb = {
      collection: () => ({
        updateOne: async (filter, update) => {
          if (!events.has(filter.eventKey))
            events.set(filter.eventKey, update.$setOnInsert)
        },
      }),
    }
  const fakeOracle = {
    execute: async (sql) => ({
      rows: sql.includes("b.booked_at >=")
        ? [{ BOOKING_ID: 999, BOOKED_AT: eventDate }]
        : [],
    }),
  }
  await notifications.reconcileNotifications(fakeOracle, fakeDb, 1, 1)
  await notifications.reconcileNotifications(fakeOracle, fakeDb, 1, 1)
  check(events.size, 1, "Repeated reconciliation does not duplicate alerts")

  // Exercise localStorage, requests and cross-tab events without a dev server.
  const originalWindow = globalThis.window,
    originalFetch = globalThis.fetch
  const eventsTarget = new EventTarget(),
    values = new Map()
  globalThis.window = Object.assign(eventsTarget, {
    location: { origin: "http://localhost" },
    localStorage: {
      getItem: (k) => values.get(k) ?? null,
      setItem: (k, v) => values.set(k, v),
      removeItem: (k) => values.delete(k),
    },
  })
  try {
    const browser = load("lib/client-auth.ts")
    browser.storeAuth({ token: pt, expiresAt })
    check(browser.readAuth().token, pt, "Login survives reading storage again")
    modules.delete(path.join(website, "lib/client-auth.ts"))
    check(
      load("lib/client-auth.ts").readAuth().token,
      pt,
      "Login survives module reload"
    )
    let requestHeaders
    globalThis.fetch = async (_input, init) => {
      requestHeaders = new Headers(init.headers)
      return new Response("{}", { status: 200 })
    }
    await browser.apiFetch("/api/dashboard")
    check(
      requestHeaders.get("authorization"),
      `Bearer ${pt}`,
      "API receives bearer token"
    )
    await browser.apiFetch("https://other.example/api/data")
    check(
      requestHeaders.get("authorization"),
      null,
      "No token sent to external origin"
    )
    globalThis.fetch = async () => new Response("{}", { status: 503 })
    await browser.apiFetch("/api/dashboard")
    check(browser.readAuth().token, pt, "Service outage keeps login")
    let changes = 0
    const unsubscribe = browser.onAuthChange(() => changes++)
    values.delete("smartmove_auth")
    const event = new Event("storage")
    Object.defineProperty(event, "key", { value: "smartmove_auth" })
    window.dispatchEvent(event)
    check(changes, 1, "Other-tab logout notifies subscribers")
    browser.storeAuth({ token: at, expiresAt })
    check(browser.readAuth().token, at, "New login replaces previous identity")
    globalThis.fetch = async () => new Response("{}", { status: 401 })
    await browser.apiFetch("/api/dashboard")
    check(browser.readAuth(), null, "Invalid token clears login")
    values.set(
      "smartmove_auth",
      JSON.stringify({ token: pt, expiresAt: new Date(0).toISOString() })
    )
    check(browser.readAuth(), null, "Expired browser login cleared")
    browser.storeAuth({ token: pt, expiresAt })
    globalThis.fetch = async () => {
      throw new Error("offline")
    }
    await assert.rejects(() => browser.logout(), /offline/)
    check(browser.readAuth(), null, "Logout clears browser even offline")
    unsubscribe()
  } finally {
    globalThis.window = originalWindow
    globalThis.fetch = originalFetch
  }
  console.log(
    `Passed ${assertions} authentication, browser-storage, ownership and notification checks; Oracle fixtures rolled back.`
  )
} finally {
  await connection.rollback()
  check(await counts(), before, "Core row counts restored")
  await connection.close()
}
