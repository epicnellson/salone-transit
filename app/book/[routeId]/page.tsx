"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBooking } from "@/lib/actions";
import { PILOT_ROUTE, PILOT_WAVES, BOOKED_SEATS, PRICE_PER_SEAT } from "@/lib/pilot-data";

export default function BookingForm({
  searchParams,
}: {
  params: { routeId: string };
  searchParams: { wave?: string };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const selectedWave = PILOT_WAVES.find((w) => w.id === searchParams.wave);
  const wave = selectedWave ?? PILOT_WAVES[0];

  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [seatCount, setSeatCount] = useState(1);
  const [selectedWaveId, setSelectedWaveId] = useState<string>(wave.id);

  const activeWave = PILOT_WAVES.find((w) => w.id === selectedWaveId) ?? wave;
  const activeRemaining = activeWave.capacity_estimate - (BOOKED_SEATS[activeWave.id] ?? 0);
  const totalPrice = seatCount * PRICE_PER_SEAT;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!phone.trim() || !name.trim()) {
      setError("Please fill in all fields.");
      return;
    }

    const cleanedPhone = phone.replace(/\s/g, "");
    if (!/^(0|\+?232)\d{8,9}$/.test(cleanedPhone)) {
      setError("Please enter a valid Sierra Leone phone number.");
      return;
    }

    if (seatCount < 1 || seatCount > activeRemaining) {
      setError(`You can book between 1 and ${activeRemaining} seats.`);
      return;
    }

    startTransition(async () => {
      try {
        await createBooking({
          phone: cleanedPhone,
          name: name.trim(),
          routeId: PILOT_ROUTE.id,
          waveId: selectedWaveId,
          seatCount,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-emerald-600 px-4 py-4 text-white">
        <button
          onClick={() => router.back()}
          className="mb-2 flex items-center gap-1 text-sm text-emerald-100 hover:text-white"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back
        </button>
        <h1 className="text-lg font-bold">Book your trip</h1>
        <p className="text-sm text-emerald-100">
          {PILOT_ROUTE.origin} → {PILOT_ROUTE.destination}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mx-auto max-w-lg px-4 py-6">
        <div className="space-y-4">
          <div>
            <label htmlFor="phone" className="mb-1 block text-sm font-medium text-gray-700">
              Phone number
            </label>
            <input
              id="phone"
              type="tel"
              placeholder="077 123 456"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              required
            />
          </div>

          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700">
              Full name
            </label>
            <input
              id="name"
              type="text"
              placeholder="e.g. Mohamed Kamara"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              required
            />
          </div>

          <div>
            <label htmlFor="wave" className="mb-1 block text-sm font-medium text-gray-700">
              Departure time
            </label>
            <select
              id="wave"
              value={selectedWaveId}
              onChange={(e) => setSelectedWaveId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-base focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            >
              {PILOT_WAVES.map((w) => {
                const rem = w.capacity_estimate - (BOOKED_SEATS[w.id] ?? 0);
                return (
                  <option key={w.id} value={w.id} disabled={rem <= 0}>
                    {w.departure_label} {rem <= 0 ? "(Full)" : `— ${rem} seats left`}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label htmlFor="seats" className="mb-1 block text-sm font-medium text-gray-700">
              Number of seats
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSeatCount(Math.max(1, seatCount - 1))}
                className="flex h-12 w-12 items-center justify-center rounded-lg border border-gray-300 text-xl font-bold text-gray-600 hover:bg-gray-100 active:scale-95"
              >
                −
              </button>
              <input
                id="seats"
                type="number"
                min={1}
                max={activeRemaining}
                value={seatCount}
                onChange={(e) => setSeatCount(Math.max(1, Math.min(activeRemaining, Number(e.target.value) || 1)))}
                className="h-12 w-20 rounded-lg border border-gray-300 bg-white text-center text-lg font-semibold focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              />
              <button
                type="button"
                onClick={() => setSeatCount(Math.min(activeRemaining, seatCount + 1))}
                className="flex h-12 w-12 items-center justify-center rounded-lg border border-gray-300 text-xl font-bold text-gray-600 hover:bg-gray-100 active:scale-95"
              >
                +
              </button>
              <span className="text-sm text-gray-500">of {activeRemaining} available</span>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Departure</span>
            <span className="font-medium">{activeWave.departure_label}</span>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2">
            <span className="text-sm text-gray-500">
              {seatCount} × {PRICE_PER_SEAT.toLocaleString()} SLL
            </span>
            <span className="text-lg font-bold text-emerald-600">
              {totalPrice.toLocaleString()} SLL
            </span>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isPending || activeRemaining <= 0}
          className="mt-6 w-full rounded-xl bg-emerald-600 px-4 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Creating booking…" : "Continue to payment"}
        </button>
      </form>
    </main>
  );
}
