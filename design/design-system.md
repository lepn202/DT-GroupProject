# Design System (draft v0.1)

The draft design system for the web app MVP, based on [`product.md`](../product.md), [`evidence.md`](../evidence.md) and [`architecture.md`](../architecture.md).

- **Live canvas:** https://claude.ai/artifact/G4s13ZDLqh3WqTkvPCKtMx (private until shared from its Share menu)
- **Source files:** [`canvas/`](canvas/). These are the canvas's artboards (`*.dc.html`) and layout (`canvas.json`). They need the canvas editor's runtime (`support.js`) and won't render if opened on their own. Use them as a reference, or open the canvas link.

| Artboard | Contents |
|---|---|
| `Main.dc.html` | Foundations: principles, colour, type, spacing, radius, elevation, icons |
| `Components.dc.html` | Core and product-specific components |
| `TenantHome.dc.html` | Tenant app, Home (390 × 844) |
| `TenantReport.dc.html` | Tenant app, Add ticket (390 × 844) |
| `Dashboard.dc.html` | Landlord dashboard, building view (fluid page) |

## Principles

| # | Principle | From |
|---|---|---|
| 01 | **Acknowledge instantly.** Every submission gets "Received, we're on it" | Evidence Issue 3 |
| 02 | **Always show the stage.** The four-stage tracker appears wherever a ticket does | Issues 3, 4 |
| 03 | **Ask, so they don't have to complain.** The system asks first, one tap to confirm, no forms | Issue 6 |
| 04 | **Problem-first for landlords.** Issue, urgency and due time lead; names live in the ticket detail | Product §9 |
| 05 | **Urgency is never colour alone.** Label + icon shape + hue of distinct lightness | Issue 12 |
| 06 | **One problem, one ticket.** Building-wide issues get their own status bar | Issue 5 |

## Tokens

Named to match Tailwind + shadcn/ui CSS variables.

### Colour

| Token | Value | Notes |
|---|---|---|
| `background` | `#F6F6F2` | App ground |
| `card` | `#FFFFFF` | Surfaces |
| `muted` | `#EDEDE6` | Subtle fills, assistant chat bubbles |
| `border` | `#DADAD2` | |
| `muted-foreground` | `#4E5A55` | Secondary text, 6.8:1 on background |
| `foreground` | `#16201C` | Primary text, 16:1 |
| `primary` | `#0E5E4E` | Actions, active nav, resolved stage. Hover `#0A4A3D` |
| `primary-soft` | `#DCEFE9` | Broadcast banner, selected slots, active sidebar item |

**Urgency** (classifier `urgency`), as a strong colour / tint / text-on-tint triple:

| Level | Strong | Tint | Text | Icon |
|---|---|---|---|---|
| Emergency | `#B42318` | `#FDE8E6` | `#9A1C12` | Filled warning triangle |
| High | `#C4570A` | `#FDEEDC` | `#8F3E06` | Double chevron up |
| Medium | `#E3B341` | `#FBF1D3` | `#6E5100` | Single chevron up |
| Low | `#B7BEC8` | `#EEF0F3` | `#475467` | Dash |

**Ticket stage** (tenant-facing, mapped from ticket status as in architecture §5.3):

| Stage | Statuses | Colour |
|---|---|---|
| 1 · Logged | `logged`, `confirmed`, `quick_fix` | Outline dot `#4E5A55` |
| 2 · Booked | `booked` | `#8FA8E8` (tint `#DCE6FB`) |
| 3 · In progress | `in_progress` | `#1F4FBF` |
| 4 · Resolved | `resolved` | `primary` |

Stages use blue/green so they never compete with urgency's red–amber range.

**Due time:** overdue = solid emergency red with uppercase label ("Overdue 3 h"); due soon = high-orange outline ("Due in 4 h"); otherwise mono date.

### Typography

Hanken Grotesk (UI) + IBM Plex Mono (IDs, times, data), via Google Fonts.

| Style | Size / line | Weight |
|---|---|---|
| Display | 40 / 44 | 700, −0.02em |
| Heading 1 | 28 / 34 | 700, −0.01em |
| Heading 2 | 20 / 28 | 600 |
| Body | 16 / 24 | 400 |
| Small | 14 / 20 | 400 |
| Label | 12 / 16 | 600, uppercase, 0.06em |
| Mono | 13 | 500 |

Tenant app body and inputs are at least 16 px (this stops iOS zooming into inputs). Dashboard tables may use 14 px.

### Space, radius, elevation

- **Spacing:** 4 px base: 4, 8, 12, 16, 24, 32, 48, 64.
- **Radius:** 6 inputs/chips · 12 cards · 16–20 sheets and media buttons · full pills.
- **Elevation:** 0 = 1 px border · 1 = `0 1px 2px rgba(22,32,28,.06), 0 4px 12px rgba(22,32,28,.08)` · 2 = `0 8px 28px rgba(22,32,28,.16)`.
- **Touch targets:** 44 px minimum height on every control.

### Icons

Lucide (ships with shadcn/ui), 1.75 px stroke, 20 px in UI, 24 px in the tenant bottom nav. Issue types: `droplet` water, `flame` heating, `cloud-drizzle` mould, `zap` electricity, `wrench` defect.

## Components

| Component | Used in | Key rules |
|---|---|---|
| Button (primary / secondary / ghost / destructive) | Everywhere | One primary per view, 44 px tall |
| Media action button | Add ticket | Photo is primary; video and voice memo are secondary |
| Urgency badge | Ticket cards, problem list | Pill, icon + label + tint |
| Stage chip | Problem list, pipeline | Dot + label |
| Due-time tag | Problem list | Overdue / due soon / date |
| Progress tracker | Ticket card, status bar, ticket detail | 4 segments, labels visible; dashboard shows 25/50/75/100 % |
| Acknowledgement toast | After upload | "Received, we're on it" |
| Landlord broadcast | Tenant Home (pinned) | `primary-soft` banner, megaphone icon |
| Building-wide status bar | Tenant Home | Issue + flats affected + stage + "No need to report it" |
| Sensor confirmation card | Tenant Home | Yes / No / Add photo; leaks use emergency badge and stay pinned |
| Availability slots | Ticket detail | 2 h windows; selected = tint + ring; dashed orange = before due time |
| Appointment reminder | Messages / push | I'll be home / Someone else will let them in / Reschedule |
| Message bubbles | Messages | AI always labelled "automated"; people get name + role |
| KPI tile | Dashboard | Main KPI first: time from issue to fix; overdue tile in red |
| Problem list row | Building view | Urgency → issue + flat → stage → appointment → due |
| Bottom navigation | Tenant app | Home · Add · History · Profile · Messages |
| Master message bar | Building view (bottom) | Broadcast to every tenant in the building |

## Open points

- Product name and logo (shown as `[PRODUCT NAME]`).
- KPI values are placeholders (`[N]`, `[X.X] d`). No real data yet.
- Dark mode, the ticket detail screen, the portfolio screen and the technician link page aren't designed yet.
