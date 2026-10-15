-- Clearer error when a player below VIP 1 tries to create a group.
create or replace function public.create_group(group_name text, member_ids uuid[]) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  lvl integer;
  lim record;
  owned integer;
  cid uuid;
  m uuid;
begin
  select vip_level into lvl from public.profiles where id = me;
  select * into lim from public.vip_group_limits(coalesce(lvl, 0));
  select count(*) into owned from public.channels where owner_id = me and kind = 'group';
  if lim.max_groups = 0 then
    raise exception 'Reach VIP 1 to create group chats' using errcode = 'P0001';
  end if;
  if owned >= lim.max_groups then
    raise exception 'Your VIP level allows % group chats', lim.max_groups using errcode = 'P0001';
  end if;
  if coalesce(array_length(member_ids, 1), 0) + 1 > lim.max_members then
    raise exception 'Your VIP level allows % members per group', lim.max_members using errcode = 'P0001';
  end if;
  insert into public.channels (kind, name, owner_id) values ('group', group_name, me) returning id into cid;
  insert into public.channel_members (channel_id, user_id, role) values (cid, me, 'owner');
  foreach m in array coalesce(member_ids, '{}') loop
    if m <> me and public.are_friends(me, m) and not public.is_blocked_between(me, m) then
      insert into public.channel_members (channel_id, user_id) values (cid, m) on conflict do nothing;
    end if;
  end loop;
  return cid;
end $$;
