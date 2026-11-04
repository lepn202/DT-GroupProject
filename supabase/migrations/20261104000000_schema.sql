-- Schema for the MVP (architecture.md §7).
-- Writes that the system owns (ticket status, classification, due times) go through
-- server code with the service role. RLS below covers what each signed-in user may read
-- and the few writes they make directly.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- landlords
create table public.landlords (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  name text not null,
  email text not null,
  licence_active boolean not null default true,
  mode text not null default 'automatic' check (mode in ('automatic', 'manual')),
  -- Target hours per urgency (evidence Issue 12: 24 h emergency, 28 days non-emergency).
  due_hours jsonb not null default '{"emergency": 24, "high": 24, "medium": 672, "low": 672}',
  -- Statistics shown in the portfolio's custom problem bar.
  portfolio_stats text[] not null default array['open', 'overdue', 'emergencies', 'avg_fix_days'],
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- buildings and units
create table public.buildings (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.landlords (id) on delete cascade,
  name text not null,
  address text not null,
  invite_code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 8)),
  created_at timestamptz not null default now()
);

create table public.units (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings (id) on delete cascade,
  floor int not null,
  position text not null,
  number text not null,
  unique (building_id, number)
);

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  unit_id uuid not null references public.units (id) on delete cascade,
  name text not null,
  email text not null,
  phone text not null default '',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- technicians
create table public.technicians (
  id uuid primary key default gen_random_uuid(),
  -- null = shared pool; set = that landlord's custom technician
  landlord_id uuid references public.landlords (id) on delete cascade,
  name text not null,
  trade text not null check (trade in ('plumber', 'heating', 'electrician', 'handyman')),
  email text not null,
  phone text not null default '',
  link_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  created_at timestamptz not null default now()
);

create table public.tech_slots (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references public.technicians (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null
);

-- ---------------------------------------------------------------- sensors and reports
create table public.sensor_events (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units (id) on delete cascade,
  metric text not null,
  value text not null,
  duration text,
  details text,
  occurred_at timestamptz not null default now(),
  confirmation text not null default 'pending' check (confirmation in ('pending', 'yes', 'no')),
  simulated boolean not null default true
);

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings (id) on delete cascade,
  unit_id uuid references public.units (id) on delete set null,
  parent_ticket_id uuid references public.tickets (id) on delete set null,
  issue_type text check (issue_type in ('water', 'heating', 'mould', 'electricity', 'defect', 'other')),
  room text,
  scope text not null default 'apartment' check (scope in ('apartment', 'building')),
  urgency text check (urgency in ('emergency', 'high', 'medium', 'low')),
  next_step text check (next_step in ('quick_fix', 'schedule_technician', 'inform_landlord', 'dismiss')),
  trade text check (trade in ('plumber', 'heating', 'electrician', 'handyman', 'none')),
  quick_fix_text text,
  summary text,
  safety_advice text,
  classified_by text check (classified_by in ('jev', 'claude', 'rules', 'landlord')),
  classification_confidence numeric,
  status text not null default 'logged'
    check (status in ('logged', 'confirmed', 'quick_fix', 'booked', 'in_progress', 'resolved', 'dismissed')),
  needs_triage boolean not null default false,
  landlord_touched boolean not null default false,
  occurred_at timestamptz not null default now(),
  due_at timestamptz,
  resolved_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index tickets_building_idx on public.tickets (building_id);
create index tickets_unit_idx on public.tickets (unit_id);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units (id) on delete cascade,
  tenant_id uuid references public.tenants (id) on delete set null,
  source text not null check (source in ('tenant', 'sensor')),
  sensor_event_id uuid references public.sensor_events (id) on delete set null,
  text text,
  transcript text,
  media_paths text[] not null default '{}',
  frame_paths text[] not null default '{}',
  ticket_id uuid references public.tickets (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index reports_ticket_idx on public.reports (ticket_id);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  technician_id uuid not null references public.technicians (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  booked_by text not null default 'system' check (booked_by in ('system', 'landlord')),
  status text not null default 'booked' check (status in ('proposed', 'booked', 'cancelled', 'done')),
  tenant_reply text check (tenant_reply in ('home', 'someone_else', 'reschedule')),
  outcome text check (outcome in ('completed', 'needs_follow_up', 'no_access')),
  reminders_sent int not null default 0,
  created_at timestamptz not null default now()
);

create table public.tenant_windows (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null
);

create table public.ticket_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  type text not null,
  actor text not null check (actor in ('ai', 'tenant', 'landlord', 'technician', 'system')),
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index ticket_events_ticket_idx on public.ticket_events (ticket_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  "from" text not null check ("from" in ('ai', 'tenant', 'landlord', 'technician')),
  author_name text,
  text text not null,
  created_at timestamptz not null default now()
);
create index messages_ticket_idx on public.messages (ticket_id);

create table public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings (id) on delete cascade,
  landlord_id uuid not null references public.landlords (id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

create table public.ai_calls (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  model text,
  purpose text not null,
  input_ref text,
  output jsonb,
  confidence numeric,
  cost numeric,
  latency_ms int,
  error text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- helper functions
-- security definer so policies can look these up without recursing through RLS.
create or replace function public.my_landlord_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.landlords where user_id = auth.uid()
$$;

create or replace function public.my_tenant_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.tenants where user_id = auth.uid()
$$;

create or replace function public.my_unit_id() returns uuid
language sql stable security definer set search_path = public as $$
  select unit_id from public.tenants where user_id = auth.uid()
$$;

create or replace function public.my_building_id() returns uuid
language sql stable security definer set search_path = public as $$
  select u.building_id from public.tenants t join public.units u on u.id = t.unit_id
  where t.user_id = auth.uid()
$$;

create or replace function public.owns_building(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.buildings
    where id = b and landlord_id = public.my_landlord_id()
  )
$$;

-- A tenant can see a ticket for their own flat, or a building-wide ticket in their building.
create or replace function public.tenant_can_see_ticket(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.tickets k
    where k.id = t and (
      k.unit_id = public.my_unit_id()
      or (k.scope = 'building' and k.building_id = public.my_building_id())
    )
  )
$$;

create or replace function public.landlord_can_see_ticket(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.tickets k where k.id = t and public.owns_building(k.building_id)
  )
$$;

-- Invite page: building name and its units for a valid code, readable before sign-in.
create or replace function public.invite_lookup(code text)
returns table (building_id uuid, building_name text, address text, unit_id uuid, unit_number text, floor int)
language sql stable security definer set search_path = public as $$
  select b.id, b.name, b.address, u.id, u.number, u.floor
  from public.buildings b join public.units u on u.building_id = b.id
  where b.invite_code = upper(code)
  order by u.floor, u.position
$$;
grant execute on function public.invite_lookup(text) to anon, authenticated;

-- Ties the signed-in user to a unit in the building the code belongs to.
create or replace function public.join_building(code text, unit uuid, tenant_name text, tenant_phone text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if not exists (
    select 1 from public.units u join public.buildings b on b.id = u.building_id
    where u.id = unit and b.invite_code = upper(code)
  ) then
    raise exception 'Invalid invite code or apartment';
  end if;
  insert into public.tenants (user_id, unit_id, name, email, phone)
  values (auth.uid(), unit, tenant_name, (select email from auth.users where id = auth.uid()), tenant_phone)
  returning id into new_id;
  return new_id;
end
$$;
grant execute on function public.join_building(text, uuid, text, text) to authenticated;

-- ---------------------------------------------------------------- RLS
alter table public.landlords enable row level security;
alter table public.buildings enable row level security;
alter table public.units enable row level security;
alter table public.tenants enable row level security;
alter table public.technicians enable row level security;
alter table public.tech_slots enable row level security;
alter table public.sensor_events enable row level security;
alter table public.tickets enable row level security;
alter table public.reports enable row level security;
alter table public.appointments enable row level security;
alter table public.tenant_windows enable row level security;
alter table public.ticket_events enable row level security;
alter table public.messages enable row level security;
alter table public.broadcasts enable row level security;
alter table public.ai_calls enable row level security; -- no policies: service role only

-- landlords
create policy "landlord reads self" on public.landlords for select using (user_id = auth.uid());
create policy "landlord creates self" on public.landlords for insert with check (user_id = auth.uid());
create policy "landlord updates self" on public.landlords for update using (user_id = auth.uid());

-- buildings
create policy "landlord manages own buildings" on public.buildings for all
  using (landlord_id = public.my_landlord_id()) with check (landlord_id = public.my_landlord_id());
create policy "tenant reads own building" on public.buildings for select
  using (id = public.my_building_id());

-- units
create policy "landlord manages own units" on public.units for all
  using (public.owns_building(building_id)) with check (public.owns_building(building_id));
create policy "tenant reads own building units" on public.units for select
  using (building_id = public.my_building_id());

-- tenants
create policy "tenant reads self" on public.tenants for select using (user_id = auth.uid());
create policy "tenant updates self" on public.tenants for update using (user_id = auth.uid())
  with check (user_id = auth.uid() and unit_id = public.my_unit_id());
create policy "landlord reads own tenants" on public.tenants for select
  using (exists (select 1 from public.units u where u.id = unit_id and public.owns_building(u.building_id)));

-- technicians: landlords see their own and the shared pool
create policy "landlord reads pool and own technicians" on public.technicians for select
  using (public.my_landlord_id() is not null and (landlord_id is null or landlord_id = public.my_landlord_id()));
create policy "landlord manages own technicians" on public.technicians for all
  using (landlord_id = public.my_landlord_id()) with check (landlord_id = public.my_landlord_id());
create policy "landlord reads technician slots" on public.tech_slots for select
  using (exists (select 1 from public.technicians t where t.id = technician_id
    and (t.landlord_id is null or t.landlord_id = public.my_landlord_id()) and public.my_landlord_id() is not null));

-- sensor events
create policy "tenant reads own sensor events" on public.sensor_events for select
  using (unit_id = public.my_unit_id());
create policy "landlord reads own sensor events" on public.sensor_events for select
  using (exists (select 1 from public.units u where u.id = unit_id and public.owns_building(u.building_id)));

-- tickets
create policy "tenant reads visible tickets" on public.tickets for select
  using (unit_id = public.my_unit_id() or (scope = 'building' and building_id = public.my_building_id()));
create policy "landlord reads own tickets" on public.tickets for select
  using (public.owns_building(building_id));

-- reports
create policy "tenant reads own reports" on public.reports for select using (unit_id = public.my_unit_id());
create policy "landlord reads own reports" on public.reports for select
  using (exists (select 1 from public.units u where u.id = unit_id and public.owns_building(u.building_id)));

-- appointments and windows
create policy "tenant reads own appointments" on public.appointments for select
  using (public.tenant_can_see_ticket(ticket_id));
create policy "landlord reads own appointments" on public.appointments for select
  using (public.landlord_can_see_ticket(ticket_id));
create policy "tenant reads own windows" on public.tenant_windows for select
  using (tenant_id = public.my_tenant_id());
create policy "landlord reads windows" on public.tenant_windows for select
  using (public.landlord_can_see_ticket(ticket_id));

-- timeline
create policy "tenant reads ticket events" on public.ticket_events for select
  using (public.tenant_can_see_ticket(ticket_id));
create policy "landlord reads ticket events" on public.ticket_events for select
  using (public.landlord_can_see_ticket(ticket_id));

-- messages (one thread per ticket)
create policy "tenant reads ticket messages" on public.messages for select
  using (public.tenant_can_see_ticket(ticket_id));
create policy "landlord reads ticket messages" on public.messages for select
  using (public.landlord_can_see_ticket(ticket_id));

-- broadcasts
create policy "tenant reads building broadcasts" on public.broadcasts for select
  using (building_id = public.my_building_id());
create policy "landlord manages own broadcasts" on public.broadcasts for all
  using (landlord_id = public.my_landlord_id())
  with check (landlord_id = public.my_landlord_id() and public.owns_building(building_id));

-- ---------------------------------------------------------------- realtime
alter publication supabase_realtime add table public.tickets, public.messages, public.broadcasts, public.sensor_events;

-- ---------------------------------------------------------------- storage
insert into storage.buckets (id, name, public) values ('media', 'media', false)
on conflict (id) do nothing;

-- Tenants upload into a folder named after their own user id. Reads go through
-- short-lived signed URLs made by server code.
create policy "users upload to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
