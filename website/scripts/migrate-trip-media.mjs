// node --env-file=.env.local scripts/migrate-trip-media.mjs
// Back up, migrate and verify image bytes before dropping the GridFS bucket.
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { createHash } from "node:crypto"
import { MongoClient, GridFSBucket, Binary, BSON } from "mongodb"

const client = await new MongoClient(process.env.MONGODB_URI).connect()
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex")
try {
  const db = client.db(process.env.MONGODB_DB)
  assert.equal(
    db.databaseName,
    "smartmove",
    "Only the SmartMove database may be migrated"
  )
  const names = (
    await db.listCollections({}, { nameOnly: true }).toArray()
  ).map((c) => c.name)
  const backup = { createdAt: new Date(), collections: {}, indexes: {} }
  for (const name of [
    "trip_media",
    "vehicle_assets",
    "media_files.files",
    "media_files.chunks",
  ]) {
    backup.collections[name] = await db.collection(name).find({}).toArray()
    backup.indexes[name] = names.includes(name)
      ? await db.collection(name).listIndexes().toArray()
      : []
  }
  const directory = fileURLToPath(
    new URL(
      `../../database/backups/before-inline-trip-media-${Date.now()}/`,
      import.meta.url
    )
  )
  await fs.mkdir(directory, { recursive: true })
  const serialized = BSON.EJSON.stringify(backup, { relaxed: false })
  await fs.writeFile(directory + "media-backup.ejson", serialized, {
    flag: "wx",
  })
  const backupPath = directory + "media-backup.ejson"
  assert.equal(sha(await fs.readFile(backupPath)), sha(serialized))
  const beforeCounts = {}
  for (const name of names)
    if (
      ![
        "trip_media",
        "vehicle_assets",
        "media_files.files",
        "media_files.chunks",
      ].includes(name)
    )
      beforeCounts[name] = await db.collection(name).countDocuments()
  const vehicles = backup.collections.vehicle_assets.filter(
    (doc) => doc.assetType === "IMAGE"
  )
  const images = [...backup.collections.trip_media, ...vehicles]
  const ids = images.map((doc) => String(doc._id))
  assert.equal(
    new Set(ids).size,
    ids.length,
    "Media IDs collide; no records have been changed"
  )
  const fileIds = new Set(
    images.filter((doc) => doc.fileId).map((doc) => String(doc.fileId))
  )
  const files = backup.collections["media_files.files"]
  assert.ok(
    files.every((file) => fileIds.has(String(file._id))),
    "An unreferenced GridFS file needs investigation before removal"
  )
  const bucket = new GridFSBucket(db, { bucketName: "media_files" })
  const stored = new Map()
  for (const file of files) {
    assert.equal(file.metadata?.contentType, "image/webp")
    assert.ok(file.length <= 5 * 1024 * 1024)
    const chunks = []
    for await (const chunk of bucket.openDownloadStream(file._id))
      chunks.push(chunk)
    const bytes = Buffer.concat(chunks)
    assert.equal(bytes.length, file.length)
    stored.set(String(file._id), { bytes, metadata: file.metadata })
  }
  // Construct every replacement first; fail on missing data before writing.
  const replacements = images.map((original) => {
    const doc = { ...original }
    if (doc.assetType === "IMAGE") {
      doc.mediaType = "IMAGE"
      delete doc.assetType
    }
    if (doc.fileId && !doc.data) {
      const file = stored.get(String(doc.fileId))
      assert.ok(file, `Missing file bytes for image ${doc._id}`)
      doc.data = new Binary(file.bytes)
      Object.assign(doc, file.metadata)
    }
    assert.ok(BSON.calculateObjectSize(doc) < 16 * 1024 * 1024)
    return doc
  })
  for (const doc of replacements)
    await db
      .collection("trip_media")
      .replaceOne({ _id: doc._id }, doc, { upsert: true })
  for (const expected of replacements) {
    const actual = await db
      .collection("trip_media")
      .findOne({ _id: expected._id })
    assert.equal(actual.fileUrl, expected.fileUrl)
    if (expected.data)
      assert.equal(
        sha(actual.data.value()),
        sha(expected.data.value()),
        "Image bytes must remain identical"
      )
    assert.deepEqual(
      BSON.EJSON.serialize(actual),
      BSON.EJSON.serialize(expected)
    )
  }
  assert.equal(
    await db.collection("trip_media").countDocuments(),
    replacements.length
  )
  if (vehicles.length)
    await db
      .collection("vehicle_assets")
      .deleteMany({
        _id: { $in: vehicles.map((doc) => doc._id) },
        assetType: "IMAGE",
      })
  assert.equal(
    await db.collection("vehicle_assets").countDocuments(),
    backup.collections.vehicle_assets.length - vehicles.length
  )
  // Recheck links and bytes before removing the old storage collections.
  for (const file of files)
    assert.ok(
      await db
        .collection("trip_media")
        .findOne({ fileId: file._id, data: { $exists: true } })
    )
  for (const name of ["media_files.files", "media_files.chunks"])
    if (names.includes(name)) await db.collection(name).drop()
  for (const [name, count] of Object.entries(beforeCounts))
    assert.equal(await db.collection(name).countDocuments(), count)
  const remaining = (await db.listCollections({}, { nameOnly: true }).toArray())
    .map((c) => c.name)
    .sort()
  assert.ok(!remaining.some((name) => name.startsWith("media_files.")))
  const result = {
    backup: directory,
    imagesInTripMedia: replacements.length,
    embeddedFiles: replacements.filter((doc) => doc.data).length,
    vehicleDocuments: await db.collection("vehicle_assets").countDocuments(),
    collections: remaining,
    imageChecksums: replacements
      .filter((doc) => doc.data)
      .map((doc) => ({ id: String(doc._id), sha256: sha(doc.data.value()) })),
  }
  await fs.writeFile(
    directory + "migration-result.json",
    JSON.stringify(result, null, 2)
  )
  console.log(JSON.stringify(result))
} finally {
  await client.close()
}
