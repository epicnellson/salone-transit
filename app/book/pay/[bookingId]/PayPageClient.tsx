"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PRICE_PER_SEAT } from "@/lib/pilot-data";

type BookingStatus = "pending" | "paid" | "expired";

interface StatusResponse {
  status: BookingStatus;
  ticketCode: string | null;
}

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 100;

export default function PayPageClient({
  bookingId,
  seatCount,
  ticketCode: initialTicketCode,
  userName,
  routeLabel,
}: {
  bookingId: string;
  seatCount: number;
  ticketCode: string;
  userName: string;
  routeLabel: string;
}) {
  const router = useRouter();
  const total = seatCount * PRICE_PER_SEAT;

  const [phase, setPhase] = useState<"idle" | "initiating" | "waiting" | "confirmed" | "expired" | "failed">(
    "idle"
  );
  const [ticketCode, setTicketCode] = useState(initialTicketCode);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const attemptsRef = useRef(0);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollStatus = useCallback(() => {
    stopPolling();

    pollRef.current = setInterval(async () => {
      attemptsRef.current += 1;

      if (attemptsRef.current > MAX_POLL_ATTEMPTS) {
        stopPolling();
        setPhase("failed");
        setErrorMessage("Payment timed out. Please try again.");
        return;
      }

      try {
        const res = await fetch(`/api/payments/status?bookingId=${bookingId}`);
        const data: StatusResponse = await res.json();

        if (data.status === "paid") {
          stopPolling();
          if (data.ticketCode) setTicketCode(data.ticketCode);
          setPhase("confirmed");
        } else if (data.status === "expired") {
          stopPolling();
          setPhase("expired");
        }
      } catch {
        // continue polling
      }
    }, POLL_INTERVAL_MS);
  }, [bookingId, stopPolling]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("paid") === "1") {
      setPhase("waiting");
      pollStatus();
    }
    if (params.get("cancelled") === "1") {
      setPhase("idle");
    }
  }, [pollStatus]);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  async function handleInitiatePayment() {
    setPhase("initiating");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/payments/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 410) {
          setPhase("expired");
          setErrorMessage("This booking has expired. Please book again.");
          return;
        }
        throw new Error(data.error || "Failed to initiate payment");
      }

      setPhase("waiting");

      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else {
        pollStatus();
      }
    } catch (err) {
      setPhase("failed");
      setErrorMessage(err instanceof Error ? err.message : "Payment failed to start.");
    }
  }

  function handleManualRetry() {
    setPhase("idle");
    setErrorMessage(null);
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-emerald-600 px-4 py-4 text-white">
        <Link
          href={`/book/confirm/${bookingId}`}
          className="mb-2 flex items-center gap-1 text-sm text-emerald-100 hover:text-white"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back
        </Link>
        <h1 className="text-lg font-bold">Payment</h1>
      </div>

      <div className="mx-auto max-w-lg px-4 py-6">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <span className="text-gray-500">Route</span>
              <span className="font-medium">{routeLabel}</span>
            </div>
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <span className="text-gray-500">Passenger</span>
              <span className="font-medium">{userName}</span>
            </div>
            <div className="flex items-center justify-between pb-1">
              <span className="text-gray-500">Booking ref</span>
              <span className="font-mono font-bold text-gray-900">{ticketCode}</span>
            </div>
          </div>

          <div className="mt-4 rounded-lg bg-gray-50 p-4 text-center">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Amount due</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">
              {total.toLocaleString()} SLL
            </p>
          </div>
        </div>

        {phase === "idle" && (
          <button
            onClick={handleInitiatePayment}
            className="mt-6 w-full rounded-xl bg-emerald-600 px-4 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.98]"
          >
            Pay with Mobile Money
          </button>
        )}

        {phase === "initiating" && (
          <div className="mt-6 flex items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-5">
            <svg className="h-5 w-5 animate-spin text-emerald-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm text-gray-600">Connecting to Monime…</span>
          </div>
        )}

        {phase === "waiting" && (
          <div className="mt-6 rounded-xl border-2 border-amber-200 bg-amber-50 p-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
              <svg className="h-7 w-7 animate-pulse text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="mt-3 text-lg font-semibold text-gray-900">Waiting for payment</h2>
            <p className="mt-1 text-sm text-gray-500">
              Complete the payment on your phone. This page will update automatically.
            </p>
            <div className="mt-3 flex items-center justify-center gap-2 text-xs text-amber-600">
              <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Checking status…
            </div>
          </div>
        )}

        {phase === "confirmed" && (
          <div className="mt-6 rounded-xl border-2 border-emerald-200 bg-emerald-50 p-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
              <svg className="h-7 w-7 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="mt-3 text-lg font-semibold text-gray-900">Payment confirmed!</h2>
            <p className="mt-1 text-sm text-gray-500">Your ticket has been generated.</p>

            <div className="mt-4 rounded-lg bg-white p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Your ticket code</p>
              <p className="mt-1 font-mono text-2xl font-bold text-emerald-700">{ticketCode}</p>
            </div>

            <p className="mt-3 text-xs text-gray-400">
              Show this code to the boarding agent.
            </p>

            <button
              onClick={() => router.push("/book")}
              className="mt-4 w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Done
            </button>
          </div>
        )}

        {phase === "expired" && (
          <div className="mt-6 rounded-xl border-2 border-red-200 bg-red-50 p-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
              <svg className="h-7 w-7 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h2 className="mt-3 text-lg font-semibold text-gray-900">Booking expired</h2>
            <p className="mt-1 text-sm text-gray-500">
              {errorMessage || "This booking was not paid within the 15-minute window."}
            </p>
            <Link
              href="/book"
              className="mt-4 inline-block rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Book again
            </Link>
          </div>
        )}

        {phase === "failed" && (
          <div className="mt-6 rounded-xl border-2 border-red-200 bg-red-50 p-6 text-center">
            <h2 className="text-lg font-semibold text-gray-900">Payment failed</h2>
            <p className="mt-1 text-sm text-gray-500">
              {errorMessage || "Something went wrong. Please try again."}
            </p>
            <button
              onClick={handleManualRetry}
              className="mt-4 inline-block rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Try again
            </button>
          </div>
        )}

        {phase === "idle" && (
          <Link
            href="/book"
            className="mt-3 block w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-center text-sm font-medium text-gray-600 transition hover:bg-gray-50"
          >
            Back to booking
          </Link>
        )}
      </div>
    </main>
  );
}
