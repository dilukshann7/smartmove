import "server-only";

import type { Connection } from "oracledb";
import { oracledb } from "./oracle";
import { newRecordId } from "./record-id";

export async function cancelPassengerBooking(
  connection: Connection,
  bookingId: number,
  passengerId: number,
) {
  const result = await connection.execute(
    `BEGIN
      smartmove_database.web_cancel_booking(
        :bookingId,
        :passengerId,
        :refundId,
        :changed,
        :refundAmount
      );
    END;`,
    {
      bookingId,
      passengerId,
      refundId: newRecordId(),
      changed: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      refundAmount: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
    },
  );
  return result.outBinds as { changed: number; refundAmount: number };
}
