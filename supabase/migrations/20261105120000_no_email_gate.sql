-- Sign-up without the email-confirmation gate (lib/actions/auth.ts).
-- New accounts are created already confirmed. Accounts that signed up while confirmation was
-- required and never got (or opened) the email are confirmed on their next sign-in. These
-- helpers do that; only server code with the service role may call them.

-- Confirms a still-unconfirmed account and returns its id, or null if there is none to confirm.
create or replace function public.confirm_pending_email(addr text) returns uuid
language plpgsql security definer set search_path = public, auth as $$
declare
  uid uuid;
begin
  update auth.users set email_confirmed_at = now()
  where lower(email) = lower(trim(addr)) and email_confirmed_at is null
  returning id into uid;
  return uid;
end
$$;

-- Undoes confirm_pending_email when the password then turns out to be wrong.
create or replace function public.unconfirm_email(uid uuid) returns void
language sql security definer set search_path = public, auth as $$
  update auth.users set email_confirmed_at = null where id = uid
$$;

revoke all on function public.confirm_pending_email(text) from public, anon, authenticated;
revoke all on function public.unconfirm_email(uuid) from public, anon, authenticated;
grant execute on function public.confirm_pending_email(text) to service_role;
grant execute on function public.unconfirm_email(uuid) to service_role;
