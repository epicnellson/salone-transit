import { describe, it, expect, beforeEach } from "vitest";
import {
  mockSupabaseStore,
  resetMockStore,
  mockSmsLog,
} from "./setup";

// Must import after mocks are set up
import { POST as initiatePost } from "@/app/api/payments/initiate/route";
import { POST as webhookPost } from "@/app/api/payments/webhook/route";
import { GET as statusGet } from "@/app/api/payments/status/route";
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

describe("Full Booking Flow", () => {
  beforeEach(() => {
    resetMockStore();
    mockSmsLog.length = 0;

    // Seed data
    mockSupabaseStore.users.push(
      { id: "user-1", phone: "+23276123456", name: "Test Passenger", role: "passenger", created_at: new Date().toISOString() },
      { id: "agent-user-1", phone: "+23277000000", name: "Agent One", role: "agent", created_at: new Date().toISOString() }
    );
    mockSupabaseStore.routes.push(
      { id: "route-1", origin: "Freetown", destination: "Bo", price_per_seat: 150000, active: true }
    );
    mockSupabaseStore.waves.push(
      { id: "wave-1", route_id: "route-1", departure_label: "06:00 AM", capacity_estimate: 45, active: true }
    );
    mockSupabaseStore.agents.push(
      { id: "agent-1", user_id: "agent-user-1", station_location: "Freetown Central", commission_rate: 5 }
    );
  });

  it("creates a booking, initiates payment, receives webhook, generates ticket, sends SMS", async () => {
    // Step 1: Create booking (via server action logic directly)
    const bookingId = "booking-1";
    const ticketCode = "ST-TEST0001";

    mockSupabaseStore.bookings.push({
      id: bookingId,
      user_id: "user-1",
      route_id: "route-1",
      wave_id: "wave-1",
      seat_count: 2,
      ticket_code: ticketCode,
      status: "pending",
      total_amount: 300000,
      created_at: new Date().toISOString(),
    });

    // Step 2: Initiate payment
    const initiateReq = makeRequest("POST", "http://localhost:3000/api/payments/initiate", {
      bookingId,
    });

    const initiateRes = await initiatePost(initiateReq);
    const initiateData = await initiateRes.json();

    expect(initiateRes.status).toBe(200);
    expect(initiateData.sessionId).toBeDefined();
    expect(initiateData.redirectUrl).toContain("checkout.monime.io");

    // Verify payment record was created
    const paymentRecord = mockSupabaseStore.payments.find(
      (p) => p.booking_id === bookingId
    );
    expect(paymentRecord).toBeDefined();
    expect(paymentRecord?.status).toBe("pending");
    expect(paymentRecord?.monime_ref).toBe(initiateData.sessionId);

    // Step 3: Simulate webhook confirmation
    const sessionId = initiateData.sessionId;
    const webhookEvent = {
      apiVersion: "2024-01",
      event: { id: "evt-1", name: "checkout_session.completed", timestamp: new Date().toISOString() },
      object: { id: sessionId, type: "checkout_session" },
      data: {},
    };

    const rawBody = JSON.stringify(webhookEvent);
    const signature = signBody(rawBody);

    const webhookReq = makeRequest(
      "POST",
      "http://localhost:3000/api/payments/webhook",
      webhookEvent,
      { "x-monime-signature": signature }
    );

    const webhookRes = await webhookPost(webhookReq);
    const webhookData = await webhookRes.json();

    expect(webhookRes.status).toBe(200);
    expect(webhookData.received).toBe(true);

    // Step 4: Verify booking updated to paid with new ticket code
    const updatedBooking = mockSupabaseStore.bookings.find((b) => b.id === bookingId);
    expect(updatedBooking).toBeDefined();
    expect(updatedBooking?.status).toBe("paid");
    expect(updatedBooking?.ticket_code).not.toBe(ticketCode);
    expect(updatedBooking?.ticket_code).toMatch(/^[A-Z0-9]{6}$/);

    // Step 5: Verify payment confirmed
    const confirmedPayment = mockSupabaseStore.payments.find(
      (p) => p.booking_id === bookingId
    );
    expect(confirmedPayment?.status).toBe("confirmed");

    // Step 6: Verify SMS was sent
    expect(mockSmsLog.length).toBe(1);
    expect(mockSmsLog[0].phone).toBe("+23276123456");
    expect(mockSmsLog[0].purpose).toBe("ticket_confirmation");
    expect(mockSmsLog[0].message).toContain("Your ticket is confirmed");
    expect(mockSmsLog[0].message).toContain(updatedBooking?.ticket_code);

    // Step 7: Verify status endpoint returns paid + ticket code
    const statusReq = makeRequest("GET", `http://localhost:3000/api/payments/status?bookingId=${bookingId}`);
    const statusRes = await statusGet(statusReq);
    const statusData = await statusRes.json();

    expect(statusRes.status).toBe(200);
    expect(statusData.status).toBe("paid");
    expect(statusData.ticketCode).toBe(updatedBooking?.ticket_code);
  });

  it("rejects payment initiation for missing bookingId", async () => {
    const req = makeRequest("POST", "http://localhost:3000/api/payments/initiate", {});
    const res = await initiatePost(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("bookingId is required");
  });

  it("rejects payment initiation for non-existent booking", async () => {
    const req = makeRequest("POST", "http://localhost:3000/api/payments/initiate", {
      bookingId: "non-existent",
    });
    const res = await initiatePost(req);
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Booking not found");
  });

  it("rejects payment initiation for already-paid booking", async () => {
    mockSupabaseStore.bookings.push({
      id: "booking-paid",
      user_id: "user-1",
      route_id: "route-1",
      wave_id: "wave-1",
      seat_count: 1,
      ticket_code: "ST-PAID01",
      status: "paid",
      total_amount: 150000,
      created_at: new Date().toISOString(),
    });

    const req = makeRequest("POST", "http://localhost:3000/api/payments/initiate", {
      bookingId: "booking-paid",
    });
    const res = await initiatePost(req);
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toBe("Booking already paid");
  });

  it("rejects webhook with invalid signature", async () => {
    const event = {
      apiVersion: "2024-01",
      event: { id: "evt-bad", name: "checkout_session.completed", timestamp: new Date().toISOString() },
      object: { id: "bad-sess", type: "checkout_session" },
      data: {},
    };

    const req = makeRequest("POST", "http://localhost:3000/api/payments/webhook", event, {
      "x-monime-signature": "sha256=invalidsignature",
    });
    const res = await webhookPost(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Invalid signature");
  });
});
