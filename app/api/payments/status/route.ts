import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const GRACE_PERIOD_MS = 15 * 60 * 1000;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const bookingId = url.searchParams.get("bookingId");

    if (!bookingId) {
      return NextResponse.json({ error: "bookingId is required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: booking, error } = await supabase
      .from("bookings")
      .select("id, status, ticket_code, created_at, seat_count")
      .eq("id", bookingId)
      .single();

    if (error || !booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (booking.status === "pending") {
      const createdAt = new Date(booking.created_at).getTime();
      if (Date.now() - createdAt > GRACE_PERIOD_MS) {
        await supabase
          .from("bookings")
          .update({ status: "expired" })
          .eq("id", bookingId);

        return NextResponse.json({
          status: "expired",
          ticketCode: null,
        });
      }
    }

    return NextResponse.json({
      status: booking.status,
      ticketCode: booking.status === "paid" ? booking.ticket_code : null,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
