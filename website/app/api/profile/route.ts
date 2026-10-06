import { NextRequest, NextResponse } from "next/server";
import { getPassenger, sameOrigin } from "@/lib/server/auth";
import { getConnection } from "@/lib/server/oracle";

export const runtime = "nodejs";

async function profile(request: NextRequest) {
  const connection = await getConnection();
  try {
    const passenger = await getPassenger(request, connection);
    if (!passenger) {
      await connection.close();
      return null;
    }
    return { connection, passenger };
  } catch (error) {
    await connection.close();
    throw error;
  }
}

export async function GET(request: NextRequest) {
  let context: Awaited<ReturnType<typeof profile>> | undefined;
  try {
    context = await profile(request);
    if (!context)
      return NextResponse.json(
        { error: "Sign in to view your profile." },
        { status: 401 },
      );
    const result = await context.connection.execute<{ PHONE: string }>(
      `SELECT
        phone
      FROM smartmove_database.web_passenger_login
      WHERE
        passenger_id = :id`,
      { id: context.passenger.id },
    );
    return NextResponse.json(
      {
        profile: {
          name: context.passenger.name,
          email: context.passenger.email,
          phone: result.rows?.[0]?.PHONE ?? "",
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Profile lookup failed", error);
    return NextResponse.json(
      { error: "Profile is temporarily unavailable." },
      { status: 503 },
    );
  } finally {
    await context?.connection.close();
  }
}

export async function PATCH(request: NextRequest) {
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
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const phone = typeof input.phone === "string" ? input.phone.trim() : "";
  if (
    name.length < 2 ||
    name.length > 100 ||
    !/^[0-9+()\s-]{7,15}$/.test(phone)
  ) {
    return NextResponse.json(
      { error: "Enter a valid name and phone number." },
      { status: 400 },
    );
  }
  let context: Awaited<ReturnType<typeof profile>> | undefined;
  try {
    context = await profile(request);
    if (!context)
      return NextResponse.json(
        { error: "Sign in to edit your profile." },
        { status: 401 },
      );
    await context.connection.execute(
      `BEGIN
        smartmove_database.web_update_profile(:id, :name, :phone);
      END;`,
      { id: context.passenger.id, name, phone },
    );
    await context.connection.commit();
    return NextResponse.json({
      profile: { name, phone, email: context.passenger.email },
    });
  } catch (error) {
    await context?.connection.rollback();
    console.error("Profile update failed", error);
    return NextResponse.json(
      { error: "Profile update is temporarily unavailable." },
      { status: 503 },
    );
  } finally {
    await context?.connection.close();
  }
}
