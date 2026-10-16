-- Customer service tickets, deleting your own account, and likes / roses received.

create table public.support_tickets (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  topic text not null check (topic in ('bug', 'account', 'payment', 'player', 'idea', 'other')),
  body text not null check (char_length(body) between 5 and 2000),
  -- Device and game version, to reproduce bugs (no personal data).
  meta jsonb not null default '{}'::jsonb check (octet_length(meta::text) < 2000),
  status text not null default 'open' check (status in ('open', 'answered', 'closed')),
  answer text,
  created_at timestamptz not null default now()
);
create index support_tickets_user_idx on public.support_tickets (user_id, created_at desc);
alter table public.support_tickets enable row level security;
create policy "see your tickets" on public.support_tickets for select to authenticated
  using (user_id = (select auth.uid()));
create policy "open a ticket" on public.support_tickets for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'open' and answer is null);
revoke update on public.support_tickets from anon, authenticated;

-- Likes and roses your messages have received, in one call.
create function public.my_social_stats() returns jsonb
language sql stable security definer set search_path = '' as $fn$
  select jsonb_build_object(
    'likes', (select count(*) from public.reactions r join public.messages m on m.id = r.message_id
              where m.sender_id = (select auth.uid()) and r.emoji in ('👍', '❤️') and r.user_id <> m.sender_id),
    'roses', (select count(*) from public.reactions r join public.messages m on m.id = r.message_id
              where m.sender_id = (select auth.uid()) and r.emoji = '🌹' and r.user_id <> m.sender_id),
    'messages', (select count(*) from public.messages where sender_id = (select auth.uid()))
  )
$fn$;

-- Deleting your account removes your sign-in and, through the foreign keys, your profile,
-- hold, messages, friends and reports (store rules require in-app account deletion).
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $fn$
begin
  if (select auth.uid()) is null then raise exception 'Not signed in'; end if;
  delete from auth.users where id = (select auth.uid());
end $fn$;

revoke execute on function public.my_social_stats(), public.delete_my_account() from public, anon;
grant execute on function public.my_social_stats(), public.delete_my_account() to authenticated;
