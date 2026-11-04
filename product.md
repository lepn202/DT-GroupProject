# Product

What we are building and for whom. The research behind it is in [`evidence.md`](evidence.md), and how it is built is in [`architecture.md`](architecture.md).

## 1. One-liner

**AI-first building operations for rental housing.** The building detects problems itself, and tenants report in seconds with a photo, video or voice memo. AI handles classification, quick fixes, technician scheduling and landlord updates. Everything runs on one central platform instead of WhatsApp, email and phone.

> **Core claim:** the building files the ticket before the tenant has to.

## 2. Problem

### Landlord / property manager side

- **Fragmented reports.** Reports arrive through WhatsApp, Messenger, email and phone. Nothing is streamlined, and nothing is tracked.
- **Confusion.** Tenants repeat themselves, the landlord loses the thread, and problems fall through the cracks.
- **It compounds** across tenants, buildings and locations. Managing turns into chasing.
- **Problems grow in cost.** A €5 issue today is a €100 issue in two days.
- **The real cost is time:** gathering scattered information and keeping track of locations and repairs, instead of managing the portfolio.
- **Good tenants leave when they're unhappy.** Finding a reliable tenant who won't damage the place is hard, so landlords want to keep the good ones, sometimes even by not raising the rent. That's why making tenants feel safe and looked after in their apartment is high on a landlord's priority list.

### Tenant side

- **A problem hits daily life immediately.** The apartment is the most important and safest place a person has. No answer within hours means frustration.
- **The black box:** tenants wait forever for an email reply, have no idea when someone is coming, and get no update when something happens.
- **Reporting early is cheapest, but the process gets in the way.** Tenants still get hurt financially when the fix is slow.
- **Scheduling happens on the landlord's terms.** The landlord says "I'll schedule something next week, be ready". The tenant would rather say "I'm home at these times" and have a technician matched.

> This is not an agency problem. It is a structure problem.

## 3. Target user

| Role | Who | Relationship to the product |
|---|---|---|
| **Buyer** | Mid-market property managers and landlords with roughly **30–100 units** (upper end: around 50 houses with 15–20 apartments each) | Big enough to feel the fragmentation, small enough to still care about individual tenants |
| **Daily users** | Landlord / property manager, and tenants | Dashboard (landlord), app (tenant) |
| **External partner** | Technicians | Part of the workflow through a technician pool. Not full platform users |

**Pricing model:** the landlord buys the licence and provides the app to their tenants.

**Not in focus:**
- Institutional owners (Vanguard or BlackRock scale), who already run internal ticket systems.
- Student housing operators (e.g. in the UK), who already monitor dorms with sensors.

### Persona

**Markus, a property manager with 60 flats across Berlin,**
**wants to** resolve tenant issues quickly,
**because** satisfied tenants renew their leases and good tenants are hard to replace,
**but** requests arrive scattered across WhatsApp, email and calls, so small problems get lost and become costly.

| | |
|---|---|
| **Role** | Property manager / landlord, mid-market portfolio (30–100 units), the buyer of the product |
| **Situation** | Handles repairs across several buildings himself and calls external technicians when needed. Would put his trusted technicians into the pool and likely start in Manual mode, moving to Automatic once he trusts the AI's bookings |
| **Need** | One clear overview of what's open, what's urgent and what's overdue; tenants who feel looked after and stay |
| **Friction** | Fragmented requests, no prioritisation, learns about problems late, spends his time chasing information instead of managing |
| **Linked insights** | KI-7, KI-8, KI-9, KI-10, KI-11, KI-12 (landlord side); KI-3, KI-5 (tenant side, as the cause of churn), see [`evidence.md`](evidence.md) |

## 4. Solution

**Two inputs, one engine.**

- **System reports:** IoT sensors flag anomalies. These can be temperature, humidity, water-leak, smart radiator-valve and window-contact sensors, or existing Siemens-style building data on heating and water pipes. The tenant confirms or dismisses each alert before anything happens.
- **Tenant reports:** the tenant notices first and reports with a photo, video, voice memo or short description. No forms.

Both go into the **AI classifier**, which decides the issue type, urgency and next step. The AI then does one of two things:
- sends a **quick fix** back to the tenant through the chatbot, or
- **schedules a technician** from the pool around the tenant's availability, informs affected roommates and neighbours, and contacts the right maintenance provider.

The landlord sees everything on **one dashboard** and is only pulled in when they choose to be.

**The person living in the flat is the main sensor.** They know the place best and notice problems first. Hardware sensors add early warning and, over time, prediction of patterns across buildings.

### Why now

- **LLMs** make unstructured input (a voice memo, a blurry photo, a two-line text) usable as structured ticket data.
- **Cheap IoT sensors**, and in some buildings existing Siemens-style data points on heating and water that can be used directly.
- **A possible regulatory push in Germany** towards smart buildings over the next few years. *(Raised in discussion; needs verification.)*

## 5. Core workflow

```
Issue
 ├── System report (IoT) ──► Tenant confirms (yes / no / add photo) ──┐
 └── Tenant report ──► Add photo / video / voice / text ──────────────┤
                                                                      ▼
                                                               AI classifier
                                                        (issue, urgency, next step)
                                                      ┌─────────┴──────────┐
                                             Chatbot quick fix        Scheduling
                                             (back to tenant)      (inform roommates)
                                                                          │
                                                                 Contact maintenance
                                                                          │
                                                                          ▼
                                                     Landlord / maintenance dashboard
                                            (classifier and scheduling also feed in)
```

### Step by step

| Step | Who | What happens | Output |
|---|---|---|---|
| 1a. System report | Sensor | Anomaly detected in heating, water supply or similar | Draft alert |
| 1b. Tenant confirms | Tenant | Push notification: "Are you experiencing this?" **Yes / No / Add photo**. "No" cancels the request, "Yes" moves it forward | Confirmed alert or cancelled request |
| 2a. Tenant report | Tenant | Opens the app and records a voice memo, photo, video or text | Raw report |
| 3. AI classifier | AI | Assigns issue type, urgency and next step. Scraped paint is low priority; leaking water on the fifth floor is high | Ticket |
| 4a. Quick fix | AI chatbot | For a minor issue, sends a step-by-step guide for fixing it | Ticket resolved or escalated |
| 4b. Scheduling | AI | If a technician is needed, the tenant enters their availability in the app. The AI matches it against the technician pool and books a slot. Affected roommates and neighbours are informed | Booked slot |
| 5. Contact maintenance | AI | Sends the ticket with media, location and slot to the technician by email or message | Technician dispatched |
| 6. Dashboard | Landlord | Monitors everything live: buildings, problems, status, KPIs | Overview |
| 7. Resolution | Technician, tenant | The problem is fixed, the ticket closes and appears in the tenant's history | Closed ticket |

### Examples

- **System path:** a sensor sees Flat 4B at 15 °C for 6 hours with the radiator on. The AI flags a likely faulty valve. The tenant gets a push notification: "Is your room cold? Confirm or add a photo." The tenant confirms. The AI creates the ticket, books a heating technician and tells the tenant the slot. The landlord sees it on the dashboard with its priority and status. If six flats on floor 2 show the same pattern, they become **one boiler ticket, not six**.
- **System path, neighbours:** a pipe breaks on the second floor and that tenant reports it. The tenant on the first floor is notified automatically, before water comes down the wall.
- **Tenant path, high priority:** a tenant films a dripping pipe under the sink and sends a voice memo. The AI classifies it as a high-priority water leak. The tenant enters when they're home, the AI books a plumber from the pool, and the landlord is informed.
- **Tenant path, low priority:** a tenant sends a photo of scraped paint. The AI classifies it as cosmetic and low priority. It replies through the chatbot with a quick fix, or logs it for the next planned visit. Nothing reaches the landlord's urgent queue.
- **Tenant says no to a sensor alert:** the request is cancelled, and nothing reaches the landlord.

## 6. Scope

### In scope (MVP)

- Onboarding: landlord account, portfolio, tenant invites
- Tenant self-reporting end to end: photo, video, voice memo, text description
- Simulated sensor alerts with the tenant confirmation step
- AI classifier: issue type, urgency, next step
- Chatbot quick fix for minor issues
- Scheduling: tenant availability matched to the technician pool and booked automatically
- Notifications to affected roommates and neighbours
- Landlord broadcast messages to a building
- Landlord dashboard: portfolio list, per-building problem view, KPIs, ticket detail
- Due times per urgency (target time for each ticket, overdue tickets flagged on the dashboard)
- Appointment reminders with tenant replies ("I'll be home" / "Someone else will let them in" / "Reschedule")
- Visit outcomes (completed / needs follow-up / no access), with automatic re-booking

### Issue types in the MVP

| Category | Examples | Sensor-detectable |
|---|---|---|
| Water | Leaks, no hot water | Yes |
| Heating | Cold rooms, faulty valve, boiler | Yes |
| Mould | Damp walls | Yes (humidity) |
| Electricity | Outlets, lights, gas if applicable | Partly |
| Small defects | Doors, hinges, windows not sealing | Partly |

### Out of scope (for now)

- Real sensor hardware and integrations (simulated only)
- Shared-space issues such as rubbish in common areas (raised, parked)
- A technician-side app or technician accounts. Technicians get booking emails with a private link to one page where they set their availability and update the job (confirmed / running late / on site / done)
- Payments and invoicing
- Rent and contracts
- Cross-building ML prediction (vision, not MVP)

> **MVP focus:** simulate the sensors, build the tenant self-reporting flow end to end, and build the landlord dashboard.

## 7. Onboarding

1. The landlord buys the licence and creates the main account.
2. The landlord registers their properties. The **portfolio** is the top-level object.
3. For each property, the landlord generates an **invite link or code** for tenants.
4. The tenant opens the link and creates a normal account: email, phone number and password.
5. The account ties the tenant to a **specific apartment in a specific building**. Reports and sensor alerts are then located automatically, and building-wide notifications reach the right people.

## 8. Tenant app

Mobile-first (phone format). Simple, not complicated.

**Bottom navigation:** Home · Add ticket · History · Profile · Messages

### Home

| Element | Description |
|---|---|
| Landlord broadcast | Pinned message at the top from the landlord to all tenants in the building. Example: "Heating offline for the next three days, we're replacing the system." |
| Building-wide issues | Status bar for problems that affect the whole building (e.g. all pipes being replaced), showing which stage they're at |
| My tickets | The tenant's own apartment issues, each with a progress indicator |
| Quick add | Camera / record button to start a new ticket straight from Home |

**Ticket progress indicator** (four stages):

1. Repair logged in the ticket system
2. Technician appointment booked
3. Fix in progress
4. Resolved

### Add ticket

- Three big actions: **take photo**, **record video**, **record voice memo**. A text description is optional.
- No form fields. The AI extracts category, location and urgency from the media.
- A confirmation shows on upload ("Received, we're on it"). The ticket appears in Home and History immediately.
- If the AI classifies the issue as minor, the tenant gets a chatbot reply with a quick fix instead of a technician.
- If a technician is needed, the tenant is asked for their availability (free slots) right after submitting.

### History

- All past tickets with status, date, media and outcome.
- Confirmed and dismissed sensor alerts.

### Profile

- Personal details and password.
- The apartment and building the account is linked to.

### Messages

- Messages from the landlord (broadcasts and direct messages).
- Messages from technicians (confirmation, running late, done).
- The chatbot for minor problems: "Why is my room cold?", quick-fix guides, status questions.

## 9. Landlord dashboard

**Problem-first, not tenant-first.** The landlord opens the dashboard to see what needs fixing and what stage it's at, not who submitted it. Names and phone numbers are secondary and live in the ticket detail.

### Screen 1: Portfolio

- The first screen after login: a list of all buildings (e.g. "Alexanderplatz 1", address, number of units).
- Each row shows a brief status: open tickets and completed tickets.
- With 50 buildings and 400 open issues, the list stays a short overview. The detail lives one level down.
- **Custom problem bar:** the landlord chooses which statistics appear here, e.g. to flag the one building out of 50 with disproportionately many problems.
- **Add message to building:** broadcast a message to all tenants of a selected property from here.

### Screen 2: Building view

- **KPIs at the top:** open vs. resolved tickets, and possibly time to resolve, costs and technician visits. Configurable.
- **Problem list**, ranked by urgency. Each row shows the issue name (e.g. "Water leak", "Heating"), its status stage and an urgency marker. A pipeline view of tickets by stage could sit at the top.
- **Master message bar** at the bottom: send a message to everyone in this building. This is the broadcast the tenant sees pinned on their Home screen.
- The tenants living there are visible, but they're not the main view.

### Screen 3: Ticket detail

- Media (photo, video, voice memo transcript)
- Issue classification and urgency
- Who reported it: apartment number, name, contact
- Technician and appointment (e.g. "12.11, technician X")
- Progress (e.g. "40% complete") and a timeline of status changes
- Messages on this ticket

### Modes

| Mode | Behaviour |
|---|---|
| **Automatic** (default) | The AI books technicians and informs tenants. The landlord only monitors |
| **Manual** (optional) | The landlord sees every scheduling request and confirms each one before it goes out |

## 10. Scheduling and technician pool

- The tenant enters their availability in the app once the classifier decides a technician is needed.
- The platform holds a **technician pool**. Technicians set their own availability directly.
- The AI matches the tenant's availability against the pool and **books the earliest fit**. It then sends the technician the ticket by email or message, with media, location and slot.
- **The landlord is not in the loop by default.** This was debated. One view: landlords always call the technician today and should keep control. The other: the tenant knows when they're home, so the AI should match directly. **Decision:** automatic by default, with manual mode available.
- **Open question:** do portfolio landlords bring their own technicians into the pool, or is there one pool shared across landlords? It probably depends on the landlord.

## 11. AI classifier spec (MVP)

**Input:** tenant media (transcribed voice, described image or video, text) or a sensor event (flat, metric, duration, state).

**Output:** one ticket object.

```
issue_type:      water | heating | mould | electricity | defect | other
location:        building, apartment, room (if given)
scope:           apartment | building
urgency:         emergency | high | medium | low
next_step:       quick_fix | schedule_technician | inform_landlord | dismiss
trade:           plumber | heating | electrician | handyman | none
quick_fix_text:  only if next_step = quick_fix
related_tickets: open tickets in the same building with a matching pattern
summary:         one sentence for the dashboard
```

`scope: building` is what turns a ticket into a building-wide status bar on every tenant's Home screen.

## 12. Data model (MVP)

| Entity | Fields |
|---|---|
| Landlord | id, account, licence |
| Building | id, landlord, address, units, invite code |
| Unit | id, building, floor, number |
| Tenant | id, unit, email, phone |
| Technician | id, trade, availability slots, contact |
| SensorEvent | id, unit, metric, value, duration, timestamp (simulated) |
| Report | id, unit, source (`tenant` / `sensor`), media, transcript, timestamp |
| Ticket | id, report ids, classifier output, status (`logged` / `confirmed` / `quick_fix` / `booked` / `in_progress` / `resolved` / `dismissed`), technician, slot, progress |
| Message | id, ticket or building, from (`ai` / `tenant` / `landlord` / `technician`), text, timestamp |
| Broadcast | id, building, landlord, text, timestamp |

## 13. Success metrics

| For | Metric |
|---|---|
| **Tenant** (main KPI) | Time from the issue occurring to the issue being fixed. Shrink it as far as possible |
| **Landlord** | Time and money saved on managing repairs. Longer tenant retention (good tenants staying past their lease) |

Both appear in the dashboard KPI bar.

## 14. Demo script

1. The landlord logs in, sees the portfolio list and opens "Alexanderplatz 1".
2. Switch to the tenant app. Home shows a pinned landlord broadcast and an empty ticket list.
3. The tenant records a short voice memo: *"The pipe under my kitchen sink is dripping, there's water on the floor."*
4. Upload confirmation. Classifier output: `water`, `high`, `plumber`, `schedule_technician`.
5. The tenant enters their availability. The AI books a plumber from the pool, and the ticket moves to "appointment booked".
6. Landlord dashboard: a new high-priority ticket appears in the building view, and the KPI bar updates.
7. Fire a simulated sensor event: Flat 4B, 15 °C for 6 h, radiator on.
8. Tenant 4B receives the confirmation prompt and taps "Yes".
9. The dashboard shows the second ticket, heating, with a booked slot.
10. Fire the same event for 4A, 4C and 4D. The dashboard merges them into one building-wide boiler ticket, and every tenant's Home screen now shows the building status bar.
11. The landlord uses the master message bar: *"Heating technician coming Thursday."* It appears pinned in the tenant app.

## 15. Open questions and risks

- Own technicians vs. a shared pool per landlord?
- Who pays for sensors upfront?
- Data privacy for in-flat sensors and account tracking (GDPR/DSGVO, tenant consent).
- False positives from sensors spamming tenants with confirmation requests.
- German smart-building regulation: a real tailwind or not? Needs verification.
- What do institutional players and student housing operators already run internally?
- Technician adoption: will local tradespeople (Handwerker) set their availability in a platform pool?

## 16. Vision beyond the MVP

Buildings learn from each other. Patterns from one property predict failures in another and prevent costs before they arise. The platform starts as the **single inbox for building problems** and becomes the **operating system for the building**.
