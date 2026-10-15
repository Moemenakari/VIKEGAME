-- Jarlheim M3.6 — accounts, friends, chat channels, messages, VIP (GDD §19–20).
-- Every table has row-level security: players can only read what they are allowed to read,
-- and every write that needs a rule (VIP limits, friends-only, slow mode) goes through
-- a SECURITY DEFINER function or a trigger, never through trust in the client.

-- ---------------------------------------------------------------------------
-- Profiles & VIP
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 3 and 20),
  vip_points integer not null default 0 check (vip_points >= 0),
  vip_level integer not null default 0 check (vip_level between 0 and 5),
  last_daily_claim date,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index profiles_display_name_key on public.profiles (lower(display_name));

-- VIP 1–5 thresholds (GDD §20). Points come from daily logins (server clock), later from events.
create function public.vip_level_for(points integer) returns integer
language sql immutable set search_path = '' as $$
  select case
    when points >= 1500 then 5
    when points >= 700 then 4
    when points >= 300 then 3
    when points >= 100 then 2
    when points >= 30 then 1
    else 0 end
$$;

create function public.profiles_sync_vip() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.vip_level := public.vip_level_for(new.vip_points);
  return new;
end $$;
create trigger profiles_sync_vip before insert or update of vip_points on public.profiles
  for each row execute function public.profiles_sync_vip();

alter table public.profiles enable row level security;
create policy "players can see profiles" on public.profiles for select to authenticated using (true);
create policy "players create their own profile" on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));
create policy "players edit their own profile" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- Players may only ever set their name; VIP and timestamps are server-controlled.
revoke insert, update on public.profiles from anon, authenticated;
grant insert (id, display_name), update (display_name) on public.profiles to authenticated;

-- How many groups (and how big) a VIP level may create (GDD §20).
create function public.vip_group_limits(level integer, out max_groups integer, out max_members integer)
language sql immutable set search_path = '' as $$
  select (array[0, 1, 2, 3, 5, 8])[level + 1], (array[0, 10, 20, 30, 50, 100])[level + 1]
$$;

-- ---------------------------------------------------------------------------
-- Friends & blocks
-- ---------------------------------------------------------------------------
create table public.friend_requests (
  from_id uuid not null references public.profiles (id) on delete cascade,
  to_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (from_id, to_id),
  check (from_id <> to_id)
);
create index friend_requests_to_idx on public.friend_requests (to_id);
alter table public.friend_requests enable row level security;
create policy "see your own friend links" on public.friend_requests for select to authenticated
  using ((select auth.uid()) in (from_id, to_id));
revoke insert, update, delete on public.friend_requests from anon, authenticated;

create table public.blocks (
  blocker_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.blocks enable row level security;
create policy "see your blocks" on public.blocks for select to authenticated using (blocker_id = (select auth.uid()));
create policy "block someone" on public.blocks for insert to authenticated with check (blocker_id = (select auth.uid()));
create policy "unblock someone" on public.blocks for delete to authenticated using (blocker_id = (select auth.uid()));

create function public.is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  )
$$;

create function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.friend_requests
    where status = 'accepted' and ((from_id = a and to_id = b) or (from_id = b and to_id = a))
  )
$$;

-- ---------------------------------------------------------------------------
-- Channels: realm (everyone), clan (M7), group (invited), dm (two players)
-- ---------------------------------------------------------------------------
create table public.channels (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('realm', 'clan', 'group', 'dm')),
  name text check (name is null or char_length(name) between 1 and 40),
  owner_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index channels_owner_idx on public.channels (owner_id);

create table public.channel_members (
  channel_id uuid not null references public.channels (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  last_read_at timestamptz not null default now(),
  joined_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);
create index channel_members_user_idx on public.channel_members (user_id);

create function public.is_member(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.channel_members where channel_id = cid and user_id = (select auth.uid()))
$$;

create function public.can_read_channel(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.channels c
    where c.id = cid and (c.kind = 'realm' or exists (
      select 1 from public.channel_members m where m.channel_id = cid and m.user_id = (select auth.uid())
    ))
  )
$$;

-- Images: VIP 2+ in private, group and clan chats; VIP 4+ in Realm chat (GDD §19.4, §20).
create function public.can_send_image(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case when c.kind = 'realm' then p.vip_level >= 4 else p.vip_level >= 2 end
    from public.channels c, public.profiles p
    where c.id = cid and p.id = (select auth.uid())
  ), false) and public.can_read_channel(cid)
$$;

alter table public.channels enable row level security;
create policy "see channels you can read" on public.channels for select to authenticated
  using (public.can_read_channel(id));
revoke insert, update, delete on public.channels from anon, authenticated;

alter table public.channel_members enable row level security;
create policy "see members of your channels" on public.channel_members for select to authenticated
  using (public.is_member(channel_id));
create policy "mark your channel read" on public.channel_members for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke insert, update, delete on public.channel_members from anon, authenticated;
grant update (last_read_at) on public.channel_members to authenticated;

-- The one Realm channel everybody can read.
insert into public.channels (id, kind, name)
values ('00000000-0000-0000-0000-000000000001', 'realm', 'Realm of Jarlheim');

-- ---------------------------------------------------------------------------
-- Messages, reactions, reports
-- ---------------------------------------------------------------------------
create table public.messages (
  id bigint generated always as identity primary key,
  channel_id uuid not null references public.channels (id) on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null default '' check (char_length(body) <= 500),
  image_path text,
  card jsonb,
  reply_to bigint references public.messages (id) on delete set null,
  created_at timestamptz not null default now(),
  check (char_length(body) > 0 or image_path is not null or card is not null)
);
create index messages_channel_created_idx on public.messages (channel_id, created_at desc);
create index messages_sender_idx on public.messages (sender_id, created_at desc);
create index messages_reply_idx on public.messages (reply_to);

create table public.banned_words (word text primary key);
alter table public.banned_words enable row level security; -- no policies: server use only
insert into public.banned_words (word) values ('fuck'), ('shit'), ('bitch'), ('cunt'), ('nigger'), ('faggot');

-- Slow mode, DM blocks, image paths and the word filter, enforced on the server.
create function public.messages_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  ch_kind text;
  last_at timestamptz;
  w text;
begin
  new.sender_id := (select auth.uid());
  new.created_at := now();
  select kind into ch_kind from public.channels where id = new.channel_id;

  select max(created_at) into last_at from public.messages
   where sender_id = new.sender_id and channel_id = new.channel_id;
  if last_at is not null and now() - last_at < (case when ch_kind = 'realm' then interval '3 seconds' else interval '500 milliseconds' end) then
    raise exception 'Slow down: wait a moment before sending again' using errcode = 'P0001';
  end if;

  if ch_kind = 'dm' and exists (
    select 1 from public.channel_members m
    where m.channel_id = new.channel_id and m.user_id <> new.sender_id
      and public.is_blocked_between(m.user_id, new.sender_id)
  ) then
    raise exception 'You cannot message this player' using errcode = 'P0001';
  end if;

  if new.image_path is not null and split_part(new.image_path, '/', 1) <> new.channel_id::text then
    raise exception 'Image does not belong to this channel' using errcode = 'P0001';
  end if;

  for w in select word from public.banned_words loop
    new.body := regexp_replace(new.body, '\m' || w || '\M', repeat('*', char_length(w)), 'gi');
  end loop;
  return new;
end $$;
create trigger messages_before_insert before insert on public.messages
  for each row execute function public.messages_before_insert();

alter table public.messages enable row level security;
create policy "read messages in your channels" on public.messages for select to authenticated
  using (public.can_read_channel(channel_id));
create policy "send messages in your channels" on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.can_read_channel(channel_id)
    and (image_path is null or public.can_send_image(channel_id))
  );
create policy "delete your own messages" on public.messages for delete to authenticated
  using (sender_id = (select auth.uid()));
revoke update on public.messages from anon, authenticated;

create table public.reactions (
  message_id bigint not null references public.messages (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  emoji text not null check (emoji in ('👍', '⚔️', '🛡️', '😂', '❤️', '🔥')),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);
create index reactions_user_idx on public.reactions (user_id);
alter table public.reactions enable row level security;
create policy "see reactions you can read" on public.reactions for select to authenticated
  using (exists (select 1 from public.messages m where m.id = message_id));
create policy "react to messages you can read" on public.reactions for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.messages m where m.id = message_id));
create policy "remove your reaction" on public.reactions for delete to authenticated
  using (user_id = (select auth.uid()));

create table public.reports (
  id bigint generated always as identity primary key,
  reporter_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  message_id bigint references public.messages (id) on delete set null,
  reason text not null check (char_length(reason) between 1 and 200),
  created_at timestamptz not null default now()
);
create index reports_reporter_idx on public.reports (reporter_id);
create index reports_message_idx on public.reports (message_id);
alter table public.reports enable row level security;
create policy "file a report" on public.reports for insert to authenticated with check (reporter_id = (select auth.uid()));
create policy "see your reports" on public.reports for select to authenticated using (reporter_id = (select auth.uid()));

-- Live delivery of new messages and reactions (Realtime respects the policies above).
alter publication supabase_realtime add table public.messages, public.reactions;

-- ---------------------------------------------------------------------------
-- Actions (RPC)
-- ---------------------------------------------------------------------------
create function public.claim_daily_login() returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare p public.profiles;
begin
  update public.profiles
     set vip_points = vip_points + 10, last_daily_claim = current_date, last_seen_at = now()
   where id = (select auth.uid()) and (last_daily_claim is null or last_daily_claim < current_date)
  returning * into p;
  if p.id is null then
    select * into p from public.profiles where id = (select auth.uid());
  end if;
  return p;
end $$;

create function public.touch_presence() returns void
language sql security definer set search_path = '' as $$
  update public.profiles set last_seen_at = now() where id = (select auth.uid())
$$;

create function public.send_friend_request(target uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid());
begin
  if target = me then raise exception 'That is you' using errcode = 'P0001'; end if;
  if public.is_blocked_between(me, target) then raise exception 'You cannot add this player' using errcode = 'P0001'; end if;
  -- They already asked you: accept instead.
  if exists (select 1 from public.friend_requests where from_id = target and to_id = me) then
    update public.friend_requests set status = 'accepted' where from_id = target and to_id = me;
    return 'accepted';
  end if;
  insert into public.friend_requests (from_id, to_id) values (me, target) on conflict do nothing;
  return 'pending';
end $$;

create function public.respond_friend_request(requester uuid, accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if accept then
    update public.friend_requests set status = 'accepted' where from_id = requester and to_id = (select auth.uid());
  else
    delete from public.friend_requests where from_id = requester and to_id = (select auth.uid());
  end if;
end $$;

create function public.remove_friend(other uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.friend_requests
   where (from_id = (select auth.uid()) and to_id = other) or (from_id = other and to_id = (select auth.uid()))
$$;

create function public.open_dm(other uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  cid uuid;
begin
  if other = me then raise exception 'That is you' using errcode = 'P0001'; end if;
  if public.is_blocked_between(me, other) then raise exception 'You cannot message this player' using errcode = 'P0001'; end if;
  select c.id into cid from public.channels c
   where c.kind = 'dm'
     and exists (select 1 from public.channel_members where channel_id = c.id and user_id = me)
     and exists (select 1 from public.channel_members where channel_id = c.id and user_id = other)
   limit 1;
  if cid is null then
    insert into public.channels (kind) values ('dm') returning id into cid;
    insert into public.channel_members (channel_id, user_id) values (cid, me), (cid, other);
  end if;
  return cid;
end $$;

create function public.create_group(group_name text, member_ids uuid[]) returns uuid
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
  if owned >= lim.max_groups then
    raise exception 'Your VIP level allows % group chats (reach VIP 1 to create one)', lim.max_groups using errcode = 'P0001';
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

create function public.invite_to_group(cid uuid, member uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  lvl integer;
  lim record;
  size integer;
begin
  if not exists (select 1 from public.channels where id = cid and kind = 'group' and owner_id = me) then
    raise exception 'Only the group owner can invite' using errcode = 'P0001';
  end if;
  if not public.are_friends(me, member) then raise exception 'You can only invite friends' using errcode = 'P0001'; end if;
  select vip_level into lvl from public.profiles where id = me;
  select * into lim from public.vip_group_limits(coalesce(lvl, 0));
  select count(*) into size from public.channel_members where channel_id = cid;
  if size >= lim.max_members then raise exception 'The group is full' using errcode = 'P0001'; end if;
  insert into public.channel_members (channel_id, user_id) values (cid, member) on conflict do nothing;
end $$;

create function public.leave_channel(cid uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid());
begin
  delete from public.channel_members where channel_id = cid and user_id = me;
  -- An empty group or DM is removed; an owner leaving hands the group to the next member.
  if not exists (select 1 from public.channel_members where channel_id = cid) then
    delete from public.channels where id = cid and kind in ('group', 'dm');
  else
    update public.channels c set owner_id = (
      select user_id from public.channel_members where channel_id = cid order by joined_at limit 1
    ) where c.id = cid and c.owner_id = me;
  end if;
end $$;

-- Your chat list in ONE query: each channel with its last message and unread count
-- (the "one trip" rule: never one query per channel).
create function public.my_channels()
returns table (
  id uuid, kind text, name text, owner_id uuid, other_name text,
  last_body text, last_at timestamptz, unread integer
)
language sql stable security definer set search_path = '' as $$
  with mine as (
    select c.*, m.last_read_at from public.channels c
    join public.channel_members m on m.channel_id = c.id and m.user_id = (select auth.uid())
    union all
    select c.*, null::timestamptz from public.channels c where c.kind = 'realm'
  )
  select
    mine.id, mine.kind, mine.name, mine.owner_id,
    (select p.display_name from public.channel_members o join public.profiles p on p.id = o.user_id
      where mine.kind = 'dm' and o.channel_id = mine.id and o.user_id <> (select auth.uid()) limit 1),
    last.body, last.created_at,
    (select count(*)::integer from public.messages x
      where x.channel_id = mine.id and mine.last_read_at is not null and x.created_at > mine.last_read_at
        and x.sender_id <> (select auth.uid()))
  from mine
  left join lateral (
    select body, created_at from public.messages x where x.channel_id = mine.id order by created_at desc limit 1
  ) last on true
  order by mine.kind = 'realm' desc, last.created_at desc nulls last
$$;

revoke execute on all functions in schema public from anon, public;
grant execute on function
  public.claim_daily_login(), public.touch_presence(), public.send_friend_request(uuid),
  public.respond_friend_request(uuid, boolean), public.remove_friend(uuid), public.open_dm(uuid),
  public.create_group(text, uuid[]), public.invite_to_group(uuid, uuid), public.leave_channel(uuid),
  public.my_channels(), public.can_read_channel(uuid), public.can_send_image(uuid), public.is_member(uuid),
  public.vip_level_for(integer), public.vip_group_limits(integer), public.are_friends(uuid, uuid),
  public.is_blocked_between(uuid, uuid)
to authenticated;

-- ---------------------------------------------------------------------------
-- Image storage: private bucket, path = <channel_id>/<user_id>/<file>.webp
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-images', 'chat-images', false, 2097152, array['image/webp', 'image/jpeg', 'image/png']);

create policy "read chat images in your channels" on storage.objects for select to authenticated
  using (bucket_id = 'chat-images' and public.can_read_channel(((storage.foldername(name))[1])::uuid));
create policy "upload chat images where VIP allows" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'chat-images'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and public.can_send_image(((storage.foldername(name))[1])::uuid)
  );
