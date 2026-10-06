import { NextRequest, NextResponse } from "next/server"
import { getConnection } from "@/lib/server/oracle"
import { mapTrip, type TripRow } from "@/lib/trip-types"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const origin = params.get("origin")?.trim() ?? ""
  const destination = params.get("destination")?.trim() ?? ""
  const date = params.get("date") ?? ""
  const [year, month, day] = date.split("-").map(Number)
  const actualDate = new Date(Date.UTC(year, month - 1, day))
  const calendarDateValid = actualDate.getUTCFullYear() === year &&
    actualDate.getUTCMonth() + 1 === month && actualDate.getUTCDate() === day
  if (
    !origin ||
    !destination ||
    origin.length > 50 ||
    destination.length > 50 ||
    origin.toLowerCase() === destination.toLowerCase() ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !calendarDateValid
  ) {
    return NextResponse.json(
      { error: "Enter a valid origin, destination and date." },
      { status: 400 }
    )
  }
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
  if (date < today) {
    return NextResponse.json(
      { error: "Choose today or a future date in Sri Lanka." },
      { status: 400 }
    )
  }

  let connection
  try {
    connection = await getConnection()
    const result = await connection.execute<TripRow>(
      `SELECT
        trip_id,
        route_name,
        origin,
        destination,
        TO_CHAR(departure_at, 'YYYY-MM-DD"T"HH24:MI:SS') || '+05:30' departure_at,
        TO_CHAR(arrival_at, 'YYYY-MM-DD"T"HH24:MI:SS') || '+05:30' arrival_at,
        fare,
        vehicle_type,
        registration_number,
        seat_count,
        available_seats
      FROM smartmove_database.web_trip_search
      WHERE
        LOWER(origin) = LOWER(:origin)
        AND LOWER(destination) = LOWER(:destination)
        AND TRUNC(departure_at) = TO_DATE(:travelDate, 'YYYY-MM-DD')
      ORDER BY
        departure_at,
        trip_id`,
      { origin, destination, travelDate: date }
    )
    return NextResponse.json(
      { trips: (result.rows ?? []).map(mapTrip) },
      {
        headers: { "Cache-Control": "no-store" },
      }
    )
  } catch (error) {
    console.error("Trip search failed", error)
    return NextResponse.json(
      { error: "Trip search is temporarily unavailable." },
      { status: 503 }
    )
  } finally {
    await connection?.close()
  }
}
