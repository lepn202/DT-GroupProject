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

## What's built (architecture §12, steps 1–4)

1. **Setup:** schema + RLS (`supabase/migrations`), seed data, landlord sign-up, buildings and units, invite link and code, tenant sign-up tied to a flat.
2. **Tenant app:** bottom nav (Home · Add · History · Profile · Messages); Add ticket with photo (resized to ≤ 1568 px), video (≤ 30 s, 4 frames extracted in the browser), voice memo (Web Speech API, `en-GB`, transcript only) and text; "Received, we're on it"; Home with pinned broadcast, building-wide status bars, my tickets with the 4-stage tracker; History; Profile; ticket threads.
3. **Classifier:** safety floor (gas/smoke/sparks/leak sensor → emergency, plus "leave the flat, call 112") → Jev → Claude → "needs triage"; next-step handling (quick fix with "Fixed it" / "Didn't work", dismiss, schedule technician, inform landlord); due times from urgency; live updates over Supabase Realtime.
4. **Dashboard:** Portfolio with a configurable problem bar and "above average" building flag; building view with KPI bar, pipeline, problem list ranked by urgency then due time, tenants, master message bar; ticket detail with media, transcript, editable classification, reporter, timeline and message thread; Dismiss → Archive (filter by building and issue type); Settings (mode, due times, problem bar).

**Not yet (steps 5–7):** demo sensor panel and tenant confirmation, building-wide grouping and neighbour notices, tenant availability and technician booking (incl. emergency **Book now**), technician link pages and emails, reminders, visit outcomes, the chatbot. The tables for these already exist.

## Layout

```
app/              routes: /login, /signup, /join/[code], /app/*, /dashboard/*
components/       UI primitives and ticket components (urgency badge, stage chip, due tag, tracker)
lib/ai/           safety rules, Jev, Claude, keyword fallback, routing (classify.ts)
lib/actions/      server actions (auth, tenant, landlord)
lib/tickets.ts    ticket creation and the classify → next-step pipeline
proxy.ts          Supabase session refresh, protects /app and /dashboard
supabase/         migrations (schema, RLS, storage, realtime) and seed.sql
```
