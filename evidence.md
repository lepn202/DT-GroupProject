# Evidence

> **Product idea:** an AI + IoT layer for rental buildings. Sensors (temperature, humidity, leaks, radiator valves, window contacts) detect problems early. Tenants report issues by photo, video or voice. The AI creates, prioritises and schedules tickets and keeps everyone informed.
>
> **This file:** what tenants (Issues 1–6) and landlords, property managers and maintenance teams (Issues 7–12) experience when something in a rental flat needs fixing. Based on secondary research. How we measure whether the product helps is in [`success-matrix.md`](success-matrix.md); how it is built is in [`architecture.md`](architecture.md).

---

# Part A: Tenants

## Key insights

| # | Persona | Situation | because (need) | but (friction) |
|---|---|---|---|---|
| KI-1 | Tenants in rented flats | live with damp, mould, heating failures or leaks | they want a healthy, functioning home | problems are often detected late, once damage is already visible |
| KI-2 | Tenants who report a defect | wait for it to be fixed | they need the problem solved quickly | repairs take weeks or months, and some are never fixed |
| KI-3 | Tenants waiting for a repair | try to find out what's happening | they need to plan their day and know someone is on it | they get no confirmation or updates and have to keep chasing |
| KI-4 | Tenants with a repair appointment | stay home or take time off for the technician | they want the repair done on the first try | appointments are unclear or missed, so the wait starts over |
| KI-5 | Tenants in multi-unit buildings | report building-wide issues (heating, communal areas) | they want the shared problem fixed | nobody knows others have reported it, so the same issue is reported many times |
| KI-6 | Tenants with a problem | hesitate to complain | they want to keep a good relationship with the landlord | they fear eviction or rent increases, and feel undervalued |

**Overall insight:** Tenants in rented flats report defects such as damp, heating failures and leaks because they want them fixed before they harm their health or belongings, but after reporting they hear nothing, wait weeks without knowing if or when someone will come, and sometimes don't report at all for fear of conflict with the landlord.

## Issue 1: Defects are common, and damp/mould is the #1 problem

| KPI | Value | Source |
|---|---|---|
| UK renters who have experienced damp or mould | 33.7% (n = 1,001) | Finbri UK Renters Report 2023 |
| UK tenants who experienced some form of disrepair | 66% (n = 2,000) | Hodge Jones & Allen, 2021 |
| Most common issues | Damp 37%, heating/hot water 28%, water leaks 27% | Hodge Jones & Allen, 2021 |
| Room most affected | Bedroom (58%) | Hodge Jones & Allen, 2021 |
| German tenants: most common defect | Mould (39%). One in five tenants has reduced their rent because of a defect (older survey, ~2012) | ImmobilienScout24, n = 1,011 |
| EU population living with a leak, damp or rot | 15.5% (≈ 69.4 million people, 2023) | Eurostat / EU Energy Poverty Advisory Hub |
| Defects as a share of German tenant legal consultations | 17.0%, the 2nd most common topic (2022) | Deutscher Mieterbund |

**Implication for our product:** humidity and temperature sensors plus mould-risk prediction target the most frequent problem. Leak sensors cover the third most common one.

## Issue 2: Repairs take too long

| KPI | Value | Source |
|---|---|---|
| Average wait for a reported issue to be fixed | ~41 days | Hodge Jones & Allen, 2021 |
| Fixed within 2 weeks | 50% | Hodge Jones & Allen, 2021 |
| Waited more than 6 months | 22% | Hodge Jones & Allen, 2021 |
| Never fixed | 18% | Hodge Jones & Allen, 2021 |
| Tenants waiting ≥ 1 month for reported hazards | 43% | Quotezone, 2024 |
| Satisfaction with time taken for most recent repair (example: Croydon) | 49% | Croydon Council TSM 2024/25 |

**Implication:** automatic ticket creation, prioritisation and technician booking remove the manual steps that cause delays.

## Issue 3: The "black box", where tenants don't know what's happening

| KPI | Value | Source |
|---|---|---|
| Repair complaints about time and not knowing rather than the repair itself | 55% (135,000+ tenant comments, 18 housing associations) | Wordnerds × Housemark |
| Sentiment at the "waiting for appointment" stage | 25 / 100, the lowest of the whole repair journey, with ~3× more comments than other stages | Wordnerds × Housemark |
| Tenants who say better communication and faster responses would have the biggest impact | ~50% | Leaders Romans Group survey |

Qualitative evidence (tenant scrutiny reviews, UK):

- "No automatic response when a repair is reported via email or website"
- "Long call waiting times, no call-back option"
- "Having to keep chasing information via the call centre"
- "No communication until a report reaches complaint stage"

**Implication:** real-time ticket status, proactive updates, and a conversational assistant ("Why is my room cold?") address the biggest driver of dissatisfaction.

## Issue 4: Appointments are unclear or missed

| KPI | Value | Source |
|---|---|---|
| Landlords who say up to 20% of repair appointments are missed | 80% of respondents | Inside Housing × Localz survey |
| Main reason for missed appointments | Tenant not aware of or not at home for the appointment (80%) | Inside Housing × Localz survey |
| Tenants whose appointment was missed or not at their preferred time | ~10% each. Repair satisfaction in this group drops below 50% | Stroud DC STAR survey 2019 |

**Implication:** confirmed time slots, reminders and live technician updates reduce wasted visits and frustration on both sides.

## Issue 5: Duplicate reports and no shared visibility

When a communal repair is reported, other tenants in the building aren't informed, so the same repair gets reported several times (Community Gateway tenant scrutiny review).

**Implication:** cross-unit pattern detection (six cold flats → one boiler ticket) plus building-wide notifications.

## Issue 6: Tenants are reluctant to report and feel undervalued

| KPI | Value | Source |
|---|---|---|
| UK tenants who feel unable to complain for fear of eviction | 12.9% | Finbri 2023 |
| UK tenants afraid complaints could lead to rent increases | 12.7% | Finbri 2023 |
| Renters who feel stressed / anxious because of cold, damp or mould | 40% / 36% | Citizens Advice 2023 |
| Berlin tenants who feel barely or not at all valued | ~75% (not representative, n = 481) | Initiative Bülowstraße Ost / Berliner Mieterverein, 2026 |
| Berlin tenants rating their landlord's solution orientation as (rather) bad | 72% (not representative, n = 467) | Initiative Bülowstraße Ost / Berliner Mieterverein, 2026 |

**Implication:** sensors flag problems without the tenant having to "complain". Low-effort reporting (photo, voice memo) lowers the barrier. Sensor-triggered check-ins ("Can you confirm with a photo?") make the tenant a partner rather than a complainant.

## Mapping: tenant issue → product feature

| Tenant issue | Feature that addresses it |
|---|---|
| Damp, mould, leaks detected late | IoT sensors + AI anomaly detection and mould-risk prediction |
| Repairs take weeks | Auto-created, prioritised tickets + automatic technician booking |
| No information while waiting | Live ticket status, push updates, AI chat assistant |
| Missed or unclear appointments | Confirmed slots, reminders, technician tracking |
| Duplicate reports | Cross-unit pattern detection, building-wide notifications |
| Reluctance to report | Sensor-triggered check-ins, photo/video/voice reporting with no forms |

## Limitations of the tenant evidence

- Most quantitative data comes from the UK, where social landlords must publish Tenant Satisfaction Measures. German data is older (ImmobilienScout24, ~2012) or not representative (Berlin 2026 survey).
- Several surveys were run by companies with a commercial interest (brokers, software providers).

## Sources (tenants)

- Hodge Jones & Allen survey via Property Reporter (2021): https://www.propertyreporter.co.uk/landlords/average-repair-times-for-tenants-passes-40-days.html
- Finbri UK Renters Report 2023 via Property Reporter: https://www.propertyreporter.co.uk/over-a-third-of-renters-have-experienced-issues-with-damp-or-mould.html
- Quotezone survey via Property118 (2024): https://www.property118.com/nearly-half-of-renters-struggle-with-mould-survey/
- Wordnerds × Housemark tenant comment analysis: https://wordnerds-site.pages.dev/blog/benchmark-series-2
- Leaders Romans Group survey via The Negotiator: https://thenegotiator.co.uk/tenants-complain-about-their-landlords-less-than-you-think
- Inside Housing × Localz, missed repair appointments: https://www.insidehousing.co.uk/sponsored/counting-the-cost-of-missed-repairs-appointments
- Stroud DC STAR survey 2019: https://stroud.gov.uk/media/siojadsx/1363-stroud-dc-star-survey-2019-general-needs-report.pdf
- Stroud repairs communications report 2026: https://www.stroud.gov.uk/media/g15nitqg/top-repairs-communications-report-action-plan-march-2026.pdf
- Community Gateway, repairs communication scrutiny review: https://www.communitygateway.co.uk/hubfs/Repairs%20Communication%20Scrutiny%20Review.pdf
- Croydon Council tenant satisfaction 2024/25: https://www.croydon.gov.uk/sites/default/files/2025-06/housing-tenant-satisfaction-results-2024-to-2025.pdf
- Citizens Advice survey via DJS Research (2023): https://djsresearch.co.uk/insights/citizens-advice-survey-reveals-more-than-half-of-the-renters-in-england-are-living-in-cold-damp-or-mouldy-properties-05300
- Deutscher Mieterbund, Beratungsstatistik 2022: https://mieterbund.de/?p=10848
- ImmobilienScout24 / Adreg survey on rent reduction and mould: https://wordpress.wohnungswirtschaft-heute.de/wp-content/uploads/2012/11/Adreg-Pestel-Umfrage-Mietminderung-Schimmel.pdf
- Berliner Mieterverein, Mietendenbefragung 2026: https://www.berliner-mieterverein.de/uploads/2026/03/20260314_MiBo_Auswertung_Umfrage_2026-1.pdf
- EU Energy Poverty Advisory Hub (Eurostat), leak/damp/rot indicator: https://energy-poverty.ec.europa.eu/modules/custom/epah_indicator/pdfs/Population_living_in_a_dwelling_with_presence_of_leak_damp_and_rot.pdf

---

# Part B: Landlords, property managers and maintenance teams

Issues are numbered 7–12 so they continue on from the tenant side.

**Important distinction used throughout:**

- **Active work time:** the time a landlord or property manager actually spends handling an issue.
- **Elapsed resolution time:** the total time from when an issue is reported until it is closed.

An issue may need only a little active work but stay open for days because of contractor availability, tenant access, parts, approvals or repeat visits.

## Key insights

| # | Persona | Situation | because (need) | but (friction) |
|---|---|---|---|---|
| KI-7 | Landlords and property managers | receive a constant stream of maintenance requests from every unit | they need to keep their properties in good condition | the volume is high and recurring, and every request arrives as a separate, unstructured case |
| KI-8 | Property managers | sort and route incoming requests | they want to send the right technician quickly | most requests fall into a few categories (plumbing, HVAC, appliances, electrical) that still have to be triaged by hand |
| KI-9 | Landlords | try to close maintenance tickets | they want issues resolved quickly and cheaply | requests stay open for weeks, and the slowest take months |
| KI-10 | Self-managing landlords | coordinate contractors, tenants and appointments themselves | they want to stay in control of their property | coordination is the main source of delay: self-managed requests take ~31% longer |
| KI-11 | Portfolio landlords | manage maintenance alongside everything else | they want to protect the value of their property | maintenance is their most time-consuming task, so they postpone non-urgent repairs, which then become expensive |
| KI-12 | Landlords and housing providers | are measured against repair target times | they need to meet service levels and regulations | they only find out about problems once tenants report them, so they are always reacting |

**Overall insight:** Landlords and property managers handle a steady stream of maintenance requests because they need to keep their properties safe, compliant and valuable, but most of their time goes into coordinating contractors, tenants and appointments by hand, so tickets stay open for weeks and non-urgent problems get postponed until they become expensive.

## Issue 7: High, recurring volume of maintenance requests

| KPI | Value | Source |
|---|---|---|
| Average maintenance requests per rental unit per year | 3.3 (193,000+ requests, all 50 US states, 8 years) | Hemlane |
| Single-family rentals | 3.40 requests per unit per year | Hemlane |
| Multifamily properties | 3.23 requests per unit per year | Hemlane |
| Work orders completed per technician | 109.5 per month (≈ 1,314 per year) | National Apartment Association |

**Example:** a building with 40 flats generates about 130 maintenance requests per year, or roughly one every 2–3 days.

**Implication for our product:** AI that turns tenant photos, videos and voice memos into structured tickets removes the manual intake work for every one of these requests.

## Issue 8: Workload is concentrated in a few categories

| KPI | Value | Source |
|---|---|---|
| Share of requests in the top 4 categories (plumbing, HVAC, appliances, electrical) | ~71% | Hemlane |
| Largest single category | Plumbing, ~25% of requests | Hemlane |

**Implication:** these are exactly the categories our sensors can monitor: leak detectors for plumbing, temperature and radiator valves for heating/HVAC. Automatic categorisation and routing to the right technician covers most of the workload.

## Issue 9: Tickets stay open for a long time

| KPI | Value | Source |
|---|---|---|
| Median time to resolve a maintenance request | 13.1 days | Hemlane |
| Slowest 10% of requests | > 4 months to close | Hemlane |
| Average apartment work-order completion time | 3.88 days | National Apartment Association |
| Work orders completed within 24 hours | 66% | National Apartment Association |
| Work-order saturation (share of units with an open work order) | 5.98% benchmark. ≤ 10% is acceptable, ≤ 5% is exceptional | National Apartment Association |

Median resolution time by category (Hemlane):

| Maintenance category | Median resolution time |
|---|---|
| Rekeying and locks | 7.9 days |
| Heating and HVAC | 9.6 days |
| Plumbing | 9.9 days |
| Electrical | 13.1 days |
| Appliance repair | 15.8 days |
| Pest control | 16.0 days |
| General handywork | 19.7 days |
| Roof repair | 33.9 days |
| **All categories** | **13.1 days** |

**Why tickets stay open** (elapsed time, not active work): waiting for a contractor, spare parts, tenant availability, owner approval, weather, communication delays, and repeat visits.

**Implication:** most of the delay is waiting and coordination, not repair work. Automatic scheduling, tenant-availability matching and status tracking shorten elapsed time without the landlord having to do more work.

## Issue 10: Coordination is the hidden time sink

| KPI | Value | Source |
|---|---|---|
| Median resolution time, coordinated maintenance | 10.1 days | Hemlane |
| Median resolution time, self-managed maintenance | 14.7 days | Hemlane |
| Speed advantage of coordinated maintenance | ~31% faster | Hemlane |

Coordination tasks that make up the landlord's time burden:

- Finding and contacting contractors
- Communicating with tenants
- Scheduling appointments
- Following up with vendors
- Monitoring completion
- Managing delays

**Implication:** this is the core of our value proposition. The AI takes over coordination by creating the ticket, booking the technician, informing the tenant and tracking completion.

## Issue 11: Maintenance overloads landlords, so repairs get postponed

| KPI | Value | Source |
|---|---|---|
| Self-managing UK portfolio landlords spending ≥ 31 hours per month managing their properties | 68% | Property Reporter (UK landlord survey) |
| Landlords who say maintenance and repairs are the most time-consuming part of managing their portfolio | 52% | Property Reporter (UK landlord survey) |
| Landlords who regularly delay non-urgent maintenance because they lack time | 77% | Property Reporter (UK landlord survey) |

Note: these are self-reported figures, so they show perceived workload and time pressure rather than exact time measurements.

**Implication:** delayed small repairs turn into expensive damage. A minor leak becomes water damage, and sustained humidity becomes mould. Sensors and predictive alerts catch issues while they're still cheap to fix, and automation frees up the time landlords say they don't have.

## Issue 12: Performance is measured against target times, but management is reactive

| KPI | Value | Source |
|---|---|---|
| Non-emergency repairs completed within landlord's target time | 79% | UK Gov, Tenant Satisfaction Measures 2024/25 |
| Emergency repairs completed within landlord's target time | 91% | UK Gov, Tenant Satisfaction Measures 2024/25 |
| Median target time, emergency repairs | 24 hours | UK Gov, Tenant Satisfaction Measures 2024/25 |
| Median target time, non-emergency repairs | 28 days | UK Gov, Tenant Satisfaction Measures 2024/25 |

**Implication:** about 1 in 5 non-emergency repairs misses its target. Because the clock only starts when a tenant reports the problem, landlords can never get ahead of it. AI prioritisation (emergency vs. non-emergency) and early sensor detection help landlords hit their service levels and prove it with data.

## Mapping: landlord issue → product feature

| Landlord issue | Feature that addresses it |
|---|---|
| High, recurring request volume | AI intake: photo, video or voice → structured ticket (category, priority, location) |
| Workload concentrated in plumbing, HVAC, appliances, electrical | Leak, temperature and radiator-valve sensors + automatic categorisation and routing |
| Tickets stay open for weeks | Automatic scheduling, tenant-availability matching, live status tracking |
| Coordination is the hidden time sink | AI books technicians, informs tenants, follows up and tracks completion |
| Non-urgent repairs postponed until expensive | Predictive alerts (mould risk, faulty valves) + automated handling of small jobs |
| Reactive management against target times | Early anomaly detection, AI prioritisation, SLA dashboard; cross-unit patterns merged into one ticket |

## Limitations of the landlord evidence

- Most quantitative data comes from the US (Hemlane, National Apartment Association) and the UK (Tenant Satisfaction Measures, landlord survey). German landlord data is still missing.
- Hemlane and the NAA measure things differently. Hemlane's 13.1 days is the median elapsed time from request to closure, while the NAA's 3.88 days is the average work-order completion time for apartment operators with on-site technicians. The two figures should not be compared directly.
- The UK landlord time-burden figures are self-reported.
- Hemlane is a property-management software provider and has a commercial interest in showing that coordination matters.
- Our own user interviews with landlords and property managers are not written up here yet.

## Sources (landlords)

- Hemlane, Rental Property Maintenance Requests: https://www.hemlane.com/resources/rental-property-maintenance-requests/
- Hemlane, Rental Repair Resolution-Time Benchmarks: https://www.hemlane.com/resources/rental-repair-resolution-time-benchmarks/
- National Apartment Association, 10 Things About Common Maintenance Work Orders: https://naahq.org/news/10-things-about-common-maintenance-work-orders
- Property Reporter, Three-quarters of portfolio landlords say self-management has become harder: https://www.propertyreporter.co.uk/three-quarters-of-portfolio-landlords-say-self-management-has-become-harder.html
- UK Government, Tenant Satisfaction Measures 2024/25 headline report: https://www.gov.uk/government/statistics/tenant-satisfaction-measures-202425/tenant-satisfaction-measures-202425-headline-report
