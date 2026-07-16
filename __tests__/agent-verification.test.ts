import { describe, it, expect, beforeEach } from "vitest";
import {
  mockSupabaseStore,
  resetMockStore,
  setTestCookie,
  clearTestCookies,
} from "./setup";

import { POST as verifyPost } from "@/app/api/agent/verify-ticket/route";

function makeRequest(method: string, url: string, body?: unknown, headers?: Record<string, string>) {
  const init: RequestInit = {
    method,
    headers: { "Content-Type": "application/json", ...headers },
  };
  if (body) init.body = JSON.stringify(body);
  return new Request(url, init);
}

describe("Agent Verification Flow", () => {
  beforeEach(() => {
    resetMockStore();
    clearTestCookies();

    mockSupabaseStore.users.push(
      { id: "user-1", phone: "+23276123456", name: "Passenger One", role: "passenger", created_at: new Date().toISOString() },
      { id: "agent-user-1", phone: "+23277000000", name: "Agent One", role: "agent", created_at: new Date().toISOString() }
    );
    mockSupabaseStore.agents.push(
      { id: "agent-1", user_id: "agent-user-1", station_location: "Freetown Central", commission_rate: 5 }
    );
  });

  it("verifies a paid booking successfully and logs commission", async () => {
    mockSupabaseStore.bookings.push({
      id: "booking-1",
      user_id: "user-1",
      route_id: "route-1",
      wave_id: "wave-1",
      seat_count: 2,
      ticket_code: "ABC123",
      status: "paid",
      total_amount: 300000,
      created_at: new Date().toISOString(),
    });

    setTestCookie("agent_session", "valid-token");

    const req = makeRequest(
      "POST",
      "http://localhost:3000/api/agent/verify-ticket",
      { bookingId: "booking-1" }
    );

    const res = await verifyPost(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.message).toBe("Booking verified successfully");
    expect(data.commission).toBeDefined();
    expect(data.commission.rate).toBe(5);
    expect(data.commission.totalAmount).toBe(300000);
    expect(data.commission.commissionEarned).toBe(15000);

    const booking = mockSupabaseStore.bookings.find((b) => b.id === "booking-1");
    expect(booking?.status).toBe("verified");

    const verification = mockSupabaseStore.verifications.find(
      (v) => v.booking_id === "booking-1"
    );
    expect(verification).toBeDefined();
    expect(verification?.agent_id).toBe("agent-1");
  });

  it("rejects verification for non-existent booking", async () => {
    setTestCookie("agent_session", "valid-token");

    const req = makeRequest(
      "POST",
      "http://localhost:3000/api/agent/verify-ticket",
      { bookingId: "non-existent" }
    );

    const res = await verifyPost(req);
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Booking not found");
  });

  it("rejects verification for pending (unpaid) booking", async () => {
    mockSupabaseStore.bookings.push({
      id: "booking-pending",
      user_id: "user-1",
      route_id: "route-1",
      wave_id: "wave-1",
      seat_count: 1,
      ticket_code: "PEND01",
      status: "pending",
      total_amount: 150000,
      created_at: new Date().toISOString(),
    });

    setTestCookie("agent_session", "valid-token");

    const req = makeRequest(
      "POST",
      "http://localhost:3000/api/agent/verify-ticket",
      { bookingId: "booking-pending" }
    );

    const res = await verifyPost(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("Cannot verify booking with status: pending");
  });

  it("rejects verification for already-verified booking", async () => {
    mockSupabaseStore.bookings.push({
      id: "booking-verified",
      user_id: "user-1",
      route_id: "route-1",
      wave_id: "wave-1",
      seat_count: 1,
      ticket_code: "VER001",
      status: "verified",
      total_amount: 150000,
      created_at: new Date().toISOString(),
    });

    setTestCookie("agent_session", "valid-token");

    const req = makeRequest(
      "POST",
      "http://localhost:3000/api/agent/verify-ticket",
      { bookingId: "booking-verified" }
    );

    const res = await verifyPost(req);
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toBe("Already verified");
  });

  it("rejects verification when agent already verified this booking", async () => {
    mockSupabaseStore.bookings.push({
      id: "booking-double",
      user_id: "user-1",
      route_id: "route-1",
      wave_id: "wave-1",
      seat_count: 1,
      ticket_code: "DBL001",
      status: "paid",
      total_amount: 150000,
      created_at: new Date().toISOString(),
    });

    mockSupabaseStore.verifications.push({
      id: "v-1",
      booking_id: "booking-double",
      agent_id: "agent-1",
      verified_at: new Date().toISOString(),
    });

    setTestCookie("agent_session", "valid-token");

    const req = makeRequest(
      "POST",
      "http://localhost:3000/api/agent/verify-ticket",
      { bookingId: "booking-double" }
    );

    const res = await verifyPost(req);
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toBe("Already verified by you");
  });

  it("rejects verification without authentication", async () => {
    const req = makeRequest(
      "POST",
      "http://localhost:3000/api/agent/verify-ticket",
      { bookingId: "booking-1" }
    );

    const res = await verifyPost(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Not authenticated");
  });

  it("rejects verification with invalid session", async () => {
    setTestCookie("agent_session", "invalid");

    const req = makeRequest(
      "POST",
      "http://localhost:3000/api/agent/verify-ticket",
      { bookingId: "booking-1" }
    );

    const res = await verifyPost(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Invalid session");
  });

  it("computes commission correctly for different seat counts", async () => {
    mockSupabaseStore.bookings.push({
      id: "booking-3seats",
      user_id: "user-1",
      route_id: "route-1",
      wave_id: "wave-1",
      seat_count: 3,
      ticket_code: "THR001",
      status: "paid",
      total_amount: 450000,
      created_at: new Date().toISOString(),
    });

    setTestCookie("agent_session", "valid-token");

    const req = makeRequest(
      "POST",
      "http://localhost:3000/api/agent/verify-ticket",
      { bookingId: "booking-3seats" }
    );

    const res = await verifyPost(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.commission.totalAmount).toBe(450000);
    expect(data.commission.commissionEarned).toBe(22500);
  });
});
