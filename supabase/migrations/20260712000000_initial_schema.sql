-- ============================================================
-- Salone Transit — Initial Schema Migration
-- ============================================================

-- Custom enums
CREATE TYPE user_role AS ENUM ('passenger', 'agent', 'admin');
CREATE TYPE booking_status AS ENUM ('pending', 'paid', 'verified', 'expired');
CREATE TYPE payment_status AS ENUM ('pending', 'confirmed', 'failed');

-- ─────────────────────────────────────────────────────────────
-- users
-- ─────────────────────────────────────────────────────────────
CREATE TABLE users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone      TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  role       user_role NOT NULL DEFAULT 'passenger',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_phone ON users (phone);

-- ─────────────────────────────────────────────────────────────
-- routes
-- ─────────────────────────────────────────────────────────────
CREATE TABLE routes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  origin      TEXT NOT NULL,
  destination TEXT NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT true
);

-- ─────────────────────────────────────────────────────────────
-- waves
-- ─────────────────────────────────────────────────────────────
CREATE TABLE waves (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id          UUID NOT NULL REFERENCES routes (id) ON DELETE CASCADE,
  departure_label   TEXT NOT NULL,
  capacity_estimate INT  NOT NULL
);

CREATE INDEX idx_waves_route_id ON waves (route_id);

-- ─────────────────────────────────────────────────────────────
-- bookings
-- ─────────────────────────────────────────────────────────────
CREATE TABLE bookings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  route_id    UUID NOT NULL REFERENCES routes (id) ON DELETE CASCADE,
  wave_id     UUID NOT NULL REFERENCES waves (id) ON DELETE CASCADE,
  seat_count  INT  NOT NULL,
  ticket_code TEXT NOT NULL UNIQUE,
  status      booking_status NOT NULL DEFAULT 'pending',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bookings_ticket_code ON bookings (ticket_code);
CREATE INDEX idx_bookings_user_id     ON bookings (user_id);
CREATE INDEX idx_bookings_wave_id     ON bookings (wave_id);

-- ─────────────────────────────────────────────────────────────
-- payments
-- ─────────────────────────────────────────────────────────────
CREATE TABLE payments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id   UUID NOT NULL REFERENCES bookings (id) ON DELETE CASCADE,
  monime_ref   TEXT,
  amount       NUMERIC(10, 2) NOT NULL,
  status       payment_status NOT NULL DEFAULT 'pending',
  confirmed_at TIMESTAMPTZ
);

CREATE INDEX idx_payments_booking_id ON payments (booking_id);

-- ─────────────────────────────────────────────────────────────
-- agents
-- ─────────────────────────────────────────────────────────────
CREATE TABLE agents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  station_location TEXT NOT NULL,
  commission_rate NUMERIC(5, 2) NOT NULL DEFAULT 0
);

CREATE INDEX idx_agents_user_id ON agents (user_id);

-- ─────────────────────────────────────────────────────────────
-- verifications
-- ─────────────────────────────────────────────────────────────
CREATE TABLE verifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id   UUID NOT NULL REFERENCES bookings (id) ON DELETE CASCADE,
  agent_id     UUID NOT NULL REFERENCES agents (id) ON DELETE CASCADE,
  verified_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_verifications_booking_id ON verifications (booking_id);
CREATE INDEX idx_verifications_agent_id   ON verifications (agent_id);

-- ============================================================
-- Row-Level Security
-- ============================================================
ALTER TABLE users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE waves        ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents       ENABLE ROW LEVEL SECURITY;
ALTER TABLE verifications ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────
-- bookings — passengers see only their own
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "Passengers can view own bookings"
  ON bookings
  FOR SELECT
  USING (
    user_id = auth.uid()
  );

-- ─────────────────────────────────────────────────────────────
-- bookings — agents see bookings whose route originates at their station
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "Agents can view station route bookings"
  ON bookings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM   agents a
      JOIN   routes r ON r.origin = a.station_location
      WHERE  a.user_id = auth.uid()
        AND  r.id = bookings.route_id
    )
  );

-- ─────────────────────────────────────────────────────────────
-- bookings — admins see everything
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "Admins can view all bookings"
  ON bookings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM   users u
      WHERE  u.id = auth.uid()
        AND  u.role = 'admin'
    )
  );

-- ─────────────────────────────────────────────────────────────
-- routes — everyone can read, only admins mutate
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "Anyone can view active routes"
  ON routes
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage routes"
  ON routes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM   users u
      WHERE  u.id = auth.uid()
        AND  u.role = 'admin'
    )
  );

-- ─────────────────────────────────────────────────────────────
-- waves — everyone can read, only admins mutate
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "Anyone can view waves"
  ON waves
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage waves"
  ON waves
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM   users u
      WHERE  u.id = auth.uid()
        AND  u.role = 'admin'
    )
  );

-- ─────────────────────────────────────────────────────────────
-- payments — passengers see their own, agents see their station's
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "Passengers can view own payments"
  ON payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM   bookings b
      WHERE  b.id = payments.booking_id
        AND  b.user_id = auth.uid()
    )
  );

CREATE POLICY "Agents can view station route payments"
  ON payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM   bookings b
      JOIN   routes r   ON r.id = b.route_id
      JOIN   agents a   ON a.station_location = r.origin
      WHERE  b.id = payments.booking_id
        AND  a.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- verifications — agents see their own, admins see all
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "Agents can view own verifications"
  ON verifications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM   agents a
      WHERE  a.id = verifications.agent_id
        AND  a.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all verifications"
  ON verifications
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM   users u
      WHERE  u.id = auth.uid()
        AND  u.role = 'admin'
    )
  );

-- ─────────────────────────────────────────────────────────────
-- users — users see own profile, agents see station agents
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "Users can view own profile"
  ON users
  FOR SELECT
  USING (
    id = auth.uid()
  );

CREATE POLICY "Admins can view all users"
  ON users
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM   users u
      WHERE  u.id = auth.uid()
        AND  u.role = 'admin'
    )
  );
