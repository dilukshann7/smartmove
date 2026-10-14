import "server-only"

import type { Connection } from "oracledb"
import { oracledb } from "./oracle"

export function enableOracleOutput(connection: Connection) {
  return connection.execute(
    "BEGIN DBMS_OUTPUT.DISABLE; DBMS_OUTPUT.ENABLE(NULL); END;"
  )
}

export function disableOracleOutput(connection: Connection) {
  return connection.execute("BEGIN DBMS_OUTPUT.DISABLE; END;")
}

export async function readOracleOutput(connection: Connection) {
  const lines: string[] = []
  const batchSize = 100
  while (true) {
    const result = await connection.execute(
      "BEGIN DBMS_OUTPUT.GET_LINES(:lines, :lineCount); END;",
      {
        lines: {
          dir: oracledb.BIND_OUT,
          type: oracledb.STRING,
          maxArraySize: batchSize,
          maxSize: 32767,
        },
        lineCount: {
          dir: oracledb.BIND_INOUT,
          type: oracledb.NUMBER,
          val: batchSize,
        },
      }
    )
    const output = result.outBinds as {
      lines: (string | null)[]
      lineCount: number
    }
    lines.push(
      ...output.lines.slice(0, output.lineCount).map((line) => line ?? "")
    )
    if (output.lineCount < batchSize) return lines
  }
}
