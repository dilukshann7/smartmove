import { NextRequest, NextResponse } from "next/server";
import { getPassenger } from "@/lib/server/auth";
import { getConnection } from "@/lib/server/oracle";
import { loadPortalTickets } from "@/lib/server/portal-data";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const id = Number((await context.params).id);
  if (!Number.isSafeInteger(id) || id < 1)
    return NextResponse.json({ error: "Invalid ticket." }, { status: 400 });
  let connection;
  try {
    connection = await getConnection();
    const passenger = await getPassenger(request, connection);
    if (!passenger)
      return NextResponse.json(
        { error: "Sign in to view this ticket." },
        { status: 401 },
      );
    const ticket = (await loadPortalTickets(connection, passenger.id)).find(
      (item) => item.id === id,
    );
    if (!ticket)
      return NextResponse.json(
        { error: "Issued ticket not found." },
        { status: 404 },
      );
    return NextResponse.json(
      { ticket },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Ticket lookup failed", error);
    return NextResponse.json(
      { error: "Ticket is temporarily unavailable." },
      { status: 503 },
    );
  } finally {
    await connection?.close();
  }
}
