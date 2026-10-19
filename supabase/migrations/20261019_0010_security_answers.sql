-- Security questions for account recovery (owner request: pet's name, the phone you use,
-- favourite food). Only hashes are kept; customer service compares a recovery request's
-- answers with them through check_recovery (staff only, from the SQL editor).

create table public.security_answers (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  pet text not null default '',
  phone text not null default '',
  food text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.security_answers enable row level security;
-- No policies: nobody reads these rows; only the functions below touch them.

alter table public.recovery_requests
  add column pet text not null default '',
  add column phone text not null default '',
  add column food text not null default '';

create function public.answer_hash(v text) returns text
language sql immutable set search_path = '' as $fn$
  select case when coalesce(trim(v), '') = '' then ''
    else encode(extensions.digest(lower(trim(v)), 'sha256'), 'hex') end
$fn$;

create function public.set_security_answers(p_pet text, p_phone text, p_food text) returns void
language plpgsql security definer set search_path = '' as $fn$
declare
  me uuid := (select auth.uid());
begin
  if me is null or not exists (select 1 from public.profiles where id = me) then
    raise exception 'Create your profile first';
  end if;
  insert into public.security_answers (user_id, pet, phone, food)
  values (me, public.answer_hash(p_pet), public.answer_hash(p_phone), public.answer_hash(p_food))
  on conflict (user_id) do update
    set pet = excluded.pet, phone = excluded.phone, food = excluded.food, updated_at = now();
end $fn$;

-- The recovery request now carries hashed answers too (a 10-argument version beside the old
-- 7-argument one; the game calls this one).
create function public.request_recovery(
  p_name text, p_player_no bigint, p_realm integer, p_alliance text,
  p_last_attacker text, p_contact text, p_note text,
  p_pet text, p_phone text, p_food text
) returns void
language plpgsql security definer set search_path = '' as $fn$
begin
  if (select count(*) from public.recovery_requests where created_at > now() - interval '1 hour') >= 200 then
    raise exception 'Too many requests right now, try again later';
  end if;
  insert into public.recovery_requests
    (name, player_no, realm, alliance, last_attacker, contact, note, pet, phone, food)
  values (left(coalesce(p_name, ''), 40), p_player_no, p_realm, left(coalesce(p_alliance, ''), 40),
          left(coalesce(p_last_attacker, ''), 40), left(coalesce(p_contact, ''), 120),
          left(coalesce(p_note, ''), 500),
          public.answer_hash(p_pet), public.answer_hash(p_phone), public.answer_hash(p_food));
end $fn$;

-- Staff: does a request match its account? (run in the SQL editor: select * from check_recovery(12);)
create function public.check_recovery(p_request bigint)
returns table (account uuid, account_name text, player_no bigint, pet_ok boolean, phone_ok boolean, food_ok boolean)
language sql stable security definer set search_path = '' as $fn$
  select p.id, p.display_name, p.player_no,
         r.pet <> '' and r.pet = s.pet, r.phone <> '' and r.phone = s.phone, r.food <> '' and r.food = s.food
  from public.recovery_requests r
  join public.profiles p on (r.player_no is not null and p.player_no = r.player_no)
                         or (r.name <> '' and lower(p.display_name) = lower(r.name))
  left join public.security_answers s on s.user_id = p.id
  where r.id = p_request
$fn$;

revoke execute on function public.answer_hash(text), public.check_recovery(bigint) from public, anon, authenticated;
revoke execute on function public.set_security_answers(text, text, text) from public, anon;
grant execute on function public.set_security_answers(text, text, text) to authenticated;
revoke execute on function public.request_recovery(text, bigint, integer, text, text, text, text, text, text, text) from public;
grant execute on function public.request_recovery(text, bigint, integer, text, text, text, text, text, text, text) to anon, authenticated;
