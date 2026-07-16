"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AgentLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const cleaned = phone.replace(/\s/g, "");
      const res = await fetch("/api/agent/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleaned }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to send code");
        return;
      }

      setStep("otp");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const cleaned = phone.replace(/\s/g, "");
      const res = await fetch("/api/agent/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleaned, code: otp.replace(/\s/g, "") }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Invalid code");
        return;
      }

      router.push("/agent/verify");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
            <svg className="h-7 w-7 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
            </svg>
          </div>
          <h1 className="mt-4 text-xl font-bold text-gray-900">Agent Portal</h1>
          <p className="mt-1 text-sm text-gray-500">Sign in to verify tickets</p>
        </div>

        {step === "phone" ? (
          <form onSubmit={handleRequestOtp} className="space-y-4">
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
                autoFocus
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? "Sending…" : "Send verification code"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label htmlFor="otp" className="mb-1 block text-sm font-medium text-gray-700">
                Enter the 6-digit code sent to {phone}
              </label>
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-center font-mono text-2xl tracking-[0.3em] focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                required
                autoFocus
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading || otp.length < 6}
              className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? "Verifying…" : "Sign in"}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep("phone");
                setOtp("");
                setError(null);
              }}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
            >
              Use a different number
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
