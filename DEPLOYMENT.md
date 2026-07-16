# Deployment Guide

## Environment Variables

All variables must be set in Vercel's Environment Variables dashboard (Settings → Environment Variables).

### Supabase

| Variable | Description | Example |
|----------|-------------|---------|
| `SUPABASE_URL` | Supabase project URL | `https://xxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase anonymous/public key | `eyJhbG...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) | `eyJhbG...` |

Create a Supabase project at [supabase.com](https://supabase.com). After creation, run the SQL migrations in the SQL Editor:

1. `supabase/migrations/20260712000000_initial_schema.sql`
2. `supabase/migrations/20260713000000_sms_logs.sql`
3. `supabase/migrations/20260713000001_otp_and_sessions.sql`

### Monime Payments

| Variable | Description | Example |
|----------|-------------|---------|
| `MONIME_ACCESS_TOKEN` | Monime API access token | `mon_test_xxx` |
| `MONIME_SPACE_ID` | Monime space ID | `spc-xxxx` |
| `MONIME_WEBHOOK_SECRET` | Monime webhook HMAC secret | `whsec_xxx` |

Set up a Monime account at [monime.io](https://monime.io). Create a checkout session webhook pointing to `https://your-domain.vercel.app/api/payments/webhook`.

### Africa's Talking SMS

| Variable | Description | Example |
|----------|-------------|---------|
| `AT_API_KEY` | Africa's Talking API key | `xxxx` |
| `AT_USERNAME` | Africa's Talking username | `sandbox` |
| `AT_SENDER_ID` | SMS sender ID (optional) | `SaloneTransit` |
| `AT_SANDBOX` | Use sandbox mode (`true`/`false`) | `true` |

Sign up at [africastalking.com](https://africastalking.com). Request a sender ID at least 2 weeks before launch.

### Application

| Variable | Description | Example |
|----------|-------------|---------|
| `APP_URL` | Public-facing app URL (no trailing slash) | `https://salone-transit.vercel.app` |
| `SESSION_SECRET` | Random string for HMAC session tokens (min 32 chars) | `openssl rand -hex 32` |
| `CRON_SECRET` | Random string for cron job Bearer auth | `openssl rand -hex 32` |

### Seed Data (Required for Pilot)

Before first use, insert an admin user and agent user via the Supabase SQL Editor:

```sql
-- Insert admin user
INSERT INTO users (id, phone, name, role)
VALUES ('admin-user-1', '+23277000000', 'Admin User', 'admin')
ON CONFLICT (phone) DO NOTHING;

-- Insert agent user
INSERT INTO users (id, phone, name, role)
VALUES ('agent-user-1', '+23276123456', 'Agent One', 'agent')
ON CONFLICT (phone) DO NOTHING;

-- Insert agent profile
INSERT INTO agents (id, user_id, station_location, commission_rate)
VALUES ('agent-1', 'agent-user-1', 'Freetown Central', 5)
ON CONFLICT DO NOTHING;

-- Insert pilot route
INSERT INTO routes (id, origin, destination, price_per_seat, active)
VALUES ('freetown-bo', 'Freetown', 'Bo', 150000, true)
ON CONFLICT (id) DO NOTHING;

-- Insert pilot waves
INSERT INTO waves (id, route_id, departure_label, capacity_estimate, active)
VALUES
  ('wave-1', 'freetown-bo', '06:00 AM', 45, true),
  ('wave-2', 'freetown-bo', '08:30 AM', 45, true),
  ('wave-3', 'freetown-bo', '12:00 PM', 30, true),
  ('wave-4', 'freetown-bo', '03:00 PM', 45, true)
ON CONFLICT (id) DO NOTHING;
```

## Vercel Deployment

1. Push to GitHub
2. Import project in Vercel dashboard
3. Set all environment variables above
4. Deploy

The cron job (`/api/cron/send-reminders`) runs automatically every 15 minutes via Vercel's Cron Jobs (configured in `vercel.json`). It sends departure reminder SMS to passengers 5–60 minutes before their bus departs.

## Post-Deployment Checklist

- [ ] Run SQL migrations in Supabase
- [ ] Seed admin + agent users
- [ ] Set Monime webhook URL to `https://your-domain.vercel.app/api/payments/webhook`
- [ ] Switch `AT_SANDBOX` to `false` for production
- [ ] Verify `SESSION_SECRET` and `CRON_SECRET` are unique random strings
- [ ] Test full booking flow end-to-end
- [ ] Test agent login and ticket verification
- [ ] Verify cron job runs (check Vercel Logs)
