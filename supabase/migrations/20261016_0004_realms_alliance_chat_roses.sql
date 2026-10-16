-- Realm (server) chats 1–4, one alliance chat per alliance per realm, and roses as a reaction.
-- Alliance chat membership is set only through join_alliance_chat (security definer),
-- so a player can never read an alliance chat they did not join.

update public.channels set name = 'Realm #1 Uppsala' where id = '00000000-0000-0000-0000-000000000001';
insert into public.channels (id, kind, name) values
  ('00000000-0000-0000-0000-000000000002', 'realm', 'Realm #2 Jelling'),
  ('00000000-0000-0000-0000-000000000003', 'realm', 'Realm #3 Hlaðir'),
  ('00000000-0000-0000-0000-000000000004', 'realm', 'Realm #4 Dyflin')
on conflict (id) do nothing;

-- Alliance chats: id 00000000-0000-0000-00RR-0000000000AA (RR = realm, AA = alliance index + 1).
insert into public.channels (id, kind, name)
select
  ('00000000-0000-0000-00' || lpad(r::text, 2, '0') || '-0000000000' || lpad(a::text, 2, '0'))::uuid,
  'clan',
  (array['[SVE] Svear of Uppsala', '[JOM] Jómsvíkingar', '[VAR] Væringjar', '[MIK] The Great Army',
         '[DYF] Norse of Dyflin', '[HLA] Jarls of Hlaðir'])[a]
from generate_series(1, 4) r, generate_series(1, 6) a
on conflict (id) do nothing;

create or replace function public.join_alliance_chat(realm integer, alliance integer) returns uuid
language plpgsql security definer set search_path = '' as $fn$
declare
  me uuid := (select auth.uid());
  cid uuid;
begin
  if me is null or not exists (select 1 from public.profiles where id = me) then
    raise exception 'Create your profile first';
  end if;
  if alliance is not null and (realm not between 1 and 4 or alliance not between 0 and 5) then
    raise exception 'No such alliance';
  end if;
  -- A player sits in one alliance chat at a time: leave the old one first.
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

-- Roses: players can gift a rose to a message (owner request).
alter table public.reactions drop constraint if exists reactions_emoji_check;
alter table public.reactions add constraint reactions_emoji_check
  check (emoji in ('👍', '⚔️', '🛡️', '😂', '❤️', '🔥', '🌹'));
