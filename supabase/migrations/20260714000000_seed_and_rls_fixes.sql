-- ============================================================
-- Salone Transit — Seed Data + RLS Fixes
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- INSERT policies (server actions use anon key, not Supabase Auth)
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "Anyone can insert users"
  ON users
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can insert bookings"
  ON bookings
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can insert payments"
  ON payments
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can insert verifications"
  ON verifications
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can insert sms_logs"
  ON sms_logs
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can insert otp_codes"
  ON otp_codes
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can insert agent_sessions"
  ON agent_sessions
  FOR INSERT
  WITH CHECK (true);

-- UPDATE policies for server-side operations
CREATE POLICY "Anyone can update bookings"
  ON bookings
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can update payments"
  ON payments
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can update otp_codes"
  ON otp_codes
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can update agent_sessions"
  ON agent_sessions
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────
-- Seed pilot route + waves
-- ─────────────────────────────────────────────────────────────

INSERT INTO routes (id, origin, destination, active)
VALUES ('38fa0742-a882-4a2f-8920-1dd6f42aa4a7', 'Freetown', 'Bo', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO waves (id, route_id, departure_label, capacity_estimate)
VALUES
  ('c33def9d-f151-4f3b-a25a-9a412ecdee6b', '38fa0742-a882-4a2f-8920-1dd6f42aa4a7', '06:00 AM', 45),
  ('db1ed2f5-c23f-4fe7-9719-9c8a55e8bfa5', '38fa0742-a882-4a2f-8920-1dd6f42aa4a7', '08:30 AM', 45),
  ('72ba4bfb-181a-4437-b445-b384a30d8143', '38fa0742-a882-4a2f-8920-1dd6f42aa4a7', '12:00 PM', 30),
  ('b7f7a901-7613-4014-b958-a9194931330f', '38fa0742-a882-4a2f-8920-1dd6f42aa4a7', '03:00 PM', 45)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- Seed test agent user
-- ─────────────────────────────────────────────────────────────

INSERT INTO users (id, phone, name, role)
VALUES ('00000000-0000-0000-0000-000000000001', '077123456', 'Test Agent', 'agent')
ON CONFLICT (phone) DO NOTHING;

INSERT INTO agents (user_id, station_location, commission_rate)
VALUES ('00000000-0000-0000-0000-000000000001', 'Freetown', 5.00)
ON CONFLICT (user_id) DO NOTHING;

-- Seed test admin user
INSERT INTO users (id, phone, name, role)
VALUES ('00000000-0000-0000-0000-000000000002', '077999999', 'Test Admin', 'admin')
ON CONFLICT (phone) DO NOTHING;
