import "server-only"

import { randomInt } from "node:crypto"

// Supply numeric IDs to the coursework procedures without Oracle sequences.
// Primary keys still reject collisions; no MAX(id) + 1 race between requests.
export function newRecordId() {
  return randomInt(1_000_000, 2 ** 48)
}
