import { NextResponse } from "next/server";
import { createCheckoutSession } from "@/lib/monime";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { PRICE_PER_SEAT } from "@/lib/pilot-data";
import { checkRateLimit, BOOKING_RATE_LIMIT } from "@/lib/rate-limit";
import { logError, logInfo } from "@/lib/logger";

const GRACE_PERIOD_MS = 15 * 60 * 1000;

function getClientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`booking:${ip}`, BOOKING_RATE_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
      );
    }
    const { bookingId } = (await req.json()) as { bookingId?: string };

    if (!bookingId) {
      return NextResponse.json({ error: "bookingId is required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: booking, error: fetchError } = await supabase
      .from("bookings")
      .select("*, users!inner(name, phone)")
      .eq("id", bookingId)
      .single();

    if (fetchError || !booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (booking.status === "paid") {
      return NextResponse.json({ error: "Booking already paid" }, { status: 409 });
    }

    if (booking.status === "expired") {
      return NextResponse.json({ error: "Booking has expired" }, { status: 410 });
    }

    const createdAt = new Date(booking.created_at).getTime();
    if (Date.now() - createdAt > GRACE_PERIOD_MS) {
      await supabase
        .from("bookings")
        .update({ status: "expired" })
        .eq("id", bookingId);

      return NextResponse.json({ error: "Booking has expired" }, { status: 410 });
    }

    const amountSLE = booking.seat_count * PRICE_PER_SEAT;
    const amountMinor = Math.round(amountSLE * 100);

    const appUrl = process.env.APP_URL || "http://localhost:3000";

    const session = await createCheckoutSession({
      name: `Salone Transit — ${booking.seat_count} seat(s)`,
      reference: booking.ticket_code,
      lineItems: [
        {
          type: "custom",
          name: `Freetown → Bo — ${booking.seat_count} seat(s)`,
          price: { currency: "SLE", value: amountMinor },
          quantity: 1,
          reference: booking.ticket_code,
        },
      ],
      successUrl: `${appUrl}/book/pay/${bookingId}?paid=1`,
      cancelUrl: `${appUrl}/book/pay/${bookingId}?cancelled=1`,
      metadata: {
        bookingId,
        ticketCode: booking.ticket_code,
      },
    });

    const { error: paymentError } = await supabase.from("payments").insert({
      booking_id: bookingId,
      monime_ref: session.id,
      amount: amountSLE,
      status: "pending",
    });

    if (paymentError) {
      logError("Failed to record payment", { bookingId, error: paymentError.message });
      throw new Error("Failed to record payment");
    }

    logInfo("Payment initiated", { bookingId, sessionId: session.id });
    return NextResponse.json({
      sessionId: session.id,
      redirectUrl: session.redirectUrl,
    });
  } catch (err) {
    logError("Payment initiation error", {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
