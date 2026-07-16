import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAgentFromSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { PRICE_PER_SEAT } from "@/lib/pilot-data";
import { checkRateLimit, VERIFY_RATE_LIMIT } from "@/lib/rate-limit";
import { logError, logInfo } from "@/lib/logger";

function getClientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`verify:${ip}`, VERIFY_RATE_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
      );
    }

    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("agent_session")?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const agent = await getAgentFromSession(sessionToken);
    if (!agent) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const { bookingId } = (await req.json()) as { bookingId?: string };

    if (!bookingId) {
      return NextResponse.json({ error: "bookingId is required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("id, seat_count, status, ticket_code")
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (booking.status === "verified") {
      return NextResponse.json({ error: "Already verified" }, { status: 409 });
    }

    if (booking.status !== "paid") {
      return NextResponse.json(
        { error: `Cannot verify booking with status: ${booking.status}` },
        { status: 400 }
      );
    }

    const { data: existingVerification } = await supabase
      .from("verifications")
      .select("id")
      .eq("booking_id", bookingId)
      .eq("agent_id", agent.agentId)
      .single();

    if (existingVerification) {
      return NextResponse.json({ error: "Already verified by you" }, { status: 409 });
    }

    const { error: verifyError } = await supabase.from("verifications").insert({
      booking_id: bookingId,
      agent_id: agent.agentId,
    });

    if (verifyError) {
      logError("Failed to create verification record", { bookingId, agentId: agent.agentId });
      throw new Error("Failed to create verification record");
    }

    const { error: updateError } = await supabase
      .from("bookings")
      .update({ status: "verified" })
      .eq("id", bookingId);

    if (updateError) {
      logError("Failed to update booking status after verification", { bookingId });
      throw new Error("Failed to update booking status");
    }

    const totalAmount = booking.seat_count * PRICE_PER_SEAT;
    const commission = Math.round(totalAmount * agent.commissionRate) / 100;

    logInfo("Booking verified", {
      agentId: agent.agentId,
      bookingId,
      ticketCode: booking.ticket_code,
      seats: booking.seat_count,
      totalAmount,
      commissionRate: agent.commissionRate,
      commissionEarned: commission,
    });

    return NextResponse.json({
      message: "Booking verified successfully",
      commission: {
        rate: agent.commissionRate,
        totalAmount,
        commissionEarned: commission,
      },
    });
  } catch (err) {
    logError("Verification error", {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    const message = err instanceof Error ? err.message : "Verification failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
