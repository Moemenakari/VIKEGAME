-- Jarlheim online realm: real players on the world map, player alliances with their own
-- chat, asynchronous attacks between players (PvP) and King's War points.
-- The hold itself is simulated on the player's device (offline first); the server keeps
-- one row per player (one write per sync, never one per building) and checks what it can:
-- ownership, realm, cooldowns, loot caps and the war window.
-- (Writes other than through the functions are refused by row-level security.)

-- ---------------------------------------------------------------------------
-- Player alliances (besides the six AI alliances of every realm)
-- ---------------------------------------------------------------------------
create table public.alliances (
  id uuid primary key default gen_random_uuid(),
  realm integer not null check (realm between 1 and 4),
  tag text not null check (tag ~ '^[A-Z0-9]{3}$'),
  name text not null check (char_length(name) between 3 and 30),
  leader_id uuid not null references public.profiles (id) on delete cascade,
  channel_id uuid not null references public.channels (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (realm, tag)
);
create index alliances_leader_idx on public.alliances (leader_id);
create index alliances_channel_idx on public.alliances (channel_id);
alter table public.alliances enable row level security;
create policy "everyone sees alliances" on public.alliances for select to authenticated using (true);
revoke insert, update on public.alliances from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Holds: one row per player, their place on the map and a snapshot for PvP
-- ---------------------------------------------------------------------------
create table public.holds (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  realm integer not null check (realm between 1 and 4),
  x integer not null check (x between 0 and 40),
  y integer not null check (y between 0 and 40),
  power integer not null default 0 check (power >= 0),
  hall integer not null default 1 check (hall between 1 and 30),
  avatar integer not null default 0,
  -- An AI alliance (0–5) or a player alliance; one or none.
  ai_alliance integer check (ai_alliance between 0 and 5),
  alliance_id uuid references public.alliances (id) on delete set null,
  -- Troops, walls, heroes and lootable resources at the last sync (read by attackers).
  defence jsonb not null default '{}'::jsonb,
  land text[] not null default '{}',
  shield_until timestamptz,
  updated_at timestamptz not null default now(),
  unique (realm, x, y)
);
create index holds_realm_idx on public.holds (realm);
create index holds_alliance_idx on public.holds (alliance_id);
alter table public.holds enable row level security;
create policy "see the holds of the realm" on public.holds for select to authenticated using (true);
create policy "update your own hold" on public.holds for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke insert, update on public.holds from anon, authenticated;
grant update (power, hall, avatar, ai_alliance, defence, land, updated_at) on public.holds to authenticated;

-- Size limit on the snapshot so nobody can store junk in it.
alter table public.holds add constraint holds_defence_size check (octet_length(defence::text) < 8000);

-- Your place in the realm: the first free tile from the candidates your game proposes.
create function public.claim_home(realm integer, candidates jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $fn$
declare
  me uuid := (select auth.uid());
  mine public.holds;
  c jsonb;
begin
  if me is null or not exists (select 1 from public.profiles where id = me) then
    raise exception 'Create your profile first';
  end if;
  select * into mine from public.holds where user_id = me;
  if found then
    return jsonb_build_object('realm', mine.realm, 'x', mine.x, 'y', mine.y);
  end if;
  for c in select * from jsonb_array_elements(candidates) limit 200 loop
    begin
      insert into public.holds (user_id, realm, x, y) values (me, realm, (c->>0)::int, (c->>1)::int);
      return jsonb_build_object('realm', realm, 'x', (c->>0)::int, 'y', (c->>1)::int);
    exception when unique_violation then
      null; -- someone already lives there: try the next tile
    end;
  end loop;
  raise exception 'This realm is full';
end $fn$;

-- ---------------------------------------------------------------------------
-- Alliance chats: readable by the members of the alliance (AI or player alliance)
-- ---------------------------------------------------------------------------
create or replace function public.can_read_channel(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $fn$
  select exists (
    select 1 from public.channels c
    where c.id = cid and (
      c.kind = 'realm'
      or exists (select 1 from public.channel_members m where m.channel_id = cid and m.user_id = (select auth.uid()))
      or (c.kind = 'clan' and exists (
        select 1 from public.holds h
        left join public.alliances a on a.id = h.alliance_id
        where h.user_id = (select auth.uid())
          and (a.channel_id = cid
            or (h.alliance_id is null and h.ai_alliance is not null and cid =
              ('00000000-0000-0000-00' || lpad(h.realm::text, 2, '0') || '-0000000000' || lpad((h.ai_alliance + 1)::text, 2, '0'))::uuid))
      ))
    )
  )
$fn$;

create function public.create_alliance(tag text, name text) returns uuid
language plpgsql security definer set search_path = '' as $fn$
declare
  me uuid := (select auth.uid());
  h public.holds;
  cid uuid;
  aid uuid;
begin
  select * into h from public.holds where user_id = me;
  if not found then raise exception 'Take your place in the realm first'; end if;
  if h.hall < 5 then raise exception 'Alliances open at Great Hall 5'; end if;
  if exists (select 1 from public.alliances where leader_id = me) then raise exception 'You already lead an alliance'; end if;
  insert into public.channels (kind, name) values ('clan', '[' || upper(tag) || '] ' || name) returning id into cid;
  insert into public.alliances (realm, tag, name, leader_id, channel_id)
    values (h.realm, upper(tag), name, me, cid) returning id into aid;
  update public.holds set alliance_id = aid, ai_alliance = null where user_id = me;
  return aid;
end $fn$;

create function public.join_alliance(alliance uuid) returns void
language plpgsql security definer set search_path = '' as $fn$
declare
  me uuid := (select auth.uid());
begin
  if alliance is not null and not exists (
    select 1 from public.alliances a join public.holds h on h.user_id = me where a.id = alliance and a.realm = h.realm
  ) then
    raise exception 'No such alliance in your realm';
  end if;
  update public.holds set alliance_id = alliance, ai_alliance = case when alliance is null then ai_alliance else null end
   where user_id = me;
end $fn$;

-- ---------------------------------------------------------------------------
-- PvP: the attacker's game fights the defender's snapshot; the server checks
-- the rules and leaves the result for the defender to collect.
-- ---------------------------------------------------------------------------
create table public.pvp_reports (
  id bigint generated always as identity primary key,
  attacker_id uuid not null references public.profiles (id) on delete cascade,
  defender_id uuid not null references public.profiles (id) on delete cascade,
  attacker_won boolean not null,
  -- Losses the defender takes (troop id → count) and resources carried off.
  defender_losses jsonb not null default '{}'::jsonb,
  loot jsonb not null default '{}'::jsonb,
  report jsonb not null default '{}'::jsonb,
  collected boolean not null default false,
  created_at timestamptz not null default now(),
  check (attacker_id <> defender_id),
  check (octet_length(report::text) < 16000)
);
create index pvp_reports_defender_idx on public.pvp_reports (defender_id, collected);
create index pvp_reports_attacker_idx on public.pvp_reports (attacker_id, created_at desc);
alter table public.pvp_reports enable row level security;
create policy "see your battles" on public.pvp_reports for select to authenticated
  using (attacker_id = (select auth.uid()) or defender_id = (select auth.uid()));
revoke insert, update on public.pvp_reports from anon, authenticated;

create function public.attack_hold(target uuid, attacker_won boolean, defender_losses jsonb, loot jsonb, report jsonb)
returns bigint
language plpgsql security definer set search_path = '' as $fn$
declare
  me uuid := (select auth.uid());
  a public.holds;
  d public.holds;
  r text;
  rid bigint;
begin
  select * into a from public.holds where user_id = me;
  select * into d from public.holds where user_id = target;
  if a.user_id is null or d.user_id is null then raise exception 'No such hold'; end if;
  if a.realm <> d.realm then raise exception 'That hold is in another realm'; end if;
  if d.shield_until is not null and d.shield_until > now() then raise exception 'That hold is under a peace shield'; end if;
  if a.alliance_id is not null and a.alliance_id = d.alliance_id then raise exception 'You cannot attack your own alliance'; end if;
  if exists (select 1 from public.pvp_reports where attacker_id = me and defender_id = target
             and created_at > now() - interval '10 minutes') then
    raise exception 'Let your warriors rest before attacking this hold again';
  end if;
  -- Loot can never exceed 30 % of what the defender had open to raiders at their last sync.
  for r in select * from jsonb_object_keys(loot) loop
    if r not in ('food', 'timber', 'iron', 'silver')
       or (loot->>r)::numeric < 0
       or (loot->>r)::numeric > coalesce((d.defence->'lootable'->>r)::numeric, 0) * 0.3 + 1 then
      raise exception 'Loot is out of bounds';
    end if;
  end loop;
  if not attacker_won and loot <> '{}'::jsonb then raise exception 'Only the winner takes loot'; end if;
  insert into public.pvp_reports (attacker_id, defender_id, attacker_won, defender_losses, loot, report)
    values (me, target, attacker_won, defender_losses, loot, report) returning id into rid;
  -- A beaten hold gets a short peace shield.
  if attacker_won then update public.holds set shield_until = now() + interval '30 minutes' where user_id = target; end if;
  return rid;
end $fn$;

-- The defender's game collects what happened while they were away (and marks it collected).
create function public.collect_pvp() returns setof public.pvp_reports
language sql security definer set search_path = '' as $fn$
  update public.pvp_reports set collected = true
   where defender_id = (select auth.uid()) and not collected
  returning *
$fn$;

-- ---------------------------------------------------------------------------
-- King's War: realm against realm every Saturday 12:00–14:00 UTC
-- ---------------------------------------------------------------------------
create table public.war_points (
  week integer not null,
  realm integer not null check (realm between 1 and 4),
  user_id uuid not null references public.profiles (id) on delete cascade,
  points bigint not null default 0 check (points >= 0),
  primary key (week, realm, user_id)
);
alter table public.war_points enable row level security;
create policy "everyone sees war points" on public.war_points for select to authenticated using (true);
revoke insert, update on public.war_points from anon, authenticated;

create function public.add_war_points(points integer) returns bigint
language plpgsql security definer set search_path = '' as $fn$
declare
  me uuid := (select auth.uid());
  h public.holds;
  t timestamp := now() at time zone 'utc';
  wk integer := floor(extract(epoch from now()) / 604800)::int;
  total bigint;
begin
  if extract(dow from t) <> 6 or extract(hour from t) not between 12 and 13 then
    raise exception 'The King''s War is not on now';
  end if;
  if points <= 0 or points > 5000 then raise exception 'Points are out of bounds'; end if;
  select * into h from public.holds where user_id = me;
  if not found then raise exception 'Take your place in the realm first'; end if;
  insert into public.war_points (week, realm, user_id, points) values (wk, h.realm, me, points)
  on conflict (week, realm, user_id) do update set points = public.war_points.points + excluded.points
  returning public.war_points.points into total;
  return total;
end $fn$;

create view public.war_scores with (security_invoker = true) as
  select week, realm, sum(points)::bigint as points, count(*)::int as players
  from public.war_points group by week, realm;

-- ---------------------------------------------------------------------------
-- Permissions on the functions
-- ---------------------------------------------------------------------------
revoke execute on function public.claim_home(integer, jsonb), public.create_alliance(text, text),
  public.join_alliance(uuid), public.attack_hold(uuid, boolean, jsonb, jsonb, jsonb), public.collect_pvp(),
  public.add_war_points(integer) from public, anon;
grant execute on function public.claim_home(integer, jsonb), public.create_alliance(text, text),
  public.join_alliance(uuid), public.attack_hold(uuid, boolean, jsonb, jsonb, jsonb), public.collect_pvp(),
  public.add_war_points(integer) to authenticated;
