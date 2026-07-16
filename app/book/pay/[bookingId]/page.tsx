import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { PILOT_WAVES } from "@/lib/pilot-data";
import PayPageClient from "./PayPageClient";

export const dynamic = "force-dynamic";

const GRACE_PERIOD_MS = 15 * 60 * 1000;

async function getBooking(id: string) {
  const supabase = getSupabaseAdmin();
  const { data: booking } = await supabase
    .from("bookings")
    .select("*, users!inner(name, phone), routes!inner(origin, destination)")
    .eq("id", id)
    .single();

  return booking;
}

export default async function PayPage({
  params,
}: {
  params: { bookingId: string };
}) {
  const booking = await getBooking(params.bookingId);

  if (!booking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <h1 className="text-lg font-semibold text-gray-900">Booking not found</h1>
          <Link
            href="/book"
            className="mt-4 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Book a new trip
          </Link>
        </div>
      </main>
    );
  }

  if (booking.status === "expired") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <h1 className="text-lg font-semibold text-gray-900">Booking expired</h1>
          <p className="mt-2 text-sm text-gray-500">This booking was not paid within the 15-minute window.</p>
          <Link
            href="/book"
            className="mt-4 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Book again
          </Link>
        </div>
      </main>
    );
  }

  const createdAt = new Date(booking.created_at).getTime();
  const isGraceExpired = Date.now() - createdAt > GRACE_PERIOD_MS;

  if (isGraceExpired && booking.status === "pending") {
    const supabase = getSupabaseAdmin();
    await supabase.from("bookings").update({ status: "expired" }).eq("id", booking.id);

    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <h1 className="text-lg font-semibold text-gray-900">Booking expired</h1>
          <p className="mt-2 text-sm text-gray-500">This booking was not paid within the 15-minute window.</p>
          <Link
            href="/book"
            className="mt-4 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Book again
          </Link>
        </div>
      </main>
    );
  }

  const wave = PILOT_WAVES.find((w) => w.id === booking.wave_id);
  const routeLabel = `${booking.routes.origin} → ${booking.routes.destination} · ${wave?.departure_label ?? ""}`;

  return (
    <PayPageClient
      bookingId={booking.id}
      seatCount={booking.seat_count}
      ticketCode={booking.ticket_code}
      userName={booking.users.name}
      routeLabel={routeLabel}
    />
  );
}
