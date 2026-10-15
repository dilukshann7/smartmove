// node --env-file=.env.local scripts/verify-admin-media.mjs
// Real route handlers and databases, without a server. Oracle sessions roll
// back and all temporary image metadata/GridFS files are removed in finally.
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import { randomUUID } from "node:crypto"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("../", import.meta.url))
const require = createRequire(new URL("../package.json", import.meta.url))
const ts = require("typescript")
const oracle = require("oracledb")
const sharp = require("sharp")
const { GridFSBucket, ObjectId } = require("mongodb")
const { NextRequest } = require("next/server")
oracle.outFormat = oracle.OUT_FORMAT_OBJECT
const cache = new Map()
const tag = `Upload verification ${randomUUID()}`
let connection
let db
let original
let checks = 0
const temporary = []
const tracked = {
  execute: (...args) => connection.execute(...args),
  commit: async () => {},
  rollback: () => connection.execute("ROLLBACK TO media_request"),
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
async function snapshot() {
  return Object.fromEntries(
    await Promise.all(
      [
        "vehicle_assets",
        "trip_media",
        "media_files.files",
        "media_files.chunks",
      ].map(async (name) => [name, await db.collection(name).countDocuments()])
    )
  )
}
try {
  connection = await oracle.getConnection({
    user: process.env.ORACLE_USER,
    password: process.env.ORACLE_PASSWORD,
    connectString: process.env.ORACLE_CONNECT_STRING,
  })
  const admin = (
    await connection.execute(
      "SELECT user_id ID FROM smartmove_database.web_admin_login FETCH FIRST 1 ROW ONLY"
    )
  ).rows[0]
  const trip = (
    await connection.execute(
      "SELECT trip_id ID, vehicle_id VEHICLE FROM smartmove_database.trips FETCH FIRST 1 ROW ONLY"
    )
  ).rows[0]
  assert.ok(admin && trip, "An existing admin and trip are required.")
  const auth = load("lib/server/admin-auth.ts")
  const { token } = await auth.createAdminSession(connection, admin.ID)
  db = await load("lib/server/mongo.ts").getMongoDb()
  original = await snapshot()
  const handler = load("app/api/admin/media/route.ts")
  const download = load("app/api/media/[id]/route.ts")
  const gallery = load("app/api/trips/[id]/media/route.ts")
  const media = load("lib/server/media.ts")
  const vehicleTarget = { resource: "vehicles", id: trip.VEHICLE }
  const tripTarget = { resource: "trips", id: trip.ID }
  const png = await sharp({
    create: { width: 2400, height: 1600, channels: 3, background: "#2471d2" },
  })
    .png()
    .toBuffer()
  const smallPng = await sharp(png).resize(80, 60).png().toBuffer()
  function form(
    target = vehicleTarget,
    file = new File([png], "test.png", { type: "image/png" }),
    caption = tag
  ) {
    const data = new FormData()
    data.set("resource", target.resource)
    data.set("id", String(target.id))
    data.set("image", file)
    data.set("caption", caption)
    return data
  }
  async function request(method, body, expected = 200, options = {}) {
    await connection.execute("SAVEPOINT media_request")
    const query =
      method === "GET" ? `?resource=${body.resource}&id=${body.id}` : ""
    const headers = { origin: options.origin ?? "http://localhost" }
    if (!options.anonymous) headers.authorization = `Bearer ${token}`
    if (method === "DELETE") headers["content-type"] = "application/json"
    if (options.contentType) headers["content-type"] = options.contentType
    const req = new NextRequest(`http://localhost/api/admin/media${query}`, {
      method,
      headers,
      ...(method === "GET"
        ? {}
        : { body: method === "DELETE" ? JSON.stringify(body) : body }),
    })
    const response = await handler[method](req)
    const data = await response.json()
    assert.equal(response.status, expected, data.error ?? `${method} image`)
    checks++
    return data.result
  }
  await request("GET", vehicleTarget, 401, { anonymous: true })
  await request("POST", form(), 401, { anonymous: true })
  await request("POST", form(), 403, { origin: "https://untrusted.example" })
  await request("POST", "{}", 415, { contentType: "application/json" })
  await request("POST", form({ ...vehicleTarget, resource: "drivers" }), 400)
  await request(
    "POST",
    form({ ...vehicleTarget, id: Number.MAX_SAFE_INTEGER }),
    400
  )
  await request(
    "POST",
    form(
      vehicleTarget,
      new File(["<svg/>"], "test.svg", { type: "image/svg+xml" })
    ),
    400
  )
  await request(
    "POST",
    form(
      vehicleTarget,
      new File(["not an image"], "fake.png", { type: "image/png" })
    ),
    400
  )
  await request(
    "POST",
    form(vehicleTarget, new File([png], "wrong.jpg", { type: "image/jpeg" })),
    400
  )
  await request(
    "POST",
    form(
      vehicleTarget,
      new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.png", {
        type: "image/png",
      })
    ),
    400
  )
  await request(
    "POST",
    form(
      vehicleTarget,
      new File([smallPng], "valid.png", { type: "image/png" }),
      "x".repeat(161)
    ),
    400
  )
  const listBefore = await request("GET", vehicleTarget)
  const vehicleImage = await request("POST", form())
  temporary.push({ target: vehicleTarget, id: vehicleImage.id })
  const vehicleList = await request("GET", vehicleTarget)
  assert.equal(vehicleList.length, listBefore.length + 1)
  assert.equal(
    vehicleList.find((image) => image.id === vehicleImage.id)?.caption,
    tag
  )
  const vehicleDoc = await db
    .collection("vehicle_assets")
    .findOne({ _id: new ObjectId(vehicleImage.id) })
  assert.equal(vehicleDoc.vehicleId, String(trip.VEHICLE))
  assert.equal(vehicleDoc.uploadedBy, String(admin.ID))
  const response = await download.GET(
    new NextRequest(`http://localhost${vehicleImage.url}`),
    {
      params: Promise.resolve({ id: vehicleImage.url.split("/").at(-1) }),
    }
  )
  assert.equal(response.status, 200)
  assert.equal(response.headers.get("content-type"), "image/webp")
  assert.equal(response.headers.get("x-content-type-options"), "nosniff")
  const downloaded = Buffer.from(await response.arrayBuffer())
  const dimensions = await sharp(downloaded).metadata()
  assert.equal(dimensions.format, "webp")
  assert.equal(dimensions.width, 1920)
  assert.equal(dimensions.height, 1280)
  const tripImage = await request(
    "POST",
    form(
      tripTarget,
      new File([smallPng], "trip.png", { type: "image/png" }),
      `${tag} trip`
    )
  )
  temporary.push({ target: tripTarget, id: tripImage.id })
  const tripResponse = await gallery.GET(
    new NextRequest(`http://localhost/api/trips/${trip.ID}/media`),
    {
      params: Promise.resolve({ id: String(trip.ID) }),
    }
  )
  assert.equal(tripResponse.status, 200)
  const tripImages = (await tripResponse.json()).images
  assert.ok(tripImages.trip.some((image) => image.id === tripImage.id))
  assert.ok(tripImages.vehicle.some((image) => image.id === vehicleImage.id))
  await request("DELETE", { ...tripTarget, mediaId: vehicleImage.id }, 400)
  await request("DELETE", { ...vehicleTarget, mediaId: vehicleImage.id }, 401, {
    anonymous: true,
  })
  await request("DELETE", { ...vehicleTarget, mediaId: vehicleImage.id }, 403, {
    origin: "https://untrusted.example",
  })
  await request("DELETE", { ...vehicleTarget, mediaId: vehicleImage.id })
  assert.equal(
    await db
      .collection("media_files.files")
      .countDocuments({ _id: vehicleDoc.fileId }),
    0
  )
  assert.equal(
    await db
      .collection("media_files.chunks")
      .countDocuments({ files_id: vehicleDoc.fileId }),
    0
  )
  const deleted = await download.GET(
    new NextRequest(`http://localhost${vehicleImage.url}`),
    {
      params: Promise.resolve({ id: String(vehicleDoc.fileId) }),
    }
  )
  assert.equal(deleted.status, 404)
  await request("DELETE", { ...tripTarget, mediaId: tripImage.id })
  // Exercise the hard body cap without relying on a Content-Length header.
  await assert.rejects(
    media.readImageForm(
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-type": "multipart/form-data; boundary=test" },
        body: new Uint8Array(6 * 1024 * 1024),
      })
    ),
    /up to 5 MB/
  )
  console.log(
    `Passed ${checks} admin image handler checks plus GridFS downloads, resizing, passenger galleries, delete cleanup, and body-size enforcement.`
  )
} finally {
  try {
    if (db) {
      for (const image of temporary) {
        const collection = db.collection(
          image.target.resource === "vehicles" ? "vehicle_assets" : "trip_media"
        )
        const doc = await collection.findOne({ _id: new ObjectId(image.id) })
        if (doc?.fileId) {
          const bucket = new GridFSBucket(db, { bucketName: "media_files" })
          if (await bucket.find({ _id: doc.fileId }).hasNext())
            await bucket.delete(doc.fileId)
        }
        await collection.deleteOne({ _id: new ObjectId(image.id) })
      }
      if (original)
        assert.deepEqual(
          await snapshot(),
          original,
          "Temporary media must be fully removed."
        )
    }
  } finally {
    if (connection) {
      await connection.rollback()
      await connection.close()
    }
    await (await globalThis.smartmoveMongo)?.close()
  }
}
