-- Demo data (all fake). Every demo account uses the password: demo-password
--
--   Landlord  markus@demo.test
--   Tenants   mara@demo.test (Alexanderplatz 1, 4B), plus 4A, 4C, 4D, 2B, 1B (see below)

create or replace function pg_temp.demo_user(uid uuid, mail text) returns void
language plpgsql as $$
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', mail,
    crypt('demo-password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid, uid::text, jsonb_build_object('sub', uid::text, 'email', mail), 'email', now(), now(), now());
end
$$;

-- ---------------------------------------------------------------- landlord
select pg_temp.demo_user('00000000-0000-4000-a000-000000000001', 'markus@demo.test');
insert into public.landlords (id, user_id, name, email)
values ('10000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000001', 'Markus Weber', 'markus@demo.test');

-- ---------------------------------------------------------------- buildings
insert into public.buildings (id, landlord_id, name, address, invite_code) values
  ('20000000-0000-4000-a000-000000000001', '10000000-0000-4000-a000-000000000001', 'Alexanderplatz 1', 'Alexanderplatz 1, 10178 Berlin', 'ALEX0001'),
  ('20000000-0000-4000-a000-000000000002', '10000000-0000-4000-a000-000000000001', 'Kastanienallee 12', 'Kastanienallee 12, 10435 Berlin', 'KAST0012'),
  ('20000000-0000-4000-a000-000000000003', '10000000-0000-4000-a000-000000000001', 'Boxhagener Str. 40', 'Boxhagener Straße 40, 10245 Berlin', 'BOXH0040');

-- Alexanderplatz 1: floors 1–5, flats A–D. Kastanienallee 12: floors 1–4, A–C. Boxhagener: floors 1–3, A–B.
insert into public.units (building_id, floor, position, number)
select '20000000-0000-4000-a000-000000000001', f, p, f || p
from generate_series(1, 5) f, unnest(array['A', 'B', 'C', 'D']) p;
insert into public.units (building_id, floor, position, number)
select '20000000-0000-4000-a000-000000000002', f, p, f || p
from generate_series(1, 4) f, unnest(array['A', 'B', 'C']) p;
insert into public.units (building_id, floor, position, number)
select '20000000-0000-4000-a000-000000000003', f, p, f || p
from generate_series(1, 3) f, unnest(array['A', 'B']) p;

-- ---------------------------------------------------------------- tenants
create or replace function pg_temp.demo_tenant(uid uuid, mail text, tenant_name text, phone text, building uuid, flat text)
returns void language plpgsql as $$
begin
  perform pg_temp.demo_user(uid, mail);
  insert into public.tenants (user_id, unit_id, name, email, phone)
  select uid, u.id, tenant_name, mail, phone from public.units u where u.building_id = building and u.number = flat;
end
$$;

select pg_temp.demo_tenant('00000000-0000-4000-a000-000000000011', 'mara@demo.test',  'Mara Schulz',   '+49 151 0000 0011', '20000000-0000-4000-a000-000000000001', '4B');
select pg_temp.demo_tenant('00000000-0000-4000-a000-000000000012', 'jonas@demo.test', 'Jonas Becker',  '+49 151 0000 0012', '20000000-0000-4000-a000-000000000001', '4A');
select pg_temp.demo_tenant('00000000-0000-4000-a000-000000000013', 'lea@demo.test',   'Lea Hoffmann',  '+49 151 0000 0013', '20000000-0000-4000-a000-000000000001', '4C');
select pg_temp.demo_tenant('00000000-0000-4000-a000-000000000014', 'emre@demo.test',  'Emre Yilmaz',   '+49 151 0000 0014', '20000000-0000-4000-a000-000000000001', '4D');
select pg_temp.demo_tenant('00000000-0000-4000-a000-000000000015', 'sofia@demo.test', 'Sofia Rossi',   '+49 151 0000 0015', '20000000-0000-4000-a000-000000000001', '2B');
select pg_temp.demo_tenant('00000000-0000-4000-a000-000000000016', 'paul@demo.test',  'Paul Krüger',   '+49 151 0000 0016', '20000000-0000-4000-a000-000000000001', '1B');
select pg_temp.demo_tenant('00000000-0000-4000-a000-000000000017', 'nina@demo.test',  'Nina Wagner',   '+49 151 0000 0017', '20000000-0000-4000-a000-000000000002', '2A');

-- ---------------------------------------------------------------- technicians (shared pool)
insert into public.technicians (id, landlord_id, name, trade, email, phone) values
  ('30000000-0000-4000-a000-000000000001', null, 'Kai Neumann (Neumann Sanitär)',  'plumber',     'kai@pool.demo.test',   '+49 30 0000 0001'),
  ('30000000-0000-4000-a000-000000000002', null, 'Aylin Demir (WarmTech)',         'heating',     'aylin@pool.demo.test', '+49 30 0000 0002'),
  ('30000000-0000-4000-a000-000000000003', null, 'Tom Richter (Richter Elektro)',  'electrician', 'tom@pool.demo.test',   '+49 30 0000 0003'),
  ('30000000-0000-4000-a000-000000000004', null, 'Olga Petrova (Fix-it Berlin)',   'handyman',    'olga@pool.demo.test',  '+49 30 0000 0004'),
  -- Markus's own plumber (custom technician)
  ('30000000-0000-4000-a000-000000000005', '10000000-0000-4000-a000-000000000001', 'Stefan Braun', 'plumber', 'stefan@demo.test', '+49 30 0000 0005');

-- Weekday 2-hour slots, 08:00–18:00 Berlin time, for the next 14 days.
insert into public.tech_slots (technician_id, starts_at, ends_at)
select t.id, s, s + interval '2 hours'
from public.technicians t,
  generate_series(date_trunc('day', now() at time zone 'Europe/Berlin') + interval '1 day',
                  date_trunc('day', now() at time zone 'Europe/Berlin') + interval '14 days', interval '1 day') d,
  lateral (select (d + make_interval(hours => h)) at time zone 'Europe/Berlin' as s from unnest(array[8, 10, 12, 14, 16]) h) slot
where extract(isodow from d) < 6;

-- ---------------------------------------------------------------- history (so the dashboard isn't empty)
-- Mara's flat (4B) starts with no tickets, as in the demo script (product.md §14).
create or replace function pg_temp.demo_ticket(
  building uuid, flat text, issue text, urg text, step text, trd text, summ text, st text,
  age interval, fixed_after interval, src text, report_text text
) returns uuid language plpgsql as $$
declare
  tid uuid;
  uid uuid;
  occurred timestamptz := now() - age;
  due timestamptz;
begin
  select id into uid from public.units where building_id = building and number = flat;
  due := occurred + case when urg in ('emergency', 'high') then interval '24 hours' else interval '28 days' end;
  insert into public.tickets (building_id, unit_id, issue_type, urgency, next_step, trade, summary, status,
    classified_by, classification_confidence, occurred_at, created_at, due_at, resolved_at)
  values (building, uid, issue, urg, step, trd, summ, st, 'jev', 0.93, occurred, occurred, due,
    case when fixed_after is not null then occurred + fixed_after end)
  returning id into tid;
  insert into public.reports (unit_id, tenant_id, source, text, ticket_id, created_at)
  values (uid, (select id from public.tenants where unit_id = uid limit 1), src, report_text, tid, occurred);
  insert into public.ticket_events (ticket_id, type, actor, data, created_at) values
    (tid, 'created', case when src = 'sensor' then 'system' else 'tenant' end, '{}', occurred),
    (tid, 'classified', 'ai', jsonb_build_object('issue_type', issue, 'urgency', urg), occurred + interval '5 seconds');
  if fixed_after is not null then
    insert into public.ticket_events (ticket_id, type, actor, data, created_at)
    values (tid, 'status', 'technician', '{"status": "resolved"}', occurred + fixed_after);
  end if;
  return tid;
end
$$;

-- Alexanderplatz 1
select pg_temp.demo_ticket('20000000-0000-4000-a000-000000000001', '2C', 'defect', 'low', 'inform_landlord', 'handyman',
  'Loose door hinge on the bedroom door.', 'logged', interval '3 days', null, 'tenant', 'The bedroom door hinge is loose and the door drags.');
select pg_temp.demo_ticket('20000000-0000-4000-a000-000000000001', '3A', 'mould', 'medium', 'schedule_technician', 'handyman',
  'Damp patch spreading on the bedroom wall; humidity above 70 % for 3 days.', 'logged', interval '2 days', null, 'sensor', 'Humidity above 70 % for 3 days. Tenant confirmed: yes.');
select pg_temp.demo_ticket('20000000-0000-4000-a000-000000000001', '5A', 'electricity', 'high', 'schedule_technician', 'electrician',
  'Kitchen outlet stopped working after a tripped switch.', 'logged', interval '30 hours', null, 'tenant', 'The kitchen sockets have no power since yesterday.');
select pg_temp.demo_ticket('20000000-0000-4000-a000-000000000001', '1A', 'water', 'high', 'schedule_technician', 'plumber',
  'Dripping tap in the bathroom.', 'resolved', interval '12 days', interval '2 days 4 hours', 'tenant', 'Bathroom tap drips all night.');
select pg_temp.demo_ticket('20000000-0000-4000-a000-000000000001', '3C', 'heating', 'medium', 'quick_fix', 'none',
  'Radiator gurgling and only warm at the bottom; bleeding guide sent.', 'resolved', interval '20 days', interval '1 day', 'tenant', 'Radiator is only warm at the bottom.');
select pg_temp.demo_ticket('20000000-0000-4000-a000-000000000001', '2A', 'defect', 'low', 'inform_landlord', 'handyman',
  'Window in the living room doesn''t seal; draught.', 'resolved', interval '35 days', interval '9 days', 'tenant', 'Living room window lets in cold air.');

-- Kastanienallee 12 (one building with more problems than the others)
select pg_temp.demo_ticket('20000000-0000-4000-a000-000000000002', '2A', 'water', 'high', 'schedule_technician', 'plumber',
  'No hot water in the flat for two hours.', 'logged', interval '40 hours', null, 'sensor', 'Hot-water pipe below 30 °C for 2 h. Tenant confirmed: yes.');
select pg_temp.demo_ticket('20000000-0000-4000-a000-000000000002', '1B', 'mould', 'medium', 'schedule_technician', 'handyman',
  'Mould in the bathroom ceiling corner.', 'logged', interval '6 days', null, 'tenant', 'Black spots on the bathroom ceiling.');
select pg_temp.demo_ticket('20000000-0000-4000-a000-000000000002', '3C', 'heating', 'high', 'schedule_technician', 'heating',
  'Living room cold (16 °C) with the radiator on.', 'logged', interval '10 hours', null, 'sensor', 'Temperature 16 °C for 6 h with the radiator valve open. Tenant confirmed: yes.');
select pg_temp.demo_ticket('20000000-0000-4000-a000-000000000002', '4A', 'defect', 'low', 'inform_landlord', 'handyman',
  'Scraped paint in the hallway.', 'logged', interval '8 days', null, 'tenant', 'Paint scraped off the hallway wall when moving furniture.');
select pg_temp.demo_ticket('20000000-0000-4000-a000-000000000002', '2B', 'electricity', 'medium', 'schedule_technician', 'electrician',
  'Ceiling light in the kitchen flickers.', 'resolved', interval '15 days', interval '6 days', 'tenant', 'Kitchen light flickers constantly.');

-- Boxhagener Str. 40
select pg_temp.demo_ticket('20000000-0000-4000-a000-000000000003', '2A', 'water', 'medium', 'schedule_technician', 'plumber',
  'Slow-draining shower.', 'resolved', interval '25 days', interval '3 days', 'tenant', 'The shower drains very slowly.');

-- A broadcast already pinned for Alexanderplatz 1
insert into public.broadcasts (building_id, landlord_id, text, created_at) values
  ('20000000-0000-4000-a000-000000000001', '10000000-0000-4000-a000-000000000001',
   'Welcome! Report anything that needs fixing here. A photo or a voice memo is enough.', now() - interval '2 days');
