"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface BookingInfo {
  id: string;
  ticketCode: string;
  seatCount: number;
  status: string;
  passengerName: string;
  passengerPhone: string;
  route: string;
  departure: string;
}

interface OfflineEntry {
  id: string;
  bookingId: string;
  ticketCode: string;
  timestamp: string;
}

const OFFLINE_QUEUE_KEY = "st_offline_verifications";

function getOfflineQueue(): OfflineEntry[] {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveOfflineQueue(queue: OfflineEntry[]) {
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

export default function AgentVerifyPage() {
  const router = useRouter();
  const [ticketCode, setTicketCode] = useState("");
  const [booking, setBooking] = useState<BookingInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [commission, setCommission] = useState<{
    rate: number;
    totalAmount: number;
    commissionEarned: number;
  } | null>(null);
  const [offlineQueue, setOfflineQueue] = useState<OfflineEntry[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  useEffect(() => {
    setOfflineQueue(getOfflineQueue());
  }, []);

  const syncOfflineQueue = useCallback(async () => {
    const queue = getOfflineQueue();
    if (queue.length === 0) return;

    setSyncing(true);
    setSyncMessage(null);
    let synced = 0;
    let failed = 0;

    for (const entry of queue) {
      try {
        const res = await fetch("/api/agent/verify-ticket", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId: entry.bookingId }),
        });

        if (res.ok) {
          synced++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    if (synced > 0) {
      const remaining = getOfflineQueue().slice(synced);
      saveOfflineQueue(remaining);
      setOfflineQueue(remaining);
    }

    setSyncMessage(
      failed > 0
        ? `Synced ${synced}, ${failed} failed (will retry)`
        : `Synced ${synced} offline verification(s)`
    );
    setSyncing(false);
  }, []);

  useEffect(() => {
    const handleOnline = () => syncOfflineQueue();
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [syncOfflineQueue]);

  useEffect(() => {
    if (navigator.onLine) syncOfflineQueue();
  }, [syncOfflineQueue]);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBooking(null);
    setVerified(false);
    setCommission(null);
    setLoading(true);

    try {
      const code = ticketCode.trim().toUpperCase();
      const res = await fetch(`/api/agent/check-ticket?ticketCode=${encodeURIComponent(code)}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Ticket not found");
        return;
      }

      setBooking(data.booking);
    } catch {
      setError("Network error. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (!booking) return;
    setError(null);
    setLoading(true);

    if (!navigator.onLine) {
      const entry: OfflineEntry = {
        id: crypto.randomUUID(),
        bookingId: booking.id,
        ticketCode: booking.ticketCode,
        timestamp: new Date().toISOString(),
      };

      const queue = [...getOfflineQueue(), entry];
      saveOfflineQueue(queue);
      setOfflineQueue(queue);

      setVerified(true);
      setCommission(null);
      setLoading(false);
      setTicketCode("");
      setBooking(null);
      setSyncMessage("Saved offline — will sync when connected.");
      return;
    }

    try {
      const res = await fetch("/api/agent/verify-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: booking.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Verification failed");
        return;
      }

      setVerified(true);
      setCommission(data.commission);
      setTicketCode("");
      setBooking(null);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    document.cookie = "agent_session=; path=/; max-age=0";
    router.push("/agent/login");
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-emerald-600 px-4 py-4 text-white">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">Verify Ticket</h1>
          <button
            onClick={handleLogout}
            className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium text-emerald-100 hover:bg-emerald-800"
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 py-4">
        {offlineQueue.length > 0 && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            <div className="flex items-center justify-between">
              <span>{offlineQueue.length} pending sync</span>
              <button
                onClick={syncOfflineQueue}
                disabled={syncing}
                className="rounded bg-amber-100 px-2 py-1 text-xs font-medium hover:bg-amber-200 disabled:opacity-50"
              >
                {syncing ? "Syncing…" : "Sync now"}
              </button>
            </div>
            {syncMessage && <p className="mt-1 text-xs text-amber-600">{syncMessage}</p>}
          </div>
        )}

        {verified && (
          <div className="mb-4 rounded-xl border-2 border-emerald-200 bg-emerald-50 p-5 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
              <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="mt-2 text-lg font-semibold text-gray-900">Verified!</h2>
            {commission && (
              <div className="mt-3 rounded-lg bg-white p-3">
                <p className="text-xs text-gray-400">Commission earned</p>
                <p className="text-xl font-bold text-emerald-600">
                  {commission.commissionEarned.toLocaleString()} SLL
                </p>
                <p className="text-xs text-gray-400">
                  {commission.rate}% of {commission.totalAmount.toLocaleString()} SLL
                </p>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleLookup} className="mb-6">
          <label htmlFor="ticket" className="mb-1 block text-sm font-medium text-gray-700">
            Enter ticket code
          </label>
          <div className="flex gap-2">
            <input
              id="ticket"
              type="text"
              placeholder="e.g. ABC123"
              value={ticketCode}
              onChange={(e) => setTicketCode(e.target.value.toUpperCase())}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-3 font-mono text-base tracking-wider focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              required
              autoFocus
            />
            <button
              type="submit"
              disabled={loading || !ticketCode.trim()}
              className="rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? "…" : "Look up"}
            </button>
          </div>
        </form>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        )}

        {booking && (
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <span className="text-gray-500">Passenger</span>
                <span className="font-medium">{booking.passengerName}</span>
              </div>
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <span className="text-gray-500">Route</span>
                <span className="font-medium">{booking.route}</span>
              </div>
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <span className="text-gray-500">Departure</span>
                <span className="font-medium">{booking.departure}</span>
              </div>
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <span className="text-gray-500">Seats</span>
                <span className="font-medium">{booking.seatCount}</span>
              </div>
              <div className="flex items-center justify-between pb-1">
                <span className="text-gray-500">Status</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  booking.status === "paid"
                    ? "bg-emerald-50 text-emerald-600"
                    : booking.status === "verified"
                      ? "bg-blue-50 text-blue-600"
                      : "bg-yellow-50 text-yellow-600"
                }`}>
                  {booking.status}
                </span>
              </div>
            </div>

            <button
              onClick={handleVerify}
              disabled={loading || booking.status !== "paid"}
              className="mt-5 w-full rounded-xl bg-emerald-600 px-4 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Verifying…" : "Verify boarding"}
            </button>
          </div>
        )}

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-400">
          <div className={`h-2 w-2 rounded-full ${navigator.onLine ? "bg-emerald-400" : "bg-red-400"}`} />
          {navigator.onLine ? "Online" : "Offline — verifications will queue"}
        </div>
      </div>
    </main>
  );
}
