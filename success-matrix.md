# Success matrix

> The metrics that tell us whether the product solves the problems documented in [`evidence.md`](evidence.md): tenants (Issues 1–6) and landlords (Issues 7–12). Where each metric's data comes from in the system is in [`architecture.md` §10](architecture.md#10-measuring-success).
>
> **Baseline:** today's situation, taken from `evidence.md` where data exists. **Target:** our team's assumption for a successful pilot. These are hypotheses to validate, not facts.

---

# Part A: Tenants

Metrics follow the user flow: Detect → Report → Classify → Schedule → Resolve → Experience.

## North Star metric (tenant side)

**% of issues resolved within target time without the tenant having to chase.**

It combines the tenant's two biggest pains: slow repairs (Issue 2) and not knowing what's happening (Issue 3).

| Baseline | Target |
|---|---|
| Not measured today. Only ~49–72% of UK tenants are satisfied with repair time, and 55% of repair complaints are about waiting and not knowing. | ≥ 80% |

## 1. Detect: System reports → Tenant confirms

| # | Metric | Definition | Baseline | Target | Addresses |
|---|---|---|---|---|---|
| T1 | Proactive detection rate | % of sensor-detectable issues (heating, leaks, humidity) flagged by the system before the tenant reports them | ~0%: today, management is fully reactive | ≥ 50% | Issue 1, 6 |
| T2 | Tenant confirmation rate | % of sensor alerts the tenant answers (yes / no / photo) within 24 h | n/a (new feature) | ≥ 70% | Issue 1 |
| T3 | False alarm rate | % of sensor alerts the tenant marks as "no problem" | n/a | < 15% | Trust in system |
| T4 | Early mould prevention | % of high-humidity alerts resolved before visible mould appears | Mould is the #1 defect (39% DE, 37% UK damp) | ≥ 80% | Issue 1 |

## 2. Report: Tenant reports → Add details (photo, video, voice)

| # | Metric | Definition | Baseline | Target | Addresses |
|---|---|---|---|---|---|
| T5 | Time to report | Time from opening the app to a submitted report | Email or phone call with call waiting times and no call-back | < 60 seconds, no forms | Issue 3, 6 |
| T6 | Report completion rate | % of started reports that are submitted | n/a | ≥ 90% | Issue 6 |
| T7 | Media attachment rate | % of reports with a photo, video or voice memo | n/a | ≥ 80% | Issue 2 (right fix the first time) |

## 3. Classify: AI classifier → urgency, next steps, chatbot quick fix

| # | Metric | Definition | Baseline | Target | Addresses |
|---|---|---|---|---|---|
| T8 | Instant acknowledgement | % of reports that get a confirmation + urgency level + next step within 1 minute | Often no automatic response to email/web reports | 100% | Issue 3 |
| T9 | Classification accuracy | % of AI category/urgency labels not corrected by the tenant or landlord | n/a | ≥ 85% | Issue 2 |
| T10 | Chatbot quick-fix rate | % of reports solved through the chatbot's self-help (e.g. bleeding a radiator, resetting a fuse) with no technician visit | 0% (no such option) | 15–20% | Issue 2 |
| T11 | Quick-fix satisfaction | % of tenants who rate the chatbot's answer as helpful | n/a | ≥ 80% | Issue 3 |

## 4. Schedule: Scheduling → tell roommates → right trade

| # | Metric | Definition | Baseline | Target | Addresses |
|---|---|---|---|---|---|
| T12 | Time to confirmed appointment | Time from report to a confirmed technician slot | "Waiting for appointment" is the worst stage of the journey (sentiment 25/100) | Emergency < 4 h, non-emergency < 48 h | Issue 2, 3 |
| T13 | Missed appointment rate | % of appointments where the technician can't get in or doesn't show up | Up to 20% of appointments missed | < 5% | Issue 4 |
| T14 | Household notification rate | % of appointments where all roommates are notified | n/a | 100% | Issue 4 |
| T15 | Duplicate report rate | % of reports about an issue that is already open (e.g. building-wide heating) | Common: other tenants aren't told about communal repairs | < 5% (merged into one ticket) | Issue 5 |

## 5. Resolve: Maintenance → Dashboard

| # | Metric | Definition | Baseline | Target | Addresses |
|---|---|---|---|---|---|
| T16 | Median time to resolution | Time from report (or sensor detection) to closed ticket | ~41 days average (UK tenants); 13.1 days median (Hemlane) | < 7 days | Issue 2 |
| T17 | Never-fixed rate | % of reported issues still unresolved after 3 months | 18% never fixed; 22% wait > 6 months | < 2% | Issue 2 |
| T18 | First-time fix rate | % of repairs completed on the first visit | Around half of tenants in one UK survey felt their repair wasn't done right the first time | ≥ 80% | Issue 2, 4 |
| T19 | Chasing contacts per ticket | Number of "what's the status?" messages or calls from the tenant | Tenants "keep chasing via the call centre" | ≤ 0.2 per ticket | Issue 3 |

## 6. Experience: overall outcome for the tenant

| # | Metric | Definition | Baseline | Target | Addresses |
|---|---|---|---|---|---|
| T20 | Satisfaction with repair time | % satisfied with the time taken for their most recent repair (UK TSM question TP03) | 49–72% (UK councils) | ≥ 85% | Issue 2 |
| T21 | Feeling informed | % agreeing "I always knew the status of my request" | 55% of repair complaints are about waiting and not knowing | ≥ 90% | Issue 3 |
| T22 | Feeling valued | % agreeing "I feel valued as a tenant" | ~25% (Berlin 2026, not representative) | ≥ 60% | Issue 6 |
| T23 | Willingness to report | % who say they would report an issue they'd previously have ignored | ~13% don't complain for fear of eviction or rent increases | ≥ 90% would report | Issue 6 |

## What we can test with our prototype (build to learn)

The prototype uses no real sensors or data, so we can't measure T1, T4, T13 or T16 yet. They belong in a later pilot. In usability tests with fake data, we can measure:

| Risk (Cagan) | What we test | Metric |
|---|---|---|
| Usability | Can a tenant report an issue by photo or voice without help? | T5 (time to report), T6 (completion) |
| Usability | Does the tenant understand a sensor alert and know how to respond? | T2 (would they confirm?) |
| Value | Does the instant response + status view make tenants feel informed? | T8, T21 (ask after the test) |
| Value | Would tenants trust and use the chatbot quick fix? | T10, T11 (Wizard of Oz chatbot) |

**Test card example:**
We believe that tenants will report issues faster with photo/voice than by email. To verify that, we will ask 5 test users to report a "leaking tap" in the prototype, and measure time to submit (T5) and completion rate (T6). We are right if ≥ 4 of 5 submit in under 60 seconds without help.

---

# Part B: Landlords and property managers

Metrics follow the user flow from the landlord's perspective: Detect → Intake → Classify & prioritise → Coordinate & schedule → Resolve → Business outcomes.

## North Star metric (landlord side)

**% of maintenance tickets handled end-to-end without manual coordination by the landlord** (no calls, emails or chasing; the landlord only approves).

It targets the hidden time sink (Issue 10) and the time overload (Issue 11), which are the core of our value proposition.

| Baseline | Target |
|---|---|
| ~0% for self-managing landlords, who find contractors, call tenants and follow up themselves. 52% say maintenance is their most time-consuming task. | ≥ 70% |

## 1. Detect: System reports (sensors + AI anomaly detection)

| # | Metric | Definition | Baseline | Target | Addresses |
|---|---|---|---|---|---|
| L1 | Proactive ticket share | % of tickets created from sensor detection rather than a tenant report | ~0%: landlords only find out once tenants report | ≥ 40% | Issue 12 |
| L2 | Detection lead time | Time between the first sensor anomaly and the moment a tenant would have noticed (e.g. the radiator valve fault, a leak spreading) | 0 (reactive) | ≥ 24 h earlier on average | Issue 11, 12 |
| L3 | Alert precision | % of sensor alerts that turn out to be real issues (confirmed by the tenant) | n/a | ≥ 85% | Trust in system |
| L4 | Damage prevented | % of leak/humidity alerts handled before costly damage (water damage, visible mould) | Non-urgent issues are often delayed until expensive | ≥ 80% | Issue 11 |

## 2. Intake: Tenant reports → AI turns them into structured tickets

| # | Metric | Definition | Baseline | Target | Addresses |
|---|---|---|---|---|---|
| L5 | Structured ticket rate | % of incoming requests that arrive with category, priority, location and media attached, with no manual sorting | Unstructured emails, calls and messages; 3.3 requests per unit per year | ≥ 95% | Issue 7 |
| L6 | Intake time per request | Landlord minutes spent reading, clarifying and logging a new request | Manual: calls and back-and-forth messages to understand the problem | < 1 minute (review only) | Issue 7, 11 |
| L7 | Duplicates merged | % of related reports (e.g. 6 cold flats on one floor) merged into one root-cause ticket | Each report handled separately | ≥ 90% of related reports merged | Issue 7, 8 |

## 3. Classify & prioritise: AI classifier → urgency, category, next steps

| # | Metric | Definition | Baseline | Target | Addresses |
|---|---|---|---|---|---|
| L8 | Category accuracy | % of AI categories (plumbing, HVAC, appliances, electrical…) not changed by the landlord | Manual triage of every request | ≥ 90% for the top-4 categories (~71% of all requests) | Issue 8 |
| L9 | Urgency accuracy | % of emergency / non-emergency labels not changed by the landlord | Manual judgement | ≥ 95% for emergencies | Issue 12 |
| L10 | Tickets avoided by quick fix | % of tickets closed through the chatbot self-help with no technician needed | 0% | 15–20% | Issue 7, 11 |

## 4. Coordinate & schedule: Scheduling → right trade → tenant informed

| # | Metric | Definition | Baseline | Target | Addresses |
|---|---|---|---|---|---|
| L11 | Time to technician booked | Time from ticket creation to a confirmed technician appointment | Landlords find and call contractors themselves | Emergency < 2 h, non-emergency < 24 h | Issue 9, 10 |
| L12 | Right-trade rate | % of jobs where the first technician sent has the right trade/skills | n/a | ≥ 90% | Issue 9 |
| L13 | Missed appointment rate | % of visits where the technician can't get in | Up to 20% of appointments missed. Main reason: tenant not aware or not home (80%) | < 5% | Issue 9 |
| L14 | Manual follow-ups per ticket | Number of calls or messages the landlord sends to contractors or tenants per ticket | Finding contractors, scheduling, following up with vendors and managing delays all done by hand | ≤ 1 per ticket | Issue 10 |

## 5. Resolve: Maintenance → Dashboard

| # | Metric | Definition | Baseline | Target | Addresses |
|---|---|---|---|---|---|
| L15 | Median resolution time | Time from ticket creation to closure | 14.7 days self-managed, 10.1 days coordinated, 13.1 days overall (Hemlane) | < 7 days | Issue 9, 10 |
| L16 | Long-tail tickets | % of tickets open for more than 30 days | Slowest 10% take > 4 months | < 3% | Issue 9 |
| L17 | First-time fix rate | % of jobs completed on the first visit | Repeat visits are a known cause of delay | ≥ 80% | Issue 9 |
| L18 | Work-order saturation | % of units with an open work order | 5.98% (NAA benchmark); ≤ 5% counts as "exceptional" | ≤ 4% | Issue 9 |
| L19 | On-target completion | % of repairs completed within target time (emergency 24 h / non-emergency 28 days) | 91% emergency, 79% non-emergency (UK TSM 2024/25) | ≥ 98% emergency, ≥ 95% non-emergency | Issue 12 |

## 6. Business outcomes: what the landlord gains overall

| # | Metric | Definition | Baseline | Target | Addresses |
|---|---|---|---|---|---|
| L20 | Landlord hours on maintenance | Hours per month the landlord spends on maintenance management | 68% of self-managing portfolio landlords spend ≥ 31 h/month on property management | –50% time spent on maintenance | Issue 11 |
| L21 | Deferred maintenance | % of landlords who regularly postpone non-urgent repairs because of a lack of time | 77% | < 25% | Issue 11 |
| L22 | Cost of missed appointments | Money lost through wasted technician visits | £50–100 per missed appointment (UK social landlords) | –75% | Issue 9 |
| L23 | Tenant satisfaction / retention | Tenant satisfaction with repairs (links to the tenant matrix, T20) and tenant turnover | 49–72% satisfied with repair time (UK) | ≥ 85% satisfied; lower turnover | Issue 12 |
| L24 | Dashboard adoption | % of landlords using the dashboard weekly after onboarding | n/a | ≥ 80% | Product uptake |

## What we can test with our prototype (build to learn)

The prototype uses no real sensors, contractors or data, so L1, L2, L15, L20 and L22 belong in a later pilot. In usability tests with fake data and test users (landlords, property managers, caretakers), we can measure:

| Risk (Cagan) | What we test | Metric |
|---|---|---|
| Usability | Can a landlord see at a glance which ticket is most urgent and what to do next? | Time to identify the top-priority ticket on the dashboard |
| Usability | Do they understand a merged ticket ("6 cold flats → 1 boiler issue")? | L7 comprehension: can they explain it back? |
| Value | Would they trust the AI's category and urgency without re-checking? | L8, L9 (would they change the label?) |
| Value | Would they let the system book technicians automatically? | % who say yes to auto-booking (L11, L14) |
| Viability | Would they pay for it, and how much? | Willingness to pay per unit per month |

**Test card example:**
We believe that landlords will trust AI-prioritised tickets enough to act on them without re-checking. To verify that, we will show 5 landlords/property managers a dashboard with 10 fake tickets, and measure how many AI urgency labels they would change (L9) and the time to identify the most urgent ticket. We are right if they change ≤ 1 in 10 labels and find the top ticket in under 15 seconds.
