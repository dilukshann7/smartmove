// Run from website: node scripts/migrate-browser-auth.mjs --prepare
// After verification: node scripts/migrate-browser-auth.mjs --apply <backup-directory>
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { parseEnv } from "node:util"
import { randomBytes } from "node:crypto"
import oracledb from "oracledb"
import { createRequire } from "node:module"

const website = fileURLToPath(new URL("../", import.meta.url))
const root = path.resolve(website, "..")
const owner = parseEnv(
  await fs.readFile(path.join(root, "database/.env.smartmove.local"), "utf8")
)
assert.ok(
  ["localhost", "127.0.0.1"].includes(owner.ORACLE_HOST),
  "Only the local installation is supported"
)
assert.equal(owner.ORACLE_OWNER_USER.toUpperCase(), "SMARTMOVE_DATABASE")
assert.equal(owner.ORACLE_SERVICE.toUpperCase(), "XEPDB1")
const schema = await fs.readFile(
  path.join(root, "database/database/oracle/02_schema.sql"),
  "utf8"
)
const core = [...schema.matchAll(/^CREATE TABLE (\w+)/gm)]
  .map((m) => m[1].toUpperCase())
  .sort()
assert.equal(core.length, 13)
const support = [
  "WEB_SESSIONS",
  "WEB_ADMIN_SESSIONS",
  "WEB_NOTIFICATION_BASELINE",
]
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT
oracledb.fetchAsString = [oracledb.CLOB]
const connection = await oracledb.getConnection({
  user: owner.ORACLE_OWNER_USER,
  password: owner.ORACLE_OWNER_PASSWORD,
  connectString: `${owner.ORACLE_HOST}:${owner.ORACLE_PORT}/${owner.ORACLE_SERVICE}`,
})
const tables = async () =>
  (
    await connection.execute(
      "SELECT table_name NAME FROM user_tables ORDER BY table_name"
    )
  ).rows.map((r) => r.NAME)
const counts = async () =>
  Object.fromEntries(
    await Promise.all(
      core.map(async (t) => [
        t,
        (await connection.execute(`SELECT COUNT(*) N FROM ${t}`)).rows[0].N,
      ])
    )
  )
try {
  const identity = (
    await connection.execute(
      "SELECT SYS_CONTEXT('USERENV','CON_NAME') CONTAINER FROM dual"
    )
  ).rows[0]
  assert.equal(identity.CONTAINER, "XEPDB1")
  const envPath = path.join(website, ".env.local")
  let envText = await fs.readFile(envPath, "utf8")
  let env = parseEnv(envText)
  if (process.argv[2] === "--prepare") {
    assert.deepEqual(
      await tables(),
      [...core, ...support].sort(),
      "Unexpected tables; no migration performed"
    )
    const backup = {
      createdAt: new Date().toISOString(),
      coreCounts: await counts(),
      tables: {},
    }
    for (const name of support) {
      const ddl = (
        await connection.execute(
          "SELECT DBMS_METADATA.GET_DDL('TABLE', :name) DDL FROM dual",
          { name }
        )
      ).rows[0].DDL
      const rows = (await connection.execute(`SELECT * FROM ${name}`)).rows
      const indexes = (
        await connection.execute(
          "SELECT DBMS_METADATA.GET_DDL('INDEX', index_name) DDL FROM user_indexes WHERE table_name=:name AND generated='N'",
          { name }
        )
      ).rows.map((r) => r.DDL)
      const grants = (
        await connection.execute(
          "SELECT grantee, privilege, grantable FROM user_tab_privs_made WHERE table_name=:name",
          { name }
        )
      ).rows
      backup.tables[name] = { ddl, indexes, grants, rows }
    }
    const baseline = backup.tables.WEB_NOTIFICATION_BASELINE.rows
    assert.equal(baseline.length, 1)
    const cutoff = baseline[0].STARTED_AT
    assert.ok(cutoff instanceof Date && Number.isFinite(cutoff.getTime()))
    backup.notificationsStartAt = cutoff.toISOString()
    const directory = path.join(
      root,
      "database/backups",
      `before-browser-auth-${Date.now()}`
    )
    await fs.mkdir(directory, { recursive: true })
    await fs.writeFile(
      path.join(directory, "support-tables.json"),
      JSON.stringify(backup, null, 2),
      { flag: "wx" }
    )
    assert.deepEqual(
      JSON.parse(
        await fs.readFile(path.join(directory, "support-tables.json"), "utf8")
      ),
      JSON.parse(JSON.stringify(backup))
    )
    if (env.NOTIFICATIONS_START_AT)
      assert.equal(
        new Date(env.NOTIFICATIONS_START_AT).toISOString(),
        backup.notificationsStartAt
      )
    else envText += `\nNOTIFICATIONS_START_AT=${backup.notificationsStartAt}\n`
    if (!env.AUTH_TOKEN_SECRET)
      envText += `AUTH_TOKEN_SECRET=${randomBytes(32).toString("base64")}\n`
    await fs.writeFile(envPath, envText)
    env = parseEnv(envText)
    assert.equal(Buffer.from(env.AUTH_TOKEN_SECRET, "base64").length, 32)
    console.log(
      JSON.stringify({
        prepared: true,
        backup: directory,
        tablesBackedUp: support.length,
        coreCounts: backup.coreCounts,
        cutoffPreserved: true,
      })
    )
  } else if (process.argv[2] === "--apply") {
    assert.ok(process.argv[3], "Supply the verified backup directory")
    const directory = path.resolve(process.argv[3])
    const backupRoot = path.join(root, "database/backups") + path.sep
    assert.ok(directory.startsWith(backupRoot))
    const backup = JSON.parse(
      await fs.readFile(path.join(directory, "support-tables.json"), "utf8")
    )
    assert.equal(
      new Date(env.NOTIFICATIONS_START_AT).toISOString(),
      backup.notificationsStartAt
    )
    assert.equal(Buffer.from(env.AUTH_TOKEN_SECRET ?? "", "base64").length, 32)
    Object.assign(process.env, env)
    // Check token configuration and current role views without any session table.
    const require = createRequire(import.meta.url)
    const ts = require("typescript")
    const code = ts.transpileModule(
      await fs.readFile(path.join(website, "lib/server/auth-token.ts"), "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      }
    ).outputText
    const mod = { exports: {} }
    new Function("require", "module", "exports", code)(
      (name) => (name === "server-only" ? {} : require(name)),
      mod,
      mod.exports
    )
    const account = (
      await connection.execute(
        "SELECT user_id ID FROM web_admin_login FETCH FIRST 1 ROW ONLY"
      )
    ).rows[0]
    assert.ok(account)
    const { token } = await mod.exports.createAuthToken(account.ID, "ADMIN")
    assert.equal(
      (
        await mod.exports.readAuthToken({
          headers: new Headers({ authorization: `Bearer ${token}` }),
        })
      ).userId,
      account.ID
    )
    assert.deepEqual(
      await counts(),
      backup.coreCounts,
      "Core data changed since backup; stop and investigate"
    )
    const present = await tables()
    assert.ok(present.every((t) => core.includes(t) || support.includes(t)))
    const migration = await fs.readFile(
      path.join(
        root,
        "database/database/oracle/14_remove_web_support_tables.sql"
      ),
      "utf8"
    )
    const drops = [
      ...migration.matchAll(/^DROP TABLE smartmove_database\.(\w+);$/gm),
    ].map((m) => m[1])
    assert.deepEqual(
      drops.map((t) => t.toUpperCase()).sort(),
      [...support].sort()
    )
    for (const table of drops)
      if (present.includes(table.toUpperCase()))
        await connection.execute(`DROP TABLE smartmove_database.${table}`)
    assert.deepEqual(await tables(), core)
    assert.deepEqual(await counts(), backup.coreCounts)
    await fs.writeFile(
      path.join(directory, "migration-result.json"),
      JSON.stringify(
        {
          completedAt: new Date().toISOString(),
          tables: await tables(),
          coreCounts: await counts(),
        },
        null,
        2
      )
    )
    console.log(
      "Removed the three support tables; all 13 core tables and row counts are unchanged."
    )
  } else throw new Error("Use --prepare or --apply <backup-directory>")
} finally {
  await connection.close()
}
