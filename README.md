# Salone Transit

Inter-city bus booking platform for Sierra Leone. Freetown → Bo pilot route.

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Payments**: Monime (mobile money)
- **SMS**: Africa's Talking
- **Testing**: Vitest

## Prerequisites

- Node.js 18+
- npm
- Supabase account (free tier works)
- Monime sandbox account
- Africa's Talking sandbox account

## Local Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd salone-transit
npm install
```

### 2. Environment variables

```bash
cp .env.example .env.local
```

Fill in the values (see [DEPLOYMENT.md](DEPLOYMENT.md) for details on each variable).

### 3. Supabase local dev (optional but recommended)

You can use Supabase's hosted project or run locally with Docker:

```bash
# Install Supabase CLI
npm i -g supabase

# Start local Supabase
supabase start

# Run migrations
supabase db reset
```

This gives you a local Postgres + PostgREST + Studio at `http://localhost:54321`.

If using hosted Supabase, paste the SQL migrations into the SQL Editor instead.

### 4. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Seed pilot data

Log into Supabase (Studio or dashboard) and run the seed SQL from [DEPLOYMENT.md](DEPLOYMENT.md) to create the admin user, agent user, pilot route, and waves.

## Testing

```bash
npm test          # Run all tests
npm run test:watch  # Watch mode
```

Tests mock Supabase, Monime, and Africa's Talking — no external services needed.

## Project Structure

```
app/
  book/                    # Passenger booking flow
    [routeId]/             # Booking form
    confirm/[bookingId]/   # Confirmation page
    pay/[bookingId]/       # Payment page
  agent/
    login/                 # Agent OTP login
    verify/                # Ticket verification (PWA)
  admin/
    page.tsx               # Dashboard overview
    bookings/              # Bookings table with filters
    routes/                # Routes CRUD
    waves/                 # Waves CRUD
    agents/                # Agent management
  api/
    payments/              # Monime integration
    agent/                 # Agent auth + verification
    admin/                 # Admin APIs
    cron/                  # SMS reminder scheduler
lib/
  supabase.ts              # Lazy Supabase client
  monime.ts                # Monime API helpers
  sms.ts                   # Africa's Talking SMS
  auth.ts                  # OTP + session tokens
  logger.ts                # Structured JSON logging
  rate-limit.ts            # In-memory rate limiter
  pilot-data.ts            # Hardcoded pilot route/waves
```

## Key Design Decisions

- **Lazy Supabase client**: Uses `Proxy` to defer `createClient()` until first property access, preventing build-time crashes
- **Custom OTP auth**: Avoids Supabase Auth + Twilio setup; simpler for pilot
- **Hosted Monime checkout**: Redirects to Monime's payment page; webhook handles confirmation
- **Offline agent verification**: localStorage queue with auto-sync on reconnect
- **Structured JSON logging**: All errors/info logged as JSON for Vercel log stream visibility

## Monime Sandbox Setup

1. Sign up at [monime.io](https://monime.io)
2. Get your access token and space ID from the dashboard
3. Create a webhook endpoint pointing to `http://localhost:3000/api/payments/webhook` (use [ngrok](https://ngrok.com) for local dev)
4. Set the webhook secret in your env vars
5. Use sandbox test phone numbers for mobile money payments

## Africa's Talking Sandbox Setup

1. Sign up at [africastalking.com](https://africastalking.com)
2. Get your API key from the dashboard
3. Set `AT_SANDBOX=true` and `AT_USERNAME=sandbox`
4. Use sandbox test phone numbers (format: `+232XXXXXXXX`)

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for full deployment instructions.
