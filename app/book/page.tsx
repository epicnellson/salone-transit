import Link from "next/link";
import { PILOT_ROUTE, PILOT_WAVES, BOOKED_SEATS, PRICE_PER_SEAT } from "@/lib/pilot-data";

export default function BookPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-emerald-600 px-4 py-6 text-white">
        <h1 className="text-xl font-bold">Salone Transit</h1>
        <p className="mt-1 text-sm text-emerald-100">Inter-city bus booking</p>
      </div>

      <div className="mx-auto max-w-lg px-4 py-6">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
            </div>
            <div>
              <p className="text-lg font-semibold">
                {PILOT_ROUTE.origin} → {PILOT_ROUTE.destination}
              </p>
              <p className="text-sm text-gray-500">
                {PRICE_PER_SEAT.toLocaleString()} SLL per seat
              </p>
            </div>
          </div>
        </div>

        <h2 className="mt-6 mb-3 text-sm font-medium text-gray-500 uppercase tracking-wide">
          Available departures
        </h2>

        <div className="space-y-3">
          {PILOT_WAVES.map((wave) => {
            const booked = BOOKED_SEATS[wave.id] ?? 0;
            const remaining = wave.capacity_estimate - booked;
            const isFull = remaining <= 0;
            const isLow = remaining > 0 && remaining <= 10;

            return (
              <Link
                key={wave.id}
                href={isFull ? "#" : `/book/${PILOT_ROUTE.id}?wave=${wave.id}`}
                className={`block rounded-xl border p-4 transition ${
                  isFull
                    ? "cursor-not-allowed border-gray-100 bg-gray-50 opacity-50"
                    : "border-gray-200 bg-white shadow-sm hover:border-emerald-300 hover:shadow-md active:scale-[0.98]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-base font-semibold text-gray-900">
                      {wave.departure_label}
                    </p>
                    <p className="mt-0.5 text-sm text-gray-500">
                      Est. {wave.capacity_estimate} seats
                    </p>
                  </div>
                  <div className="text-right">
                    {isFull ? (
                      <span className="inline-block rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-600">
                        Full
                      </span>
                    ) : isLow ? (
                      <span className="inline-block rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-600">
                        {remaining} left
                      </span>
                    ) : (
                      <span className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-600">
                        {remaining} seats
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          Pilot route — prices and schedules subject to change
        </p>
      </div>
    </main>
  );
}
