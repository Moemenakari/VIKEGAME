-- Ten saga alliances per realm (the Alliance VS pairs them 1 v 2 … 9 v 10).
-- Adds the alliance chats of the four new ones and lets a hold belong to any of the ten.

insert into public.channels (id, kind, name)
select
  ('00000000-0000-0000-00' || lpad(r::text, 2, '0') || '-0000000000' || lpad(a::text, 2, '0'))::uuid,
  'clan',
  (array['[ORK] Jarls of Orkney', '[JOR] Kings of Jórvík', '[RUD] Northmen of Rouen', '[GUT] Gutar of Gotland'])[a - 6]
from generate_series(1, 4) r, generate_series(7, 10) a
on conflict (id) do nothing;

alter table public.holds drop constraint if exists holds_ai_alliance_check;
alter table public.holds add constraint holds_ai_alliance_check check (ai_alliance between 0 and 9);

-- Older clients still call join_alliance_chat; it now accepts all ten alliances.
create or replace function public.join_alliance_chat(realm integer, alliance integer) returns uuid
language plpgsql security definer set search_path = '' as $fn$
declare
  me uuid := (select auth.uid());
  cid uuid;
begin
  if me is null or not exists (select 1 from public.profiles where id = me) then
    raise exception 'Create your profile first';
  end if;
  if alliance is not null and (realm not between 1 and 4 or alliance not between 0 and 9) then
    raise exception 'No such alliance';
  end if;
  delete from public.channel_members m
   where m.user_id = me
     and m.channel_id in (select c.id from public.channels c where c.kind = 'clan');
  if alliance is null then
    return null;
  end if;
  cid := ('00000000-0000-0000-00' || lpad(realm::text, 2, '0') || '-0000000000' || lpad((alliance + 1)::text, 2, '0'))::uuid;
  insert into public.channel_members (channel_id, user_id) values (cid, me);
  return cid;
end $fn$;
revoke execute on function public.join_alliance_chat(integer, integer) from public, anon;
grant execute on function public.join_alliance_chat(integer, integer) to authenticated;
