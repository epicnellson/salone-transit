import { describe, it, expect, beforeEach } from "vitest";
import {
  mockSupabaseStore,
  resetMockStore,
  mockSmsLog,
} from "./setup";

import { POST as initiatePost } from "@/app/api/payments/initiate/route";
import { POST as webhookPost } from "@/app/api/payments/webhook/route";
import { GET as statusGet } from "@/app/api/payments/status/route";
import { checkRateLimit, resetAllRateLimits, BOOKING_RATE_LIMIT } from "@/lib/rate-limit";
import { createHmac } from "crypto";

function makeRequest(method: string, url: string, body?: unknown, headers?: Record<string, string>) {
  const init: RequestInit = {
    method,
    headers: { "Content-Type": "application/json", ...headers },
  };
  if (body) init.body = JSON.stringify(body);
  return new Request(url, init);
}

function signBody(body: string): string {
  return "sha256=" + createHmac("sha256", "test-webhook-secret").update(body).digest("hex");
}

describe("Edge Cases", () => {
  beforeEach(() => {
    resetMockStore();
    resetAllRateLimits();
    mockSmsLog.length = 0;

    mockSupabaseStore.users.push(
      { id: "user-1", phone: "+23276123456", name: "Passenger", role: "passenger", created_at: new Date().toISOString() },
      { id: "agent-user-1", phone: "+23277000000", name: "Agent", role: "agent", created_at: new Date().toISOString() }
    );
    mockSupabaseStore.routes.push(
      { id: "route-1", origin: "Freetown", destination: "Bo", price_per_seat: 150000, active: true }
    );
    mockSupabaseStore.waves.push(
      { id: "wave-1", route_id: "route-1", departure_label: "06:00 AM", capacity_estimate: 45, active: true }
    );
    mockSupabaseStore.agents.push(
      { id: "agent-1", user_id: "agent-user-1", station_location: "Freetown", commission_rate: 5 }
    );
  });

  describe("Double-booking same ticket code", () => {
    it("prevents duplicate ticket codes by generating unique codes per webhook", async () => {
      mockSupabaseStore.bookings.push(
        {
          id: "booking-a",
          user_id: "user-1",
          route_id: "route-1",
          wave_id: "wave-1",
          seat_count: 1,
          ticket_code: "DUP001",
          status: "pending",
          total_amount: 150000,
          created_at: new Date().toISOString(),
        },
        {
          id: "booking-b",
          user_id: "user-1",
          route_id: "route-1",
          wave_id: "wave-1",
          seat_count: 1,
          ticket_code: "DUP001",
          status: "pending",
          total_amount: 150000,
          created_at: new Date().toISOString(),
        }
      );

      mockSupabaseStore.payments.push(
        { id: "pay-a", booking_id: "booking-a", monime_ref: "sess-a", amount: 150000, status: "pending", confirmed_at: null },
        { id: "pay-b", booking_id: "booking-b", monime_ref: "sess-b", amount: 150000, status: "pending", confirmed_at: null }
      );

      // Webhook for booking A
      const eventA = {
        apiVersion: "2024-01",
        event: { id: "evt-a", name: "checkout_session.completed", timestamp: new Date().toISOString() },
        object: { id: "sess-a", type: "checkout_session" },
        data: {},
      };
      const rawBodyA = JSON.stringify(eventA);
      const res1 = await webhookPost(makeRequest("POST", "http://localhost:3000/api/payments/webhook", eventA, {
        "x-monime-signature": signBody(rawBodyA),
      }));
      expect(res1.status).toBe(200);

      // Webhook for booking B
      const eventB = {
        apiVersion: "2024-01",
        event: { id: "evt-b", name: "checkout_session.completed", timestamp: new Date().toISOString() },
        object: { id: "sess-b", type: "checkout_session" },
        data: {},
      };
      const rawBodyB = JSON.stringify(eventB);
      const res2 = await webhookPost(makeRequest("POST", "http://localhost:3000/api/payments/webhook", eventB, {
        "x-monime-signature": signBody(rawBodyB),
      }));
      expect(res2.status).toBe(200);

      const bookingA = mockSupabaseStore.bookings.find((b) => b.id === "booking-a");
      const bookingB = mockSupabaseStore.bookings.find((b) => b.id === "booking-b");

      expect(bookingA?.status).toBe("paid");
      expect(bookingB?.status).toBe("paid");
      expect(bookingA?.ticket_code).not.toBe(bookingB?.ticket_code);
      expect(bookingA?.ticket_code).toMatch(/^[A-Z0-9]{6}$/);
      expect(bookingB?.ticket_code).toMatch(/^[A-Z0-9]{6}$/);
    });
  });

  describe("Webhook replay / duplicate events", () => {
    it("ignores duplicate completed webhook events (idempotent)", async () => {
      mockSupabaseStore.bookings.push({
        id: "booking-replay",
        user_id: "user-1",
        route_id: "route-1",
        wave_id: "wave-1",
        seat_count: 1,
        ticket_code: "RPL001",
        status: "pending",
        total_amount: 150000,
        created_at: new Date().toISOString(),
      });
      mockSupabaseStore.payments.push({
        id: "pay-replay",
        booking_id: "booking-replay",
        monime_ref: "sess-replay",
        amount: 150000,
        status: "pending",
        confirmed_at: null,
      });

      const event = {
        apiVersion: "2024-01",
        event: { id: "evt-replay", name: "checkout_session.completed", timestamp: new Date().toISOString() },
        object: { id: "sess-replay", type: "checkout_session" },
        data: {},
      };
      const rawBody = JSON.stringify(event);
      const sig = signBody(rawBody);

      // Send webhook twice
      const res1 = await webhookPost(makeRequest("POST", "http://localhost:3000/api/payments/webhook", event, { "x-monime-signature": sig }));
      expect(res1.status).toBe(200);

      const res2 = await webhookPost(makeRequest("POST", "http://localhost:3000/api/payments/webhook", event, { "x-monime-signature": sig }));
      expect(res2.status).toBe(200);

      // SMS should only be sent once
      const smsForBooking = mockSmsLog.filter((s) => s.purpose === "ticket_confirmation");
      expect(smsForBooking.length).toBe(1);
    });

    it("handles expired and cancelled webhook events", async () => {
      for (const eventName of ["checkout_session.expired", "checkout_session.cancelled"]) {
        resetMockStore();
        mockSmsLog.length = 0;
        mockSupabaseStore.users.push(
          { id: "user-1", phone: "+23276123456", name: "Passenger", role: "passenger", created_at: new Date().toISOString() }
        );
        mockSupabaseStore.bookings.push({
          id: `booking-${eventName.slice(-7)}`,
          user_id: "user-1",
          route_id: "route-1",
          wave_id: "wave-1",
          seat_count: 1,
          ticket_code: `T-${eventName.slice(-7)}`,
          status: "pending",
          total_amount: 150000,
          created_at: new Date().toISOString(),
        });
        mockSupabaseStore.payments.push({
          id: `pay-${eventName.slice(-7)}`,
          booking_id: `booking-${eventName.slice(-7)}`,
          monime_ref: `sess-${eventName.slice(-7)}`,
          amount: 150000,
          status: "pending",
          confirmed_at: null,
        });

        const event = {
          apiVersion: "2024-01",
          event: { id: `evt-${eventName.slice(-7)}`, name: eventName, timestamp: new Date().toISOString() },
          object: { id: `sess-${eventName.slice(-7)}`, type: "checkout_session" },
          data: {},
        };
        const rawBody = JSON.stringify(event);

        const res = await webhookPost(makeRequest("POST", "http://localhost:3000/api/payments/webhook", event, {
          "x-monime-signature": signBody(rawBody),
        }));

        expect(res.status).toBe(200);

        const payment = mockSupabaseStore.payments.find((p) => p.id === `pay-${eventName.slice(-7)}`);
        expect(payment?.status).toBe("failed");

        const booking = mockSupabaseStore.bookings.find((b) => b.id === `booking-${eventName.slice(-7)}`);
        expect(booking?.status).toBe("pending");
      }
    });
  });

  describe("Booking expiry after grace period", () => {
    it("expires pending booking when grace period has elapsed (via initiate)", async () => {
      const pastTime = new Date(Date.now() - 20 * 60 * 1000).toISOString();
      mockSupabaseStore.bookings.push({
        id: "booking-expired",
        user_id: "user-1",
        route_id: "route-1",
        wave_id: "wave-1",
        seat_count: 1,
        ticket_code: "EXP001",
        status: "pending",
        total_amount: 150000,
        created_at: pastTime,
      });

      const req = makeRequest("POST", "http://localhost:3000/api/payments/initiate", {
        bookingId: "booking-expired",
      });
      const res = await initiatePost(req);
      const data = await res.json();

      expect(res.status).toBe(410);
      expect(data.error).toBe("Booking has expired");

      const booking = mockSupabaseStore.bookings.find((b) => b.id === "booking-expired");
      expect(booking?.status).toBe("expired");
    });

    it("expires pending booking via status endpoint when grace period elapsed", async () => {
      const pastTime = new Date(Date.now() - 20 * 60 * 1000).toISOString();
      mockSupabaseStore.bookings.push({
        id: "booking-status-expired",
        user_id: "user-1",
        route_id: "route-1",
        wave_id: "wave-1",
        seat_count: 1,
        ticket_code: "ST-exp",
        status: "pending",
        total_amount: 150000,
        created_at: pastTime,
      });

      const req = makeRequest("GET", "http://localhost:3000/api/payments/status?bookingId=booking-status-expired");
      const res = await statusGet(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.status).toBe("expired");
      expect(data.ticketCode).toBeNull();

      const booking = mockSupabaseStore.bookings.find((b) => b.id === "booking-status-expired");
      expect(booking?.status).toBe("expired");
    });

    it("does not expire booking within grace period", async () => {
      const recentTime = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      mockSupabaseStore.bookings.push({
        id: "booking-fresh",
        user_id: "user-1",
        route_id: "route-1",
        wave_id: "wave-1",
        seat_count: 1,
        ticket_code: "FRSH01",
        status: "pending",
        total_amount: 150000,
        created_at: recentTime,
      });

      const req = makeRequest("GET", "http://localhost:3000/api/payments/status?bookingId=booking-fresh");
      const res = await statusGet(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.status).toBe("pending");

      const booking = mockSupabaseStore.bookings.find((b) => b.id === "booking-fresh");
      expect(booking?.status).toBe("pending");
    });
  });

  describe("Rate limiting", () => {
    it("allows requests within limit", () => {
      const key = "test-booking-ratelimit";
      for (let i = 0; i < 5; i++) {
        const result = checkRateLimit(key, BOOKING_RATE_LIMIT);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(4 - i);
      }
    });

    it("blocks requests exceeding limit", () => {
      const key = "test-booking-ratelimit-block";
      for (let i = 0; i < 5; i++) {
        checkRateLimit(key, BOOKING_RATE_LIMIT);
      }
      const result = checkRateLimit(key, BOOKING_RATE_LIMIT);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it("allows requests after window resets", async () => {
      const key = "test-ratelimit-reset";
      const shortWindow = { ...BOOKING_RATE_LIMIT, windowMs: 100 };

      for (let i = 0; i < 5; i++) {
        checkRateLimit(key, shortWindow);
      }
      const blocked = checkRateLimit(key, shortWindow);
      expect(blocked.allowed).toBe(false);

      await new Promise((resolve) => setTimeout(resolve, 150));

      const allowed = checkRateLimit(key, shortWindow);
      expect(allowed.allowed).toBe(true);
      expect(allowed.remaining).toBe(4);
    });

    it("independent keys have independent limits", () => {
      const key1 = "test-key-1";
      const key2 = "test-key-2";

      for (let i = 0; i < 5; i++) {
        checkRateLimit(key1, BOOKING_RATE_LIMIT);
      }

      const result1 = checkRateLimit(key1, BOOKING_RATE_LIMIT);
      const result2 = checkRateLimit(key2, BOOKING_RATE_LIMIT);

      expect(result1.allowed).toBe(false);
      expect(result2.allowed).toBe(true);
    });
  });
});
