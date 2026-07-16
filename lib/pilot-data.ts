// Route/wave IDs must match seed data in supabase/migrations/20260714000000_seed_and_rls_fixes.sql

export const PILOT_ROUTE_ID = "38fa0742-a882-4a2f-8920-1dd6f42aa4a7";

export const PILOT_ROUTE = {
  id: PILOT_ROUTE_ID,
  origin: "Freetown",
  destination: "Bo",
  active: true,
};

export const PILOT_WAVES = [
  { id: "c33def9d-f151-4f3b-a25a-9a412ecdee6b", route_id: PILOT_ROUTE_ID, departure_label: "06:00 AM", capacity_estimate: 45 },
  { id: "db1ed2f5-c23f-4fe7-9719-9c8a55e8bfa5", route_id: PILOT_ROUTE_ID, departure_label: "08:30 AM", capacity_estimate: 45 },
  { id: "72ba4bfb-181a-4437-b445-b384a30d8143", route_id: PILOT_ROUTE_ID, departure_label: "12:00 PM", capacity_estimate: 30 },
  { id: "b7f7a901-7613-4014-b958-a9194931330f", route_id: PILOT_ROUTE_ID, departure_label: "03:00 PM", capacity_estimate: 45 },
] as const;

export const PRICE_PER_SEAT = 150_000;

export const BOOKED_SEATS: Record<string, number> = {
  "c33def9d-f151-4f3b-a25a-9a412ecdee6b": 32,
  "db1ed2f5-c23f-4fe7-9719-9c8a55e8bfa5": 18,
  "72ba4bfb-181a-4437-b445-b384a30d8143": 29,
  "b7f7a901-7613-4014-b958-a9194931330f": 7,
};
