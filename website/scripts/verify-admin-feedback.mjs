// Run with: node --env-file=.env.local scripts/verify-admin-feedback.mjs
// Calls the real handlers without a server. Oracle changes roll back; only a
// temporary MongoDB feedback document is written, then removed in finally.
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import { randomInt } from "node:crypto"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("../", import.meta.url))
const require = createRequire(new URL("../package.json", import.meta.url))
const ts = require("typescript")
const oracle = require("oracledb")
const { NextRequest } = require("next/server")
oracle.outFormat = oracle.OUT_FORMAT_OBJECT
const cache = new Map()
const feedbackId = randomInt(1_000_000, 2 ** 48)
let connection
let db
let checks = 0
const tracked = {
  execute: (...args) => connection.execute(...args),
  commit: async () => {},
  rollback: () => connection.execute("ROLLBACK TO feedback_request"),
  close: async () => {},
}
function load(relative) {
  const filename = path.resolve(root, relative)
  if (filename === path.join(root, "lib/server/oracle.ts"))
    return { oracledb: oracle, getConnection: async () => tracked }
  if (cache.has(filename)) return cache.get(filename).exports
  const loaded = { exports: {} }
  cache.set(filename, loaded)
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText
  const dependency = (name) => {
    if (name === "server-only") return {}
    if (name.startsWith("@/")) return load(`${name.slice(2)}.ts`)
    if (name.startsWith("."))
      return load(path.resolve(path.dirname(filename), `${name}.ts`))
    return require(name)
  }
  new Function("require", "module", "exports", code)(
    dependency,
    loaded,
    loaded.exports
  )
  return loaded.exports
}
try {
  connection = await oracle.getConnection({
    user: process.env.ORACLE_USER,
    password: process.env.ORACLE_PASSWORD,
    connectString: process.env.ORACLE_CONNECT_STRING,
  })
  const admin = (
    await connection.execute(
      `SELECT user_id ID FROM smartmove_database.web_admin_login FETCH FIRST 1 ROW ONLY`
    )
  ).rows[0]
  const booking = (
    await connection.execute(
      `SELECT booking_id ID FROM smartmove_database.bookings FETCH FIRST 1 ROW ONLY`
    )
  ).rows[0]
  assert.ok(admin && booking, "An existing admin and booking are required.")
  const auth = load("lib/server/admin-auth.ts")
  const token = await auth.createAdminSession(connection, admin.ID)
  const handlers = load("app/api/admin/[resource]/route.ts")
  const actions = load("app/api/admin/actions/route.ts")
  async function request(
    resource,
    method,
    input,
    expected = 200,
    options = {}
  ) {
    await connection.execute("SAVEPOINT feedback_request")
    const req = new NextRequest(`http://localhost/api/admin/${resource}`, {
      method,
      headers: {
        origin: options.origin ?? "http://localhost",
        ...(options.anonymous
          ? {}
          : { cookie: `${auth.ADMIN_COOKIE}=${token}` }),
        ...(method === "GET" ? {} : { "content-type": "application/json" }),
      },
      ...(method === "GET" ? {} : { body: JSON.stringify(input) }),
    })
    const response = await (resource === "actions" ? actions : handlers)[
      method
    ](req, {
      params: Promise.resolve({ resource }),
    })
    const data = await response.json()
    assert.equal(
      response.status,
      expected,
      data.error ?? `${method} ${resource}`
    )
    checks++
    return data
  }
  await connection.execute(
    "BEGIN smartmove_database.add_feedback(:id, :booking, 'COMPLAINT'); END;",
    { id: feedbackId, booking: booking.ID }
  )
  db = await load("lib/server/mongo.ts").getMongoDb()
  const content = db.collection("feedback_content")
  await content.insertOne({
    feedbackId: String(feedbackId),
    comment: "Original passenger message",
    vehicleRating: 4,
  })
  const reply = {
    id: feedbackId,
    action: "reply",
    message: "  Thank you; we have followed up.  ",
  }
  await request("feedback", "PATCH", reply, 401, { anonymous: true })
  await request("feedback", "PATCH", reply, 403, {
    origin: "https://untrusted.example",
  })
  await request("feedback", "PATCH", { ...reply, message: "   " }, 400)
  await request(
    "feedback",
    "PATCH",
    { ...reply, message: "x".repeat(2001) },
    400
  )
  await request("feedback", "PATCH", { ...reply, action: "delete" }, 400)
  await request("feedback", "DELETE", { id: feedbackId }, 400)
  await request("feedback", "PATCH", reply)
  const saved = await content.findOne({ feedbackId: String(feedbackId) })
  assert.equal(saved.comment, "Original passenger message")
  assert.equal(saved.vehicleRating, 4)
  assert.equal(saved.reply.message, reply.message.trim())
  await request("feedback", "PATCH", { id: feedbackId, action: "resolve" })
  let rows = (await request("feedback", "GET")).result
  assert.equal(rows.find((row) => row.id === feedbackId)?.status, "RESOLVED")
  assert.equal(
    rows.find((row) => row.id === feedbackId)?.reply,
    reply.message.trim()
  )
  await request("feedback", "PATCH", { id: feedbackId, action: "reopen" })
  rows = (await request("feedback", "GET")).result
  assert.equal(rows.find((row) => row.id === feedbackId)?.status, "OPEN")
  const trips = (await request("trips", "GET")).result
  assert.ok(
    trips.every((row) => row.canComplete === 0 || row.canComplete === 1)
  )
  for (const eligible of [false, true]) {
    const trip = (
      await connection.execute(
        `SELECT trip_id ID FROM smartmove_database.trips
       WHERE status = 'SCHEDULED' AND arrival_at ${eligible ? "<=" : ">"} SYSDATE
       FETCH FIRST 1 ROW ONLY`
      )
    ).rows[0]
    if (!trip) {
      console.log(
        `Skipped ${eligible ? "arrived" : "future"} trip check: no matching fixture.`
      )
      continue
    }
    await request(
      "actions",
      "POST",
      { action: "complete_trip", id: trip.ID },
      eligible ? 200 : 409
    )
    if (eligible) {
      const status = (
        await connection.execute(
          "SELECT status FROM smartmove_database.trips WHERE trip_id = :id",
          { id: trip.ID }
        )
      ).rows[0].STATUS
      assert.equal(status, "COMPLETED")
      const pending = (
        await connection.execute(
          "SELECT COUNT(*) TOTAL FROM smartmove_database.bookings WHERE trip_id = :id AND status = 'PENDING'",
          { id: trip.ID }
        )
      ).rows[0].TOTAL
      assert.equal(pending, 0)
    }
  }
  console.log(
    `Passed ${checks} handler checks: feedback authorization, validation, reply preservation, resolve/reopen, and trip completion.`
  )
} finally {
  try {
    if (db)
      await db
        .collection("feedback_content")
        .deleteOne({ feedbackId: String(feedbackId) })
  } finally {
    if (connection) {
      await connection.rollback()
      const remaining = (
        await connection.execute(
          "SELECT COUNT(*) TOTAL FROM smartmove_database.feedback_records WHERE feedback_id = :id",
          { id: feedbackId }
        )
      ).rows[0].TOTAL
      assert.equal(
        remaining,
        0,
        "Temporary Oracle feedback must be rolled back."
      )
      await connection.close()
    }
    await (await globalThis.smartmoveMongo)?.close()
  }
}
