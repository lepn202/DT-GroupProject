# Evidence

What tenants (Issues 1–6) and landlords (Issues 7–12) experience when something in a rental flat needs fixing, based on secondary research. How the product responds is in [`architecture.md`](architecture.md).

## Summary

- **Tenants** report damp, heating failures and leaks because they want them fixed before they harm their health or belongings. After reporting, though, they hear nothing and wait weeks. Some don't report at all, for fear of conflict with the landlord.
- **Landlords** need to keep their properties safe and in good repair, but most of their time goes into coordinating contractors, tenants and appointments by hand. Tickets stay open for weeks, and small repairs get postponed until they become expensive.

---

## Part A: Tenants

### Key insights

| # | Who | Need | Friction |
|---|---|---|---|
| KI-1 | Tenants living with damp, mould, heating failures or leaks | A healthy, working home | Problems are noticed late, once damage is visible |
| KI-2 | Tenants who report a defect | A quick fix | Repairs take weeks or months, and some never happen |
| KI-3 | Tenants waiting for a repair | To know someone is on it | No confirmation or updates, so they keep chasing |
| KI-4 | Tenants with an appointment | A fix on the first visit | Unclear or missed appointments restart the wait |
| KI-5 | Tenants in shared buildings | Shared problems fixed | Nobody knows others reported it, so the same issue is reported many times |
| KI-6 | Tenants with a problem | A good relationship with the landlord | They fear eviction or rent increases, so they don't complain |

### Issue 1: Defects are common, and damp/mould is the top problem

- 66% of UK tenants have experienced disrepair. The most common issues are damp (37%), heating/hot water (28%) and leaks (27%) *(Hodge Jones & Allen, 2021)*.
- 15.5% of people in the EU live with a leak, damp or rot *(Eurostat, 2023)*.
- Mould is the most common defect for German tenants (39%) *(ImmobilienScout24, ~2012)*.

**→ Product:** humidity, temperature and leak sensors target the most frequent problems.

### Issue 2: Repairs take too long

- An average of ~41 days to fix a reported issue; 22% wait more than 6 months and 18% are never fixed *(Hodge Jones & Allen, 2021)*.
- 43% of tenants wait at least a month for reported hazards *(Quotezone, 2024)*.

**→ Product:** automatic ticket creation, prioritisation and booking remove the manual steps that cause delays.

### Issue 3: Tenants don't know what's happening

- 55% of repair complaints are about the time taken and not knowing, not the repair itself *(Wordnerds × Housemark, 135,000+ comments)*.
- "Waiting for an appointment" is the lowest-rated stage of the repair journey (25/100).
- Tenants quoted in UK scrutiny reviews: *"No automatic response when a repair is reported"*, *"Having to keep chasing"*.

**→ Product:** instant acknowledgement, live ticket status and proactive updates.

### Issue 4: Appointments are unclear or missed

- 80% of landlords say up to 20% of repair appointments are missed. The main reason (80%) is that the tenant didn't know about the appointment or wasn't home *(Inside Housing × Localz)*.

**→ Product:** confirmed time slots, reminders and tenant confirmation.

### Issue 5: Duplicate reports

- When a communal repair is reported, other tenants aren't told, so the same fault is reported many times *(Community Gateway scrutiny review)*.

**→ Product:** cross-flat grouping (six cold flats → one boiler ticket) plus a notice to every affected flat.

### Issue 6: Tenants are reluctant to report

- 12.9% of UK tenants feel unable to complain for fear of eviction, and 12.7% fear a rent increase *(Finbri, 2023)*.
- 40% of renters feel stressed because of cold, damp or mould *(Citizens Advice, 2023)*.
- ~75% of surveyed Berlin tenants feel barely or not at all valued *(Berliner Mieterverein, 2026, not representative)*.

**→ Product:** sensors flag problems without the tenant having to complain. The system asks first ("Is it cold?"), and reporting takes a single photo.

---

## Part B: Landlords, property managers and maintenance teams

Note: a ticket can need little *active work* but stay open for days because of waiting on contractors, parts, approvals or access. Most of the figures below are *elapsed* time.

### Key insights

| # | Who | Need | Friction |
|---|---|---|---|
| KI-7 | Landlords and property managers | Well-maintained properties | A constant stream of unstructured requests |
| KI-8 | Property managers | The right technician, quickly | Most requests fall into a few categories but are still sorted by hand |
| KI-9 | Landlords | Quick, cheap fixes | Tickets stay open for weeks, the slowest for months |
| KI-10 | Self-managing landlords | Control over their property | Coordinating everything themselves makes repairs ~31% slower |
| KI-11 | Portfolio landlords | To protect property value | Maintenance takes the most time, so small repairs are postponed until they're expensive |
| KI-12 | Landlords measured on repair targets | To meet service levels | They only learn about problems when tenants report them |

### Issue 7: High, recurring volume of requests

- 3.3 maintenance requests per rental unit per year *(Hemlane, 193,000+ requests)*. A 40-flat building gets one roughly every 2–3 days.

**→ Product:** AI turns photos and videos into structured tickets, removing manual intake.

### Issue 8: Most work falls into a few categories

- ~71% of requests are plumbing, HVAC, appliances or electrical. Plumbing alone is ~25% *(Hemlane)*.

**→ Product:** these are the categories the sensors cover (leaks, heating), and automatic categorisation routes them to the right trade.

### Issue 9: Tickets stay open for a long time

- Median 13.1 days to resolve a request; the slowest 10% take more than 4 months *(Hemlane)*.
- Median by category: heating 9.6 days, plumbing 9.9, electrical 13.1, appliances 15.8.
- Most of the delay is waiting: for contractors, parts, tenant availability or approval.

**→ Product:** automatic scheduling and status tracking shorten the waiting, not just the repair.

### Issue 10: Coordination is the hidden time sink

- Coordinated maintenance is resolved ~31% faster than self-managed (10.1 vs. 14.7 days median) *(Hemlane)*.
- The time goes into finding contractors, messaging tenants, scheduling, following up and monitoring.

**→ Product:** the core value. The system books the technician, informs the tenant and tracks completion.

### Issue 11: Landlords are overloaded and postpone repairs

- 52% of UK portfolio landlords say maintenance is their most time-consuming task, and 77% regularly delay non-urgent repairs *(Property Reporter, self-reported)*.

**→ Product:** early sensor alerts catch a small leak or rising humidity before it becomes water damage or mould.

### Issue 12: Landlords are judged on target times but can only react

- 79% of non-emergency and 91% of emergency repairs meet the landlord's target *(UK Gov, Tenant Satisfaction Measures 2024/25)*.
- Median targets: **24 hours** for emergency repairs, **28 days** for non-emergency repairs.

**→ Product:** AI prioritisation gives each ticket a due time, and sensors start the clock before a tenant complains.

---

## Limitations

- Most data is from the UK and the US. German data is either old (~2012) or not representative (Berlin, 2026), and there is no German data on the landlord side yet.
- Several sources have a commercial interest (brokers, software providers such as Hemlane).
- Landlord time figures are self-reported.
- Our own interviews are not included yet.

## Sources

**Tenants**
- [Hodge Jones & Allen survey (2021)](https://www.propertyreporter.co.uk/landlords/average-repair-times-for-tenants-passes-40-days.html)
- [Finbri UK Renters Report 2023](https://www.propertyreporter.co.uk/over-a-third-of-renters-have-experienced-issues-with-damp-or-mould.html)
- [Quotezone survey (2024)](https://www.property118.com/nearly-half-of-renters-struggle-with-mould-survey/)
- [Wordnerds × Housemark](https://wordnerds-site.pages.dev/blog/benchmark-series-2)
- [Inside Housing × Localz: missed appointments](https://www.insidehousing.co.uk/sponsored/counting-the-cost-of-missed-repairs-appointments)
- [Community Gateway: repairs communication review](https://www.communitygateway.co.uk/hubfs/Repairs%20Communication%20Scrutiny%20Review.pdf)
- [Citizens Advice survey (2023)](https://djsresearch.co.uk/insights/citizens-advice-survey-reveals-more-than-half-of-the-renters-in-england-are-living-in-cold-damp-or-mouldy-properties-05300)
- [ImmobilienScout24 / Adreg survey](https://wordpress.wohnungswirtschaft-heute.de/wp-content/uploads/2012/11/Adreg-Pestel-Umfrage-Mietminderung-Schimmel.pdf)
- [Berliner Mieterverein survey (2026)](https://www.berliner-mieterverein.de/uploads/2026/03/20260314_MiBo_Auswertung_Umfrage_2026-1.pdf)
- [EU Energy Poverty Advisory Hub (Eurostat)](https://energy-poverty.ec.europa.eu/modules/custom/epah_indicator/pdfs/Population_living_in_a_dwelling_with_presence_of_leak_damp_and_rot.pdf)

**Landlords**
- [Hemlane: maintenance requests](https://www.hemlane.com/resources/rental-property-maintenance-requests/)
- [Hemlane: resolution-time benchmarks](https://www.hemlane.com/resources/rental-repair-resolution-time-benchmarks/)
- [Property Reporter: portfolio landlords](https://www.propertyreporter.co.uk/three-quarters-of-portfolio-landlords-say-self-management-has-become-harder.html)
- [UK Gov: Tenant Satisfaction Measures 2024/25](https://www.gov.uk/government/statistics/tenant-satisfaction-measures-202425/tenant-satisfaction-measures-202425-headline-report)
