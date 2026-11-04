# Fixa: building operations MVP

AI-first building operations for rental housing. What we build and why: [`product.md`](product.md). How: [`architecture.md`](architecture.md). Research: [`evidence.md`](evidence.md). Design: [`design/design-system.md`](design/design-system.md).

This is the MVP web app: Next.js 16 (App Router) + Supabase, one codebase with two faces: the tenant app (`/app`, mobile-first) and the landlord dashboard (`/dashboard`).

## Run it locally

Needs Node 22+ and Docker.

```bash
npm install
npx supabase start          # local Postgres, Auth, Storage, Realtime in Docker
npx supabase db reset       # applies supabase/migrations and supabase/seed.sql
cp .env.example .env.local  # local Supabase keys are pre-filled
npm run dev
```

Open http://localhost:3000. Every demo account uses the password `demo-password`:

| Who | Email | Where |
|---|---|---|
| Landlord (Markus) | `markus@demo.test` | 3 buildings, history tickets |
| Tenant (Mara) | `mara@demo.test` | Alexanderplatz 1, flat 4B, starts with no tickets |
| Other tenants | `jonas@`, `lea@`, `emre@` (4A, 4C, 4D), `sofia@` (2B), `paul@` (1B), `nina@` (Kastanienallee 12, 2A) | `@demo.test` |

Tenant invite links: `/join/ALEX0001` (Alexanderplatz 1), `/join/KAST0012`, `/join/BOXH0040`.

### AI keys

Set in `.env.local` (server only):

- `TYPESAFE_API_KEY`: Jev answers the classifier's fixed-choice fields.
- `ANTHROPIC_API_KEY`: Claude writes summaries and quick-fix text, and classifies when Jev is unsure (confidence < 0.8).

Both are optional. Without them the classifier falls back to keyword rules (`lib/ai/rules.ts`) so the demo still runs, and tickets show `by rules`. Every call is logged in the `ai_calls` table.

## What's built (architecture §12, steps 1–7)

1. **Setup:** schema + RLS (`supabase/migrations`), seed data, landlord sign-up, buildings and units, invite link and code, tenant sign-up tied to a flat.
2. **Tenant app:** bottom nav (Home · Add · History · Profile · Messages); Add ticket with photo (resized to ≤ 1568 px), video (≤ 30 s, 4 frames extracted in the browser), voice memo (Web Speech API, `en-GB`, transcript only) and text; "Received, we're on it"; Home with pinned broadcast, building-wide status bars, my tickets with the 4-stage tracker; History; Profile; ticket threads.
3. **Classifier:** safety floor (gas/smoke/sparks/leak sensor → emergency, plus "leave the flat, call 112") → Jev → Claude → "needs triage"; next-step handling (quick fix with "Fixed it" / "Didn't work", dismiss, schedule technician, inform landlord); due times from urgency; live updates over Supabase Realtime.
4. **Dashboard:** Portfolio with a configurable problem bar and "above average" building flag; building view with KPI bar, pipeline, problem list ranked by urgency then due time, tenants, master message bar; ticket detail with media, transcript, editable classification, reporter, timeline and message thread; Dismiss → Archive (filter by building and issue type); Settings (mode, due times, problem bar).

5. **Sensors and grouping:** demo panel (`/demo`) with the five presets; "Your building noticed something" card on Home with **Yes / No / Add photo**; leaks create an emergency ticket at once and keep the prompt pinned; reports the classifier links to an open ticket join it; 3+ flats with a heating event within an hour (one confirmed) become one building-wide ticket, whose status bar shows on every tenant's Home; the flat below a water ticket is warned.
6. **Scheduling:** tenant availability picker (2-hour windows, next 7 days, dashed before the due time); earliest overlap with the landlord's own technicians first, then the shared pool; automatic mode books, manual mode proposes and the landlord confirms; emergency **Book now** on the ticket detail; Technicians page (`/dashboard/technicians`); technician link page (`/t/[token]`, no login) with jobs, availability and Confirmed / Running late / On site / Done; booking emails and roommate notices.
7. **Visits and chatbot:** reminders the evening before and an hour before, with "I'll be home" / "Someone else will let them in" / "Reschedule"; visit outcomes (completed, needs follow-up, no access) with re-booking; **Ask Fixa** chatbot in Messages (quick fixes from the building's guides, "why is my room cold?", status answers, "it worked" / "didn't work" closes or escalates a quick fix).

**Not yet:** Web Push to the phone (notifications are in-app and email only), real sensor hardware.

## Demo walk-through (product.md §14)

Sign in as `markus@demo.test` in one window and `mara@demo.test` in another (a phone-sized window works best).

1. Mara: **Add** → a photo or "The pipe under my kitchen sink is dripping" → pick a few times → a plumber is booked.
2. Markus: **Demo panel** → Alexanderplatz 1, flat 4B, *Cold room* → Mara taps **Yes** and picks times.
3. Demo panel → flat 4A, *Boiler failure* → the dashboard shows one building-wide heating ticket; every tenant on floor 4 sees the status bar.
4. Demo panel → flat 2B, *Leak* → emergency alert on the dashboard, 1B is warned → open the ticket → **Book now**.
5. Open the technician's link (Technicians page, or the outbox on the demo panel) → **On site** → **Done**.
6. Demo panel → **Send reminders** → Mara answers on her ticket. **Ask Fixa** answers status questions.

### Notifications and email

In-app notices appear on Home (tenants) and as alerts above the dashboard (landlords). Emails go out through [Resend](https://resend.com) when `RESEND_API_KEY` is set; either way every email is logged in `notifications` and listed in the demo panel's **Outbox**. `APP_URL` is used for links in emails.

### Hosted Supabase + Vercel

1. Apply the migrations to the hosted project: `npx supabase link --project-ref YOUR_REF`, then `npx supabase db push`. (Skip `seed.sql` unless you want the demo data there.)
2. In Vercel, set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Project Settings → API), plus the optional keys above.
3. In Supabase → **Authentication → URL Configuration**, set **Site URL** to your Vercel URL (e.g. `https://your-app.vercel.app`) and add `https://your-app.vercel.app/**` to **Redirect URLs**. Without this, the link in the confirmation email points at `localhost:3000`.

Hosted Supabase asks new accounts to confirm their email. The landlord or tenant record is created by a database trigger at sign-up, so it's there once they confirm; the email link lands on `/auth/confirm` and signs them in. An account that is signed in but has no record (e.g. created before this fix) is sent to `/welcome` to finish setting up as a landlord.

### Appointment reminders

`/api/cron/reminders` sends due reminders. It needs `Authorization: Bearer $CRON_SECRET`. On Supabase, schedule it every 15 minutes with pg_cron and pg_net (SQL editor, once per project):

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('fixa-reminders', '*/15 * * * *', $$
  select net.http_post(
    url := 'https://YOUR-APP.vercel.app/api/cron/reminders',
    headers := '{"Authorization": "Bearer YOUR_CRON_SECRET"}'::jsonb
  );
$$);
```

Locally, use **Send reminders** on the demo panel instead.

## Layout

```
app/              routes: /login, /signup, /join/[code], /app/*, /dashboard/*, /demo, /t/[token], /api/cron/reminders
components/       UI primitives and ticket components (urgency badge, stage chip, due tag, tracker)
lib/ai/           safety rules, Jev, Claude, keyword fallback, routing (classify.ts)
lib/actions/      server actions (auth, tenant, landlord, technician)
lib/tickets.ts    ticket creation and the classify → next-step pipeline
lib/sensors.ts    simulated sensor presets, tenant confirmation
lib/grouping.ts   related reports, building-wide merge, flat-below warning
lib/scheduling.ts matching (custom technicians, then pool), booking, rescheduling
lib/reminders.ts  appointment reminders (called by /api/cron/reminders)
lib/notify.ts     in-app notices and email (Resend), all logged in `notifications`
lib/ai/chatbot.ts the Messages chatbot (Claude with tools, keyword fallback)
proxy.ts          Supabase session refresh, protects /app and /dashboard
supabase/         migrations (schema, RLS, storage, realtime) and seed.sql
```
