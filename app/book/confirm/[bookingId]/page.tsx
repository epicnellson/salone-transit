import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { PILOT_WAVES, PRICE_PER_SEAT } from "@/lib/pilot-data";

export const dynamic = "force-dynamic";

async function getBooking(id: string) {
  const { data: booking } = await supabaseAdmin
    .from("bookings")
    .select("*, users!inner(name, phone), routes!inner(origin, destination)")
    .eq("id", id)
    .single();

  return booking;
}

export default async function ConfirmPage({
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
          <p className="mt-2 text-sm text-gray-500">This booking may have expired or been removed.</p>
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

  const wave = PILOT_WAVES.find((w) => w.id === booking.wave_id);
  const total = booking.seat_count * PRICE_PER_SEAT;

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-emerald-600 px-4 py-6 text-white">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="mt-3 text-xl font-bold">Booking confirmed</h1>
        <p className="mt-1 text-sm text-emerald-100">Complete payment to secure your seats</p>
      </div>

      <div className="mx-auto max-w-lg px-4 py-6">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <span className="text-sm text-gray-500">Route</span>
            <span className="font-medium">
              {booking.routes?.origin} → {booking.routes?.destination}
            </span>
          </div>

          <div className="flex items-center justify-between border-b border-gray-100 py-3">
            <span className="text-sm text-gray-500">Departure</span>
            <span className="font-medium">{wave?.departure_label ?? "—"}</span>
          </div>

          <div className="flex items-center justify-between border-b border-gray-100 py-3">
            <span className="text-sm text-gray-500">Passenger</span>
            <span className="font-medium">{booking.users?.name}</span>
          </div>

          <div className="flex items-center justify-between border-b border-gray-100 py-3">
            <span className="text-sm text-gray-500">Phone</span>
            <span className="font-medium">{booking.users?.phone}</span>
          </div>

          <div className="flex items-center justify-between border-b border-gray-100 py-3">
            <span className="text-sm text-gray-500">Seats</span>
            <span className="font-medium">{booking.seat_count}</span>
          </div>

          <div className="flex items-center justify-between pt-3">
            <span className="text-sm text-gray-500">Ticket code</span>
            <span className="rounded bg-emerald-50 px-2 py-1 font-mono text-sm font-bold text-emerald-700">
              {booking.ticket_code}
            </span>
          </div>
        </div>

        <div className="mt-4 rounded-xl border-2 border-emerald-200 bg-emerald-50 p-5 text-center">
          <p className="text-sm text-emerald-600">Total to pay</p>
          <p className="mt-1 text-3xl font-bold text-emerald-700">
            {total.toLocaleString()} SLL
          </p>
        </div>

        <Link
          href={`/book/pay/${booking.id}`}
          className="mt-6 block w-full rounded-xl bg-emerald-600 px-4 py-3.5 text-center text-base font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.98]"
        >
          Proceed to payment
        </Link>

        <Link
          href="/book"
          className="mt-3 block w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-center text-sm font-medium text-gray-600 transition hover:bg-gray-50"
        >
          Book another trip
        </Link>
      </div>
    </main>
  );
}
