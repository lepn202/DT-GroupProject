-- Build steps 5–7 (architecture.md §12): sensors and grouping, scheduling and technicians,
-- reminders, visit outcomes and the chatbot.

-- ---------------------------------------------------------------- sensors
alter table public.sensor_events
  add column preset text,
  -- The ticket this event created (on "Yes", or straight away for emergencies such as leaks).
  add column ticket_id uuid references public.tickets (id) on delete set null,
  add column confirmed_at timestamptz,
  -- When the event arrived. occurred_at is when the anomaly started (e.g. 6 h ago), which the
  -- main KPI uses; grouping ("3+ flats within 1 hour") uses reported_at.
  add column reported_at timestamptz not null default now();
create index sensor_events_unit_idx on public.sensor_events (unit_id, occurred_at desc);

-- ---------------------------------------------------------------- tickets
-- No overlap between the tenant's windows and any technician: ask for more times, flag on the dashboard.
alter table public.tickets add column needs_windows boolean not null default false;
create index tickets_parent_idx on public.tickets (parent_ticket_id);

-- ---------------------------------------------------------------- technicians and visits
-- Custom technicians are removed softly so past appointments keep their technician.
alter table public.technicians add column removed_at timestamptz;
-- Taps on the technician link page before "Done".
alter table public.appointments
  add column technician_status text check (technician_status in ('confirmed', 'late', 'on_site')),
  add column outcome_note text;
create index appointments_ticket_idx on public.appointments (ticket_id);
create index appointments_technician_idx on public.appointments (technician_id, starts_at);
create index tech_slots_technician_idx on public.tech_slots (technician_id, starts_at);

-- ---------------------------------------------------------------- quick-fix guides per building (chatbot)
alter table public.buildings add column quick_fix_guides text not null default '';

-- ---------------------------------------------------------------- notifications
-- In-app notices (Home cards, dashboard alerts) and a log of every email sent, so the
-- demo panel can show what went out even without an email provider.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('in_app', 'email')),
  kind text not null,
  tenant_id uuid references public.tenants (id) on delete cascade,
  landlord_id uuid references public.landlords (id) on delete cascade,
  technician_id uuid references public.technicians (id) on delete cascade,
  email text,
  ticket_id uuid references public.tickets (id) on delete cascade,
  title text not null,
  body text not null default '',
  link text,
  delivered boolean not null default true,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_tenant_idx on public.notifications (tenant_id, created_at desc);
create index notifications_landlord_idx on public.notifications (landlord_id, created_at desc);

alter table public.notifications enable row level security;
create policy "tenant reads own notifications" on public.notifications for select
  using (tenant_id = public.my_tenant_id());
create policy "landlord reads own notifications" on public.notifications for select
  using (landlord_id = public.my_landlord_id());

-- ---------------------------------------------------------------- chatbot
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  role text not null check (role in ('tenant', 'assistant')),
  text text not null,
  ticket_id uuid references public.tickets (id) on delete set null,
  created_at timestamptz not null default now()
);
create index chat_messages_tenant_idx on public.chat_messages (tenant_id, created_at);

alter table public.chat_messages enable row level security;
create policy "tenant reads own chat" on public.chat_messages for select
  using (tenant_id = public.my_tenant_id());

-- ---------------------------------------------------------------- realtime
alter publication supabase_realtime add table public.appointments, public.notifications, public.chat_messages;

-- ---------------------------------------------------------------- technician link tokens
-- The link token is a technician's only credential (architecture §11). Signed-in users must never
-- read it, not even for their own custom technicians: server code reads it with the service role.
revoke select on public.technicians from authenticated, anon;
grant select (id, landlord_id, name, trade, email, phone, created_at, removed_at) on public.technicians to authenticated;
