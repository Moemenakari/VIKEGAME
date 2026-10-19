-- Hardening before the repository goes public (owner request: "protect my projects").
-- Battles are still fought on the attacker's device, so the server bounds what a report may claim.

create or replace function public.attack_hold(target uuid, attacker_won boolean, defender_losses jsonb, loot jsonb, report jsonb)
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
  if me = target then raise exception 'You cannot attack yourself'; end if;
  if a.realm <> d.realm then raise exception 'That hold is in another realm'; end if;
  if d.shield_until is not null and d.shield_until > now() then raise exception 'That hold is under a peace shield'; end if;
  if a.alliance_id is not null and a.alliance_id = d.alliance_id then raise exception 'You cannot attack your own alliance'; end if;
  if exists (select 1 from public.pvp_reports where attacker_id = me and defender_id = target
             and created_at > now() - interval '10 minutes') then
    raise exception 'Let your warriors rest before attacking this hold again';
  end if;
  -- At most 30 attacks an hour, whoever the target.
  if (select count(*) from public.pvp_reports where attacker_id = me and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Your warriors need rest: too many attacks this hour';
  end if;
  -- A win against a hold more than three times stronger is not believable.
  if attacker_won and a.power * 3 < d.power then raise exception 'That result is not possible'; end if;
  if octet_length(coalesce(report, '{}'::jsonb)::text) > 20000 or jsonb_typeof(defender_losses) <> 'object' then
    raise exception 'The report is out of bounds';
  end if;
  -- The defender can lose only troops they had at their last sync: anything more is cut off.
  select coalesce(jsonb_object_agg(k, least(greatest(v::numeric, 0), coalesce((d.defence->'troops'->>k)::numeric, 0))), '{}'::jsonb)
    into defender_losses
    from jsonb_each_text(defender_losses) as e(k, v)
   where v ~ '^[0-9]+(\.[0-9]+)?$';
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
  if attacker_won then update public.holds set shield_until = now() + interval '30 minutes' where user_id = target; end if;
  return rid;
end $fn$;

-- War points: at most one award every 20 seconds and 200,000 per player per war.
alter table public.war_points add column if not exists last_at timestamptz;

create or replace function public.add_war_points(points integer) returns bigint
language plpgsql security definer set search_path = '' as $fn$
declare
  me uuid := (select auth.uid());
  h public.holds;
  t timestamp := now() at time zone 'utc';
  wk integer := floor(extract(epoch from now()) / 604800)::int;
  w public.war_points;
  total bigint;
begin
  if extract(dow from t) <> 6 or extract(hour from t) not between 12 and 13 then
    raise exception 'The King''s War is not on now';
  end if;
  if points <= 0 or points > 5000 then raise exception 'Points are out of bounds'; end if;
  select * into h from public.holds where user_id = me;
  if not found then raise exception 'Take your place in the realm first'; end if;
  select * into w from public.war_points where week = wk and realm = h.realm and user_id = me;
  if found and w.last_at is not null and w.last_at > now() - interval '20 seconds' then
    raise exception 'Too fast: wait a moment';
  end if;
  if found and w.points + points > 200000 then raise exception 'You have reached the war points limit'; end if;
  insert into public.war_points (week, realm, user_id, points, last_at) values (wk, h.realm, me, points, now())
  on conflict (week, realm, user_id) do update
    set points = public.war_points.points + excluded.points, last_at = now()
  returning public.war_points.points into total;
  return total;
end $fn$;
