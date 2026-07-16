import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAgentFromSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("agent_session")?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const agent = await getAgentFromSession(sessionToken);
    if (!agent) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const url = new URL(req.url);
    const ticketCode = url.searchParams.get("ticketCode")?.trim().toUpperCase();

    if (!ticketCode) {
      return NextResponse.json({ error: "Ticket code is required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: booking, error } = await supabase
      .from("bookings")
      .select(
        `
        id, ticket_code, seat_count, status, created_at,
        users!inner(name, phone),
        routes!inner(origin, destination),
        waves!inner(departure_label)
      `
      )
      .eq("ticket_code", ticketCode)
      .single();

    if (error || !booking) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const b = booking as unknown as {
      id: string;
      ticket_code: string;
      seat_count: number;
      status: string;
      created_at: string;
      users: { name: string; phone: string };
      routes: { origin: string; destination: string };
      waves: { departure_label: string };
    };

    const { data: existingVerification } = await supabase
      .from("verifications")
      .select("id, verified_at")
      .eq("booking_id", b.id)
      .eq("agent_id", agent.agentId)
      .single();

    return NextResponse.json({
      booking: {
        id: b.id,
        ticketCode: b.ticket_code,
        seatCount: b.seat_count,
        status: b.status,
        passengerName: b.users.name,
        passengerPhone: b.users.phone,
        route: `${b.routes.origin} → ${b.routes.destination}`,
        departure: b.waves.departure_label,
      },
      alreadyVerified: !!existingVerification,
      verifiedAt: existingVerification?.verified_at ?? null,
    });
  } catch {
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
}
