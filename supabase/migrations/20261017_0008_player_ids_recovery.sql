-- Public player IDs (sign in with your name OR your ID) and account recovery requests
-- for players who forgot their name or password (owner request).

alter table public.profiles add column player_no bigint generated always as identity (start with 100001);
create unique index profiles_player_no_key on public.profiles (player_no);

-- Sign-in by ID: the account name behind a player ID (names are public in the game anyway).
create function public.login_name(p_id bigint) returns text
language sql stable security definer set search_path = '' as $fn$
  select lower(display_name) from public.profiles where player_no = p_id
$fn$;

-- Recovery: what the player remembers (realm, alliance, who last attacked them) for customer
-- service to match against the account. No policies: rows go in only through the function below.
create table public.recovery_requests (
  id bigint generated always as identity primary key,
  name text not null default '' check (char_length(name) <= 40),
  player_no bigint,
  realm integer check (realm between 1 and 4),
  alliance text not null default '' check (char_length(alliance) <= 40),
  last_attacker text not null default '' check (char_length(last_attacker) <= 40),
  contact text not null default '' check (char_length(contact) <= 120),
  note text not null default '' check (char_length(note) <= 500),
  status text not null default 'open' check (status in ('open', 'done', 'rejected')),
  created_at timestamptz not null default now()
);
alter table public.recovery_requests enable row level security;

create function public.request_recovery(
  p_name text, p_player_no bigint, p_realm integer, p_alliance text,
  p_last_attacker text, p_contact text, p_note text
) returns void
language plpgsql security definer set search_path = '' as $fn$
begin
  -- A simple brake on floods: at most 200 requests an hour for the whole game.
  if (select count(*) from public.recovery_requests where created_at > now() - interval '1 hour') >= 200 then
    raise exception 'Too many requests right now, try again later';
  end if;
  insert into public.recovery_requests (name, player_no, realm, alliance, last_attacker, contact, note)
  values (left(coalesce(p_name, ''), 40), p_player_no, p_realm, left(coalesce(p_alliance, ''), 40),
          left(coalesce(p_last_attacker, ''), 40), left(coalesce(p_contact, ''), 120), left(coalesce(p_note, ''), 500));
end $fn$;

revoke execute on function public.login_name(bigint), public.request_recovery(text, bigint, integer, text, text, text, text) from public;
grant execute on function public.login_name(bigint), public.request_recovery(text, bigint, integer, text, text, text, text) to anon, authenticated;
