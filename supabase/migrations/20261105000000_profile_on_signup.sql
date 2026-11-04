-- Create the landlord or tenant record when the auth user is created, from the
-- metadata passed to signUp(). Before this, the app created the record only when
-- signUp() returned a session, which never happens when email confirmation is on
-- (the default on hosted Supabase). Those users could confirm and sign in, but had
-- no landlord or tenant record, so the app sent them back to the login page.

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}');
  role text := meta ->> 'role';
  tenant_unit uuid;
begin
  if role = 'landlord' then
    insert into public.landlords (user_id, name, email)
    values (new.id, coalesce(nullif(trim(meta ->> 'name'), ''), split_part(new.email, '@', 1)), new.email)
    on conflict (user_id) do nothing;

  elsif role = 'tenant' then
    tenant_unit := nullif(meta ->> 'unit_id', '')::uuid;
    -- The unit must belong to the building the invite code is for.
    if not exists (
      select 1 from public.units u join public.buildings b on b.id = u.building_id
      where u.id = tenant_unit and b.invite_code = upper(meta ->> 'invite_code')
    ) then
      raise exception 'Invalid invite code or apartment';
    end if;
    insert into public.tenants (user_id, unit_id, name, email, phone)
    values (new.id, tenant_unit, coalesce(nullif(trim(meta ->> 'name'), ''), split_part(new.email, '@', 1)),
            new.email, coalesce(meta ->> 'phone', ''))
    on conflict (user_id) do nothing;
  end if;
  -- No role (e.g. the seed script's demo users): nothing to do.
  return new;
end
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
