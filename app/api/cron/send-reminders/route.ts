import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { sendSms } from "@/lib/sms";
import { logError, logInfo } from "@/lib/logger";

export const dynamic = "force-dynamic";

const REMINDER_WINDOW_MINUTES = 60;

function parseDepartureTime(label: string): { hours: number; minutes: number } {
  const match = label.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return { hours: 8, minutes: 0 };

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();

  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;

  return { hours, minutes };
}

function getDepartureTimestamp(label: string, referenceDate: Date): number {
  const { hours, minutes } = parseDepartureTime(label);
  const d = new Date(referenceDate);
  d.setHours(hours, minutes, 0, 0);
  return d.getTime();
}

interface BookingWithDetails {
  id: string;
  ticket_code: string;
  seat_count: number;
  users: { name: string; phone: string };
  waves: { departure_label: string };
  routes: { origin: string; destination: string };
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const now = Date.now();
    const today = new Date();

    const { data: bookings, error } = await supabase
      .from("bookings")
      .select(
        `
        id, ticket_code, seat_count,
        users!inner(name, phone),
        waves!inner(departure_label),
        routes!inner(origin, destination)
      `
      )
      .eq("status", "paid");

    if (error) {
      throw new Error("Failed to fetch bookings");
    }

    if (!bookings || bookings.length === 0) {
      return NextResponse.json({ sent: 0, skipped: 0, message: "No paid bookings" });
    }

    const typedBookings = bookings as unknown as BookingWithDetails[];

    const { data: recentReminders } = await supabase
      .from("sms_logs")
      .select("phone, message")
      .eq("purpose", "departure_reminder")
      .gte("created_at", new Date(today.setHours(0, 0, 0, 0)).toISOString());

    const reminderPhoneTicketPairs = new Set<string>();
    for (const log of recentReminders ?? []) {
      for (const booking of typedBookings) {
        if (
          log.phone === booking.users.phone &&
          log.message.includes(booking.ticket_code)
        ) {
          reminderPhoneTicketPairs.add(
            `${booking.users.phone}:${booking.ticket_code}`
          );
        }
      }
    }

    let sent = 0;
    let skipped = 0;

    for (const booking of typedBookings) {
      const departureTs = getDepartureTimestamp(
        booking.waves.departure_label,
        today
      );

      const minutesUntilDeparture = (departureTs - now) / (1000 * 60);

      if (
        minutesUntilDeparture < 5 ||
        minutesUntilDeparture > REMINDER_WINDOW_MINUTES
      ) {
        skipped++;
        continue;
      }

      const key = `${booking.users.phone}:${booking.ticket_code}`;
      if (reminderPhoneTicketPairs.has(key)) {
        skipped++;
        continue;
      }

      const route = `${booking.routes.origin} → ${booking.routes.destination}`;
      const departureTime = booking.waves.departure_label;
      const minutesLeft = Math.round(minutesUntilDeparture);

      const message =
        `Salone Transit Reminder:\n` +
        `Your bus ${route} departs at ${departureTime} (~${minutesLeft} min).\n` +
        `Ticket: ${booking.ticket_code}\n` +
        `Please be at the boarding point 15 minutes early.`;

      const success = await sendSms(
        booking.users.phone,
        message,
        "departure_reminder"
      );

      if (success) sent++;
      else skipped++;
    }

    logInfo("Cron reminders complete", {
      total: bookings.length,
      sent,
      skipped,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json({
      total: bookings.length,
      sent,
      skipped,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logError("Cron send-reminders error", {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return NextResponse.json(
      { error: "Cron job failed" },
      { status: 500 }
    );
  }
}
