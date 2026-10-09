import { NextRequest, NextResponse } from "next/server";
import { getPassenger, sameOrigin } from "@/lib/server/auth";
import { getConnection } from "@/lib/server/oracle";
import { newRecordId } from "@/lib/server/record-id";
import { getMongoDb, type FeedbackContent } from "@/lib/server/mongo";
import { putNotification } from "@/lib/server/notifications";
import type { PortalFeedback } from "@/lib/portal-types";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  let connection;
  try {
    connection = await getConnection();
    const passenger = await getPassenger(request, connection);
    if (!passenger)
      return NextResponse.json(
        { error: "Sign in to view feedback." },
        { status: 401 },
      );
    const result = await connection.execute<{
      FEEDBACK_ID: number;
      BOOKING_ID: number;
      FEEDBACK_TYPE: PortalFeedback["type"];
      STATUS: PortalFeedback["status"];
      ROUTE_NAME: string;
    }>(
      `SELECT
        f.feedback_id,
        f.booking_id,
        f.feedback_type,
        f.status,
        r.route_name
      FROM smartmove_database.feedback_records f
      JOIN smartmove_database.bookings b
        ON b.booking_id = f.booking_id
      JOIN smartmove_database.trips t
        ON t.trip_id = b.trip_id
      JOIN smartmove_database.routes r
        ON r.route_id = t.route_id
      WHERE
        b.passenger_id = :passengerId
      ORDER BY
        f.feedback_id DESC`,
      { passengerId: passenger.id },
    );
    const rows = result.rows ?? [];
    const db = await getMongoDb();
    const contents = rows.length
      ? await db
          .collection<FeedbackContent>("feedback_content")
          .find({
            feedbackId: { $in: rows.map((row) => String(row.FEEDBACK_ID)) },
          })
          .toArray()
      : [];
    const byId = new Map(
      contents.map((content) => [content.feedbackId, content]),
    );
    const feedback: PortalFeedback[] = rows.map((row) => {
      const content = byId.get(String(row.FEEDBACK_ID));
      return {
        id: row.FEEDBACK_ID,
        bookingId: row.BOOKING_ID,
        type: row.FEEDBACK_TYPE,
        status: row.STATUS,
        route: row.ROUTE_NAME,
        comment: content?.comment ?? null,
        subject: content?.subject ?? null,
        vehicleRating: content?.vehicleRating ?? null,
        driverRating: content?.driverRating ?? null,
        reply: content?.reply?.message
          ? {
              staffName: content.reply.staffName,
              message: content.reply.message,
            }
          : null,
      };
    });
    return NextResponse.json(
      { feedback },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Feedback lookup failed", error);
    return NextResponse.json(
      { error: "Feedback is temporarily unavailable." },
      { status: 503 },
    );
  } finally {
    await connection?.close();
  }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return NextResponse.json({ error: "Use JSON form data." }, { status: 415 });
  let input: Record<string, unknown>;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }
  const bookingId = input.bookingId;
  const type = input.type;
  const comment = typeof input.comment === "string" ? input.comment.trim() : "";
  const subject = typeof input.subject === "string" ? input.subject.trim() : "";
  const vehicleRating = input.vehicleRating;
  const driverRating = input.driverRating;
  if (
    !Number.isSafeInteger(bookingId) ||
    Number(bookingId) < 1 ||
    (type !== "REVIEW" && type !== "COMPLAINT") ||
    comment.length < 10 ||
    comment.length > 2000 ||
    (type === "COMPLAINT" && (subject.length < 3 || subject.length > 100)) ||
    (type === "REVIEW" &&
      ![vehicleRating, driverRating].every(
        (value) =>
          Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 5,
      ))
  ) {
    return NextResponse.json(
      { error: "Check the booking, message and review ratings." },
      { status: 400 },
    );
  }
  let connection;
  let db: Awaited<ReturnType<typeof getMongoDb>> | undefined;
  let insertedFeedbackId: string | undefined;
  let committed = false;
  try {
    connection = await getConnection();
    const passenger = await getPassenger(request, connection);
    if (!passenger)
      return NextResponse.json(
        { error: "Sign in to submit feedback." },
        { status: 401 },
      );
    db = await getMongoDb();
    const feedbackId = newRecordId();
    await connection.execute(
      `BEGIN
        smartmove_database.web_submit_feedback(
          :id,
          :bookingId,
          :passengerId,
          :feedbackType
        );
      END;`,
      {
        id: feedbackId,
        bookingId: Number(bookingId),
        passengerId: passenger.id,
        feedbackType: type,
      },
    );
    const trip = await connection.execute<{
      ROUTE_ID: number;
      VEHICLE_ID: number;
      DRIVER_ID: number;
    }>(
      `SELECT
        t.route_id,
        t.vehicle_id,
        t.driver_id
      FROM smartmove_database.bookings b
      JOIN smartmove_database.trips t
        ON t.trip_id = b.trip_id
      WHERE
        b.booking_id = :bookingId
        AND b.passenger_id = :passengerId`,
      { bookingId: Number(bookingId), passengerId: passenger.id },
    );
    const detail = trip.rows?.[0];
    if (!detail)
      throw new Error("Booking disappeared during feedback submission");
    const content: FeedbackContent & {
      routeId: string;
      vehicleId: string;
      driverId: string;
    } = {
      feedbackId: String(feedbackId),
      bookingId: String(bookingId),
      type,
      routeId: String(detail.ROUTE_ID),
      vehicleId: String(detail.VEHICLE_ID),
      driverId: String(detail.DRIVER_ID),
      comment,
      createdAt: new Date(),
      ...(type === "COMPLAINT"
        ? { subject }
        : {
            vehicleRating: Number(vehicleRating),
            driverRating: Number(driverRating),
          }),
    };
    await db.collection<FeedbackContent>("feedback_content").insertOne(content);
    insertedFeedbackId = content.feedbackId;
    await connection.commit();
    committed = true;
    try {
      await putNotification(db, passenger.userId, {
        key: `feedback:${feedbackId}:submitted`,
        message: `Your ${type.toLowerCase()} #${feedbackId} was received.`,
        href: "/feedback",
        occurredAt: new Date(),
      });
    } catch (error) {
      console.error("Feedback notification deferred", error);
    }
    return NextResponse.json({ feedbackId, status: "OPEN" }, { status: 201 });
  } catch (error) {
    if (!committed) {
      await connection?.rollback();
      if (insertedFeedbackId && db) {
        try {
          await db
            .collection("feedback_content")
            .deleteOne({ feedbackId: insertedFeedbackId });
        } catch (cleanupError) {
          console.error("Feedback compensation failed", cleanupError);
        }
      }
    }
    if (error instanceof Error && /ORA-(00001|20025)/.test(error.message))
      return NextResponse.json(
        { error: "A review for this booking already exists." },
        { status: 409 },
      );
    if (error instanceof Error && error.message.includes("ORA-20024"))
      return NextResponse.json(
        { error: "Reviews require a confirmed booking on a completed trip." },
        { status: 409 },
      );
    if (error instanceof Error && error.message.includes("ORA-01403"))
      return NextResponse.json(
        { error: "Booking not found." },
        { status: 404 },
      );
    console.error("Feedback submission failed", error);
    return NextResponse.json(
      { error: "Feedback could not be saved. Please try again." },
      { status: 503 },
    );
  } finally {
    await connection?.close();
  }
}
