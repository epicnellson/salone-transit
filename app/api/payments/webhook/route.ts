import { NextResponse } from "next/server";
import { verifyWebhookSignature, type MonimeWebhookEvent } from "@/lib/monime";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { sendSms } from "@/lib/sms";
import { logError, logInfo } from "@/lib/logger";

function generateTicketCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();

    const signature = req.headers.get("x-monime-signature");
    if (!verifyWebhookSignature(rawBody, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event: MonimeWebhookEvent = JSON.parse(rawBody);

    const supportedEvents = [
      "checkout_session.completed",
      "checkout_session.expired",
      "checkout_session.cancelled",
    ];

    if (!supportedEvents.includes(event.event.name)) {
      return NextResponse.json({ received: true });
    }

    const supabase = getSupabaseAdmin();

    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select(
        "*, bookings!inner(*, users!inner(name, phone, id), routes!inner(origin, destination))"
      )
      .eq("monime_ref", event.object.id)
      .single();

    if (paymentError || !payment) {
      logError("Webhook: payment not found", { monimeRef: event.object.id });
      return NextResponse.json({ received: true });
    }

    if (payment.status === "confirmed") {
      return NextResponse.json({ received: true });
    }

    switch (event.event.name) {
      case "checkout_session.completed": {
        const newTicketCode = generateTicketCode();
        const now = new Date().toISOString();

        const { error: paymentUpdateError } = await supabase
          .from("payments")
          .update({ status: "confirmed", confirmed_at: now })
          .eq("id", payment.id);

        if (paymentUpdateError) {
          throw new Error("Failed to update payment status");
        }

        const { error: bookingUpdateError } = await supabase
          .from("bookings")
          .update({ ticket_code: newTicketCode, status: "paid" })
          .eq("id", payment.booking_id);

        if (bookingUpdateError) {
          throw new Error("Failed to update booking status");
        }

        const booking = payment.bookings;
        const route = `${booking.routes.origin} → ${booking.routes.destination}`;
        const smsMessage =
          `Salone Transit: Your ticket is confirmed!\n` +
          `Route: ${route}\n` +
          `Ticket: ${newTicketCode}\n` +
          `Seats: ${booking.seat_count}\n` +
          `Show this code to the boarding agent.`;

        await sendSms(booking.users.phone, smsMessage, "ticket_confirmation");

        break;
      }

      case "checkout_session.expired":
      case "checkout_session.cancelled": {
        await supabase
          .from("payments")
          .update({ status: "failed" })
          .eq("id", payment.id);

        break;
      }
    }

    logInfo("Webhook processed", { event: event.event.name, monimeRef: event.object.id });
    return NextResponse.json({ received: true });
  } catch (err) {
    logError("Webhook processing error", {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
