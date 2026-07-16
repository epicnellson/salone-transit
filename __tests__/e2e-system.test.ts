import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mockSupabaseStore,
  resetMockStore,
  mockSmsLog,
  setTestCookie,
  clearTestCookies,
} from "./setup";

import { POST as initiatePost } from "@/app/api/payments/initiate/route";
import { POST as webhookPost } from "@/app/api/payments/webhook/route";
import { GET as statusGet } from "@/app/api/payments/status/route";
import { POST as verifyPost } from "@/app/api/agent/verify-ticket/route";
import { GET as checkTicketGet } from "@/app/api/agent/check-ticket/route";
import { POST as agentOtpPost } from "@/app/api/agent/otp/route";
import { POST as agentOtpVerifyPost } from "@/app/api/agent/otp/verify/route";
import { GET as statsGet } from "@/app/api/admin/stats/route";
import { createHmac } from "crypto";

function makeRequest(
  method: string,
  url: string,
  body?: unknown,
  headers?: Record<string, string>
) {
  const init: RequestInit = {
    method,
    headers: { "Content-Type": "application/json", ...headers },
  };
  if (body) init.body = JSON.stringify(body);
  return new Request(url, init);
}

function signBody(rawBody: string): string {
  return (
    "sha256=" +
    createHmac("sha256", "test-webhook-secret").update(rawBody).digest("hex")
  );
}

function makeWebhookEvent(name: string, sessionId: string) {
  const event = {
    apiVersion: "2024-01",
    event: { id: `evt-${Date.now()}`, name, timestamp: new Date().toISOString() },
    object: { id: sessionId, type: "checkout_session" },
    data: {},
  };
  const rawBody = JSON.stringify(event);
  return { event, rawBody, signature: signBody(rawBody) };
}

describe("Full System E2E", () => {
  beforeEach(() => {
    resetMockStore();
    clearTestCookies();
    mockSmsLog.length = 0;

    mockSupabaseStore.users.push(
      {
        id: "user-passenger",
        phone: "+23276111111",
        name: "John Kamara",
        role: "passenger",
        created_at: new Date().toISOString(),
      },
      {
        id: "user-agent",
        phone: "+23276222222",
        name: "Agent Smith",
        role: "agent",
        created_at: new Date().toISOString(),
      },
      {
        id: "user-admin",
        phone: "+23276333333",
        name: "Admin User",
        role: "admin",
        created_at: new Date().toISOString(),
      }
    );

    mockSupabaseStore.routes.push({
      id: "route-ft-bo",
      origin: "Freetown",
      destination: "Bo",
      price_per_seat: 150000,
      active: true,
    });

    mockSupabaseStore.waves.push(
      {
        id: "wave-6am",
        route_id: "route-ft-bo",
        departure_label: "06:00 AM",
        capacity_estimate: 45,
        active: true,
      },
      {
        id: "wave-830am",
        route_id: "route-ft-bo",
        departure_label: "08:30 AM",
        capacity_estimate: 45,
        active: true,
      }
    );

    mockSupabaseStore.agents.push({
      id: "agent-1",
      user_id: "user-agent",
      station_location: "Freetown Central",
      commission_rate: 5,
    });
  });

  // ============================================================
  // SCENARIO 1: Complete passenger journey
  // ============================================================
  describe("Scenario 1: Passenger books, pays, gets verified", () => {
    it("full journey: booking → payment → webhook → ticket → SMS → agent verification → commission", async () => {
      // --- STEP 1: Passenger creates a booking ---
      const bookingId = "booking-e2e-1";
      const initialTicketCode = "ST-E2E0001";
      mockSupabaseStore.bookings.push({
        id: bookingId,
        user_id: "user-passenger",
        route_id: "route-ft-bo",
        wave_id: "wave-6am",
        seat_count: 2,
        ticket_code: initialTicketCode,
        status: "pending",
        total_amount: 300000,
        created_at: new Date().toISOString(),
      });

      // --- STEP 2: Passenger initiates payment ---
      const initiateRes = await initiatePost(
        makeRequest("POST", "http://localhost:3000/api/payments/initiate", {
          bookingId,
        })
      );
      const initiateData = await initiateRes.json();

      expect(initiateRes.status).toBe(200);
      expect(initiateData.sessionId).toBeDefined();
      expect(initiateData.redirectUrl).toContain("checkout.monime.io");

      // Verify payment record created
      const payment = mockSupabaseStore.payments.find(
        (p) => p.booking_id === bookingId
      );
      expect(payment).toBeDefined();
      expect(payment?.status).toBe("pending");
      expect(payment?.amount).toBe(300000);
      expect(payment?.monime_ref).toBe(initiateData.sessionId);

      // --- STEP 3: Check status (still pending) ---
      const status1 = await statusGet(
        makeRequest(
          "GET",
          `http://localhost:3000/api/payments/status?bookingId=${bookingId}`
        )
      );
      const statusData1 = await status1.json();
      expect(statusData1.status).toBe("pending");
      expect(statusData1.ticketCode).toBeNull();

      // --- STEP 4: Monime sends webhook (payment completed) ---
      const { event, rawBody, signature } = makeWebhookEvent(
        "checkout_session.completed",
        initiateData.sessionId
      );

      const webhookRes = await webhookPost(
        makeRequest(
          "POST",
          "http://localhost:3000/api/payments/webhook",
          event,
          { "x-monime-signature": signature }
        )
      );
      const webhookData = await webhookRes.json();
      expect(webhookRes.status).toBe(200);
      expect(webhookData.received).toBe(true);

      // --- STEP 5: Verify booking is now paid with new ticket code ---
      const updatedBooking = mockSupabaseStore.bookings.find(
        (b) => b.id === bookingId
      );
      expect(updatedBooking?.status).toBe("paid");
      expect(updatedBooking?.ticket_code).not.toBe(initialTicketCode);
      expect(updatedBooking?.ticket_code).toMatch(/^[A-Z0-9]{6}$/);

      const confirmedPayment = mockSupabaseStore.payments.find(
        (p) => p.booking_id === bookingId
      );
      expect(confirmedPayment?.status).toBe("confirmed");
      expect(confirmedPayment?.confirmed_at).toBeDefined();

      // --- STEP 6: SMS confirmation was sent ---
      const confirmationSms = mockSmsLog.find(
        (s) => s.purpose === "ticket_confirmation"
      );
      expect(confirmationSms).toBeDefined();
      expect(confirmationSms?.phone).toBe("+23276111111");
      expect(confirmationSms?.message).toContain("Your ticket is confirmed");
      expect(confirmationSms?.message).toContain(updatedBooking?.ticket_code);
      expect(confirmationSms?.message).toContain("Freetown → Bo");
      expect(confirmationSms?.message).toContain("2");

      // --- STEP 7: Check status returns paid + ticket code ---
      const status2 = await statusGet(
        makeRequest(
          "GET",
          `http://localhost:3000/api/payments/status?bookingId=${bookingId}`
        )
      );
      const statusData2 = await status2.json();
      expect(statusData2.status).toBe("paid");
      expect(statusData2.ticketCode).toBe(updatedBooking?.ticket_code);

      // --- STEP 8: Agent looks up the ticket ---
      setTestCookie("agent_session", "valid-token");

      const checkRes = await checkTicketGet(
        makeRequest(
          "GET",
          `http://localhost:3000/api/agent/check-ticket?ticketCode=${updatedBooking?.ticket_code}`
        )
      );
      const checkData = await checkRes.json();
      expect(checkRes.status).toBe(200);
      expect(checkData.booking.passengerName).toBe("John Kamara");
      expect(checkData.booking.route).toBe("Freetown → Bo");
      expect(checkData.booking.departure).toBe("06:00 AM");
      expect(checkData.booking.seatCount).toBe(2);
      expect(checkData.booking.status).toBe("paid");
      expect(checkData.alreadyVerified).toBe(false);

      // --- STEP 9: Agent verifies the ticket ---
      const verifyRes = await verifyPost(
        makeRequest(
          "POST",
          "http://localhost:3000/api/agent/verify-ticket",
          { bookingId }
        )
      );
      const verifyData = await verifyRes.json();
      expect(verifyRes.status).toBe(200);
      expect(verifyData.message).toBe("Booking verified successfully");
      expect(verifyData.commission.rate).toBe(5);
      expect(verifyData.commission.totalAmount).toBe(300000);
      expect(verifyData.commission.commissionEarned).toBe(15000);

      // --- STEP 10: Booking status is now "verified" ---
      const finalBooking = mockSupabaseStore.bookings.find(
        (b) => b.id === bookingId
      );
      expect(finalBooking?.status).toBe("verified");

      // --- STEP 11: Verification record exists ---
      const verification = mockSupabaseStore.verifications.find(
        (v) => v.booking_id === bookingId
      );
      expect(verification).toBeDefined();
      expect(verification?.agent_id).toBe("agent-1");

      // --- STEP 12: Trying to verify again is rejected ---
      const dupVerify = await verifyPost(
        makeRequest(
          "POST",
          "http://localhost:3000/api/agent/verify-ticket",
          { bookingId }
        )
      );
      expect(dupVerify.status).toBe(409);
    });
  });

  // ============================================================
  // SCENARIO 2: Agent auth flow
  // ============================================================
  describe("Scenario 2: Agent authentication", () => {
    it("agent can request OTP and verify it (stubbed)", async () => {
      // Agent requests OTP
      const otpRes = await agentOtpPost(
        makeRequest("POST", "http://localhost:3000/api/agent/otp", {
          phone: "+23276222222",
        })
      );
      const otpData = await otpRes.json();
      expect(otpRes.status).toBe(200);
      expect(otpData.message).toBe("Verification code sent.");

      // SMS was sent (stubbed)
      const otpSms = mockSmsLog.find((s) => s.purpose === "agent_otp");
      expect(otpSms).toBeDefined();
      expect(otpSms?.phone).toBe("+23276222222");
      expect(otpSms?.message).toContain("verification code");

      // Non-agent phone is rejected
      const badOtpRes = await agentOtpPost(
        makeRequest("POST", "http://localhost:3000/api/agent/otp", {
          phone: "+23276111111",
        })
      );
      expect(badOtpRes.status).toBe(403);
    });
  });

  // ============================================================
  // SCENARIO 3: Payment edge cases
  // ============================================================
  describe("Scenario 3: Payment edge cases", () => {
    it("expired booking is rejected at payment initiation", async () => {
      const oldTime = new Date(Date.now() - 20 * 60 * 1000).toISOString();
      mockSupabaseStore.bookings.push({
        id: "booking-old",
        user_id: "user-passenger",
        route_id: "route-ft-bo",
        wave_id: "wave-6am",
        seat_count: 1,
        ticket_code: "OLD001",
        status: "pending",
        total_amount: 150000,
        created_at: oldTime,
      });

      const res = await initiatePost(
        makeRequest("POST", "http://localhost:3000/api/payments/initiate", {
          bookingId: "booking-old",
        })
      );
      expect(res.status).toBe(410);

      const booking = mockSupabaseStore.bookings.find(
        (b) => b.id === "booking-old"
      );
      expect(booking?.status).toBe("expired");
    });

    it("webhook handles both expired and cancelled events", async () => {
      for (const eventName of [
        "checkout_session.expired",
        "checkout_session.cancelled",
      ]) {
        resetMockStore();
        clearTestCookies();
        mockSmsLog.length = 0;
        mockSupabaseStore.users.push({
          id: "user-passenger",
          phone: "+23276111111",
          name: "John",
          role: "passenger",
          created_at: new Date().toISOString(),
        });

        const bid = `booking-${eventName.split(".").pop()}`;
        mockSupabaseStore.bookings.push({
          id: bid,
          user_id: "user-passenger",
          route_id: "route-ft-bo",
          wave_id: "wave-6am",
          seat_count: 1,
          ticket_code: "TST001",
          status: "pending",
          total_amount: 150000,
          created_at: new Date().toISOString(),
        });
        mockSupabaseStore.payments.push({
          id: `pay-${eventName.split(".").pop()}`,
          booking_id: bid,
          monime_ref: `sess-${eventName.split(".").pop()}`,
          amount: 150000,
          status: "pending",
          confirmed_at: null,
        });

        const { event, rawBody, signature } = makeWebhookEvent(
          eventName,
          `sess-${eventName.split(".").pop()}`
        );

        const res = await webhookPost(
          makeRequest(
            "POST",
            "http://localhost:3000/api/payments/webhook",
            event,
            { "x-monime-signature": signature }
          )
        );
        expect(res.status).toBe(200);

        const payment = mockSupabaseStore.payments.find((p) => p.id === `pay-${eventName.split(".").pop()}`);
        expect(payment?.status).toBe("failed");
      }
    });
  });

  // ============================================================
  // SCENARIO 4: Duplicate ticket codes prevented
  // ============================================================
  describe("Scenario 4: Duplicate ticket codes", () => {
    it("two bookings get unique ticket codes after webhook", async () => {
      mockSupabaseStore.bookings.push(
        {
          id: "b-dup-a",
          user_id: "user-passenger",
          route_id: "route-ft-bo",
          wave_id: "wave-6am",
          seat_count: 1,
          ticket_code: "DUP001",
          status: "pending",
          total_amount: 150000,
          created_at: new Date().toISOString(),
        },
        {
          id: "b-dup-b",
          user_id: "user-passenger",
          route_id: "route-ft-bo",
          wave_id: "wave-830am",
          seat_count: 1,
          ticket_code: "DUP001",
          status: "pending",
          total_amount: 150000,
          created_at: new Date().toISOString(),
        }
      );

      mockSupabaseStore.payments.push(
        {
          id: "pay-dup-a",
          booking_id: "b-dup-a",
          monime_ref: "sess-dup-a",
          amount: 150000,
          status: "pending",
          confirmed_at: null,
        },
        {
          id: "pay-dup-b",
          booking_id: "b-dup-b",
          monime_ref: "sess-dup-b",
          amount: 150000,
          status: "pending",
          confirmed_at: null,
        }
      );

      const evtA = makeWebhookEvent("checkout_session.completed", "sess-dup-a");
      await webhookPost(
        makeRequest("POST", "http://localhost:3000/api/payments/webhook", evtA.event, {
          "x-monime-signature": evtA.signature,
        })
      );

      const evtB = makeWebhookEvent("checkout_session.completed", "sess-dup-b");
      await webhookPost(
        makeRequest("POST", "http://localhost:3000/api/payments/webhook", evtB.event, {
          "x-monime-signature": evtB.signature,
        })
      );

      const bA = mockSupabaseStore.bookings.find((b) => b.id === "b-dup-a");
      const bB = mockSupabaseStore.bookings.find((b) => b.id === "b-dup-b");

      expect(bA?.status).toBe("paid");
      expect(bB?.status).toBe("paid");
      expect(bA?.ticket_code).not.toBe(bB?.ticket_code);
      expect(bA?.ticket_code).toMatch(/^[A-Z0-9]{6}$/);
      expect(bB?.ticket_code).toMatch(/^[A-Z0-9]{6}$/);
    });
  });

  // ============================================================
  // SCENARIO 5: Webhook idempotency
  // ============================================================
  describe("Scenario 5: Webhook idempotency", () => {
    it("duplicate webhook does not send duplicate SMS", async () => {
      mockSupabaseStore.bookings.push({
        id: "b-replay",
        user_id: "user-passenger",
        route_id: "route-ft-bo",
        wave_id: "wave-6am",
        seat_count: 1,
        ticket_code: "RPL001",
        status: "pending",
        total_amount: 150000,
        created_at: new Date().toISOString(),
      });
      mockSupabaseStore.payments.push({
        id: "pay-replay",
        booking_id: "b-replay",
        monime_ref: "sess-replay",
        amount: 150000,
        status: "pending",
        confirmed_at: null,
      });

      const evt = makeWebhookEvent("checkout_session.completed", "sess-replay");

      const res1 = await webhookPost(
        makeRequest("POST", "http://localhost:3000/api/payments/webhook", evt.event, {
          "x-monime-signature": evt.signature,
        })
      );
      expect(res1.status).toBe(200);

      const res2 = await webhookPost(
        makeRequest("POST", "http://localhost:3000/api/payments/webhook", evt.event, {
          "x-monime-signature": evt.signature,
        })
      );
      expect(res2.status).toBe(200);

      const confirmSms = mockSmsLog.filter(
        (s) => s.purpose === "ticket_confirmation"
      );
      expect(confirmSms.length).toBe(1);
    });
  });

  // ============================================================
  // SCENARIO 6: Admin dashboard stats
  // ============================================================
  describe("Scenario 6: Admin dashboard", () => {
    it("admin can fetch stats", async () => {
      setTestCookie("admin_session", "valid-admin-token");

      const res = await statsGet(
        makeRequest("GET", "http://localhost:3000/api/admin/stats")
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toHaveProperty("todayBookings");
      expect(data).toHaveProperty("totalBookings");
      expect(data).toHaveProperty("todayRevenue");
      expect(data).toHaveProperty("totalRevenue");
      expect(data).toHaveProperty("verificationRate");
      expect(data).toHaveProperty("noShowRate");
      expect(data).toHaveProperty("dailyBookings");
      expect(data).toHaveProperty("dailyRevenue");
    });

    it("unauthenticated admin request is rejected", async () => {
      const res = await statsGet(
        makeRequest("GET", "http://localhost:3000/api/admin/stats")
      );
      expect(res.status).toBe(401);
    });
  });

  // ============================================================
  // SCENARIO 7: SMS logging
  // ============================================================
  describe("Scenario 7: SMS logging", () => {
    it("all SMS are logged with correct metadata", async () => {
      mockSupabaseStore.bookings.push({
        id: "b-sms",
        user_id: "user-passenger",
        route_id: "route-ft-bo",
        wave_id: "wave-6am",
        seat_count: 1,
        ticket_code: "SMS001",
        status: "pending",
        total_amount: 150000,
        created_at: new Date().toISOString(),
      });
      mockSupabaseStore.payments.push({
        id: "pay-sms",
        booking_id: "b-sms",
        monime_ref: "sess-sms",
        amount: 150000,
        status: "pending",
        confirmed_at: null,
      });

      const evt = makeWebhookEvent("checkout_session.completed", "sess-sms");
      await webhookPost(
        makeRequest("POST", "http://localhost:3000/api/payments/webhook", evt.event, {
          "x-monime-signature": evt.signature,
        })
      );

      expect(mockSmsLog.length).toBe(1);
      expect(mockSmsLog[0]).toHaveProperty("phone");
      expect(mockSmsLog[0]).toHaveProperty("message");
      expect(mockSmsLog[0]).toHaveProperty("purpose", "ticket_confirmation");
      expect(mockSmsLog[0].phone).toMatch(/^\+232/);
    });
  });

  // ============================================================
  // SCENARIO 8: Booking validation
  // ============================================================
  describe("Scenario 8: Input validation", () => {
    it("initiate rejects missing bookingId", async () => {
      const res = await initiatePost(
        makeRequest("POST", "http://localhost:3000/api/payments/initiate", {})
      );
      expect(res.status).toBe(400);
    });

    it("initiate rejects non-existent booking", async () => {
      const res = await initiatePost(
        makeRequest("POST", "http://localhost:3000/api/payments/initiate", {
          bookingId: "nonexistent",
        })
      );
      expect(res.status).toBe(404);
    });

    it("initiate rejects already-paid booking", async () => {
      mockSupabaseStore.bookings.push({
        id: "b-paid",
        user_id: "user-passenger",
        route_id: "route-ft-bo",
        wave_id: "wave-6am",
        seat_count: 1,
        ticket_code: "PAID01",
        status: "paid",
        total_amount: 150000,
        created_at: new Date().toISOString(),
      });

      const res = await initiatePost(
        makeRequest("POST", "http://localhost:3000/api/payments/initiate", {
          bookingId: "b-paid",
        })
      );
      expect(res.status).toBe(409);
    });

    it("webhook rejects invalid signature", async () => {
      const { event } = makeWebhookEvent("checkout_session.completed", "x");
      const res = await webhookPost(
        makeRequest(
          "POST",
          "http://localhost:3000/api/payments/webhook",
          event,
          { "x-monime-signature": "sha256=bad" }
        )
      );
      expect(res.status).toBe(401);
    });

    it("verify rejects without auth", async () => {
      clearTestCookies();
      const res = await verifyPost(
        makeRequest("POST", "http://localhost:3000/api/agent/verify-ticket", {
          bookingId: "anything",
        })
      );
      expect(res.status).toBe(401);
    });

    it("verify rejects non-existent booking", async () => {
      setTestCookie("agent_session", "valid-token");
      const res = await verifyPost(
        makeRequest("POST", "http://localhost:3000/api/agent/verify-ticket", {
          bookingId: "nonexistent",
        })
      );
      expect(res.status).toBe(404);
    });

    it("verify rejects pending booking", async () => {
      setTestCookie("agent_session", "valid-token");
      mockSupabaseStore.bookings.push({
        id: "b-pending",
        user_id: "user-passenger",
        route_id: "route-ft-bo",
        wave_id: "wave-6am",
        seat_count: 1,
        ticket_code: "PEND01",
        status: "pending",
        total_amount: 150000,
        created_at: new Date().toISOString(),
      });

      const res = await verifyPost(
        makeRequest("POST", "http://localhost:3000/api/agent/verify-ticket", {
          bookingId: "b-pending",
        })
      );
      expect(res.status).toBe(400);
    });
  });
});
