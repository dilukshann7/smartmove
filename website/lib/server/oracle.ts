import "server-only"

import oracledb, { type Connection, type Pool } from "oracledb"

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT

const globalOracle = globalThis as typeof globalThis & {
  smartmovePool?: Promise<Pool>
}

export async function getConnection(): Promise<Connection> {
  const user = process.env.ORACLE_USER
  const password = process.env.ORACLE_PASSWORD
  const connectString = process.env.ORACLE_CONNECT_STRING
  if (!user || !password || !connectString) {
    throw new Error("Oracle connection is not configured")
  }
  globalOracle.smartmovePool ??= oracledb.createPool({
    user,
    password,
    connectString,
    poolMin: 0,
    poolMax: 8,
    poolIncrement: 1,
  })
  try {
    return await (await globalOracle.smartmovePool).getConnection()
  } catch (error) {
    globalOracle.smartmovePool = undefined
    throw error
  }
}

export { oracledb }
