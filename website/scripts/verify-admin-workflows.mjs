// Run with: node --env-file=.env.local scripts/verify-admin-workflows.mjs
// Real API handlers and Oracle procedures run on one connection. Commits are
// suppressed, failed requests roll back to a savepoint, and fixtures roll back.
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import { randomInt } from "node:crypto"
import { fileURLToPath } from "node:url"

const website = fileURLToPath(new URL("../", import.meta.url))
const require = createRequire(new URL("../package.json", import.meta.url))
const ts = require("typescript")
const oracledb = require("oracledb")
const { NextRequest } = require("next/server")
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT

let connection
let announcementId
let mongoDb
let checks = 0
const modules = new Map()
const tables = [
  "app_users",
  "passengers",
  "drivers",
  "vehicles",
  "routes",
  "trips",
  "bookings",
  "tickets",
  "payments",
  "refunds",
  "maintenance_records",
  "feedback_records",
  "booking_status_history",
]
const freshId = () => randomInt(1_000_000, 2 ** 48)
const tag = freshId().toString(36)
const tracked = {
  execute: (...args) => connection.execute(...args),
  commit: async () => {},
  rollback: () => connection.execute("ROLLBACK TO admin_request"),
  close: async () => {},
}

function load(relative) {
  const filename = path.resolve(website, relative)
  if (filename === path.join(website, "lib/server/oracle.ts"))
    return { oracledb, getConnection: async () => tracked }
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
  function dependency(name) {
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

async function snapshot() {
  const counts = {}
  for (const table of tables) {
    const result = await connection.execute(
      `SELECT COUNT(*) "count" FROM smartmove_database.${table}`
    )
    counts[table] = result.rows[0].count
  }
  return counts
}

let original
try {
  connection = await oracledb.getConnection({
    user: process.env.ORACLE_USER,
    password: process.env.ORACLE_PASSWORD,
    connectString: process.env.ORACLE_CONNECT_STRING,
  })
  original = await snapshot()
  const auth = load("lib/server/admin-auth.ts")
  const admin = (
    await connection.execute(
      `SELECT user_id "id" FROM smartmove_database.web_admin_login FETCH FIRST 1 ROW ONLY`
    )
  ).rows[0]
  const passenger = (
    await connection.execute(
      `SELECT passenger_id "id", full_name "name", phone "phone"
     FROM smartmove_database.passengers ORDER BY passenger_id FETCH FIRST 1 ROW ONLY`
    )
  ).rows[0]
  assert.ok(
    admin && passenger,
    "Existing admin and passenger fixtures are required."
  )
  const { token } = await auth.createAdminSession(connection, admin.id)
  const authorization = `Bearer ${token}`
  const dates = (
    await connection.execute(
      `SELECT TO_CHAR(SYSDATE, 'YYYY-MM-DD') "today",
            TO_CHAR(TRUNC(SYSDATE)-1, 'YYYY-MM-DD') "past",
            TO_CHAR(TRUNC(SYSDATE)+90, 'YYYY-MM-DD') "future",
            TO_CHAR(TRUNC(SYSDATE)+91, 'YYYY-MM-DD') "rescheduled",
            TO_CHAR(TRUNC(SYSDATE)+92, 'YYYY-MM-DD') "service",
            TO_CHAR(TRUNC(SYSDATE)+93, 'YYYY-MM-DD') "serviceEdit"
     FROM dual`
    )
  ).rows[0]
  const resources = load("app/api/admin/[resource]/route.ts")
  const actions = load("app/api/admin/actions/route.ts")
  const announcements = load("app/api/admin/announcements/route.ts")

  async function request(resource, method, input, expected = 200, explanation) {
    await connection.execute("SAVEPOINT admin_request")
    const req = new NextRequest(`http://localhost/api/admin/${resource}`, {
      method,
      headers: {
        authorization,
        "Content-Type": "application/json",
        origin: "http://localhost",
      },
      ...(method === "GET" ? {} : { body: JSON.stringify(input) }),
    })
    const handler =
      resource === "actions"
        ? actions
        : resource === "announcements"
          ? announcements
          : resources
    const response = await handler[method](req, {
      params: Promise.resolve({ resource }),
    })
    const data = await response.json()
    assert.equal(
      response.status,
      expected,
      `${method} ${resource}: ${data.error ?? "unexpected status"}`
    )
    if (explanation) assert.match(data.error, explanation)
    assert.notEqual(data.error, "Admin action is temporarily unavailable.")
    checks++
    return data.result
  }

  const route = await request("routes", "POST", {
    name: `Workflow ${tag}`,
    origin: "Test origin",
    destination: "Test destination",
    baseFare: 500,
  })
  await request("routes", "PATCH", {
    id: route.id,
    name: `Workflow ${tag}`,
    baseFare: 550,
  })
  await request(
    "routes",
    "POST",
    { name: "Invalid", origin: "Same", destination: "same", baseFare: 1 },
    400,
    /different origin/
  )
  await request(
    "routes",
    "PATCH",
    { id: route.id, name: "Invalid", baseFare: 100_000_000 },
    400,
    /valid fare/
  )
  await request(
    "routes",
    "PATCH",
    { id: route.id, name: "Invalid", baseFare: 1.123 },
    400,
    /decimal places/
  )

  const vehicleForm = {
    registrationNumber: `TEST-${tag}`,
    vehicleType: "BUS",
    seatCount: 20,
  }
  const vehicle = await request("vehicles", "POST", vehicleForm)
  await request("vehicles", "PATCH", {
    ...vehicleForm,
    id: vehicle.id,
    status: "ACTIVE",
  })
  await request("vehicles", "POST", vehicleForm, 409, /already exists/)
  await request(
    "vehicles",
    "POST",
    { ...vehicleForm, seatCount: 1.5 },
    400,
    /seat count/
  )
  await request(
    "vehicles",
    "POST",
    { ...vehicleForm, seatCount: 1000 },
    400,
    /between 1 and 999/
  )

  const driverForm = {
    name: "Workflow test driver",
    phone: "0770000000",
    licenceNumber: `TEST-${tag}`,
  }
  const driver = await request("drivers", "POST", driverForm)
  await request("drivers", "PATCH", { ...driverForm, id: driver.id })
  await request("drivers", "POST", driverForm, 409, /already exists/)
  await request("passengers", "PATCH", {
    id: passenger.id,
    name: passenger.name,
    phone: passenger.phone,
  })

  const tripForm = {
    routeId: route.id,
    vehicleId: vehicle.id,
    driverId: driver.id,
    departureAt: `${dates.future}T10:00`,
    arrivalAt: `${dates.future}T12:00`,
  }
  const trip = await request("trips", "POST", tripForm)
  const rescheduled = {
    ...tripForm,
    id: trip.id,
    departureAt: `${dates.rescheduled}T10:00`,
    arrivalAt: `${dates.rescheduled}T12:00`,
  }
  await request("trips", "PATCH", rescheduled)
  await request("trips", "POST", rescheduled, 409, /availability/)
  await request(
    "trips",
    "POST",
    { ...tripForm, arrivalAt: tripForm.departureAt },
    400,
    /after departure/
  )
  await request(
    "vehicles",
    "PATCH",
    { ...vehicleForm, id: vehicle.id, seatCount: 19, status: "ACTIVE" },
    409,
    /capacity/
  )
  await request(
    "vehicles",
    "PATCH",
    { ...vehicleForm, id: vehicle.id, status: "MAINTENANCE" },
    409,
    /scheduled trips/
  )

  const serviceForm = {
    vehicleId: vehicle.id,
    type: "Workflow service",
    scheduledDate: dates.service,
  }
  await request(
    "maintenance",
    "POST",
    { ...serviceForm, scheduledDate: dates.past },
    400,
    /today or a future date/
  )
  await request(
    "maintenance",
    "POST",
    { ...serviceForm, scheduledDate: "2026-02-30" },
    400,
    /valid Sri Lanka date/
  )
  await request(
    "maintenance",
    "POST",
    { ...serviceForm, scheduledDate: dates.rescheduled },
    409,
    /without scheduled trips/
  )
  const service = await request("maintenance", "POST", serviceForm)
  await request("maintenance", "PATCH", {
    id: service.id,
    type: "Updated service",
    scheduledDate: dates.serviceEdit,
  })
  await request(
    "actions",
    "POST",
    { action: "complete_maintenance", id: service.id, cost: 50 },
    409,
    /due today or earlier/
  )
  await request("maintenance", "DELETE", { id: service.id })
  const due = await request("maintenance", "POST", {
    ...serviceForm,
    scheduledDate: dates.today,
  })
  await request(
    "actions",
    "POST",
    { action: "complete_maintenance", id: due.id, cost: -1 },
    400,
    /maintenance cost/
  )
  await request("actions", "POST", {
    action: "complete_maintenance",
    id: due.id,
    cost: 50,
  })
  await request(
    "actions",
    "POST",
    { action: "complete_maintenance", id: due.id, cost: 50 },
    409,
    /unfinished service/
  )

  async function booking(seat) {
    const id = freshId()
    await connection.execute(
      "BEGIN smartmove_database.create_booking(:id, :passenger, :trip); END;",
      { id, passenger: passenger.id, trip: trip.id }
    )
    await connection.execute(
      "BEGIN smartmove_database.reserve_seat(:ticket, :booking, :seat); END;",
      { ticket: freshId(), booking: id, seat }
    )
    const payment = await request("actions", "POST", {
      action: "record_payment",
      id,
      method: "CASH",
    })
    assert.equal(payment.amount, 550)
    return id
  }
  const firstBooking = await booking(1)
  await request(
    "actions",
    "POST",
    { action: "record_payment", id: firstBooking, method: "CASH" },
    400,
    /reserved seats/
  )
  const cancellation = await request("actions", "POST", {
    action: "cancel_booking",
    id: firstBooking,
  })
  assert.equal(cancellation.refundAmount, 550)
  await request("actions", "POST", {
    action: "cancel_booking",
    id: firstBooking,
  })
  assert.equal(
    (
      await request("actions", "POST", {
        action: "record_refund",
        id: firstBooking,
      })
    ).changed,
    0
  )
  const secondBooking = await booking(2)
  await connection.execute(
    "BEGIN smartmove_database.cancel_booking(:id); END;",
    { id: secondBooking }
  )
  assert.equal(
    (
      await request("actions", "POST", {
        action: "record_refund",
        id: secondBooking,
      })
    ).changed,
    1
  )
  assert.equal(
    (
      await request("actions", "POST", {
        action: "record_refund",
        id: secondBooking,
      })
    ).changed,
    0
  )
  await booking(3)
  assert.equal(
    (await request("actions", "POST", { action: "cancel_trip", id: trip.id }))
      .refundCount,
    1
  )
  assert.equal(
    (await request("actions", "POST", { action: "cancel_trip", id: trip.id }))
      .changed,
    0
  )
  await request("trips", "PATCH", rescheduled, 409, /unbooked future trip/)
  await request(
    "actions",
    "POST",
    { action: "complete_trip", id: trip.id },
    409,
    /after its arrival time/
  )
  await request("routes", "DELETE", { id: route.id }, 409, /related history/)
  await request("drivers", "DELETE", { id: driver.id }, 409, /related history/)
  await request(
    "vehicles",
    "DELETE",
    { id: vehicle.id },
    409,
    /related history/
  )

  const arrived = (
    await connection.execute(
      `SELECT trip_id "id" FROM smartmove_database.trips
     WHERE status = 'SCHEDULED' AND arrival_at <= SYSDATE FETCH FIRST 1 ROW ONLY`
    )
  ).rows[0]
  if (arrived)
    await request("actions", "POST", {
      action: "complete_trip",
      id: arrived.id,
    })

  const emptyRoute = await request("routes", "POST", {
    name: "Delete test",
    origin: "A",
    destination: "B",
    baseFare: 1,
  })
  await request("routes", "DELETE", { id: emptyRoute.id })
  const emptyVehicle = await request("vehicles", "POST", {
    ...vehicleForm,
    registrationNumber: `DEL-${tag}`,
  })
  await request("vehicles", "DELETE", { id: emptyVehicle.id })
  const emptyDriver = await request("drivers", "POST", {
    ...driverForm,
    licenceNumber: `DEL-${tag}`,
  })
  await request("drivers", "DELETE", { id: emptyDriver.id })
  const emptyTrip = await request("trips", "POST", {
    ...tripForm,
    departureAt: `${dates.future}T14:00`,
    arrivalAt: `${dates.future}T16:00`,
  })
  await request("trips", "DELETE", { id: emptyTrip.id })

  mongoDb = await load("lib/server/mongo.ts").getMongoDb()
  const notice = await request("announcements", "POST", {
    title: `Private workflow test ${tag}`,
    body: "Temporary private announcement test.",
    status: "DRAFT",
  })
  announcementId = notice.id
  await request("announcements", "PATCH", {
    id: notice.id,
    title: "Updated private test",
    body: "Temporary private announcement test.",
    status: "ARCHIVED",
  })
  await request(
    "announcements",
    "POST",
    { title: "x", body: "x", status: "DRAFT" },
    400,
    /title, message/
  )
  for (const resource of [
    "routes",
    "vehicles",
    "drivers",
    "passengers",
    "trips",
    "maintenance",
    "bookings",
    "refunds",
    "feedback",
    "announcements",
  ])
    await request(resource, "GET")

  console.log(
    `Passed ${checks} admin handler checks: valid saves/deletes, actionable validation errors, finance/refund workflows, announcements, and all resource reads.`
  )
} finally {
  if (announcementId && mongoDb) {
    const { ObjectId } = require("mongodb")
    await mongoDb
      .collection("announcements")
      .deleteOne({ _id: new ObjectId(announcementId) })
  }
  if (connection) {
    try {
      await connection.rollback()
      if (original) {
        assert.deepEqual(
          await snapshot(),
          original,
          "Oracle row counts changed after rollback."
        )
        console.log(
          "Oracle fixtures rolled back; private MongoDB test notice removed."
        )
      }
    } finally {
      await connection.close()
    }
  }
  const mongo = await globalThis.smartmoveMongo
  await mongo?.close()
}
