-- Security smoke test for the chat schema. Run it in the SQL editor (or via the Supabase MCP):
-- it creates three throw-away players, acts as each of them, prints what was allowed or
-- refused, and ROLLS BACK so nothing is left behind.
begin;
insert into auth.users (id, instance_id, email, aud, role) values
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000000','a@test.local','authenticated','authenticated'),
 ('22222222-2222-2222-2222-222222222222','00000000-0000-0000-0000-000000000000','b@test.local','authenticated','authenticated'),
 ('33333333-3333-3333-3333-333333333333','00000000-0000-0000-0000-000000000000','c@test.local','authenticated','authenticated');
insert into public.profiles(id, display_name) values
 ('11111111-1111-1111-1111-111111111111','Astrid'),
 ('22222222-2222-2222-2222-222222222222','Bjorn'),
 ('33333333-3333-3333-3333-333333333333','Eirik');
create temp table r(n serial, step text, result text);
grant all on r to authenticated; grant usage on sequence r_n_seq to authenticated;
create temp table ids(k text primary key, v uuid); grant all on ids to authenticated;
set local role authenticated;

-- Astrid
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
do $$ begin update public.profiles set vip_points = 9999 where id = auth.uid(); insert into r(step,result) values('cheat VIP','ALLOWED (bad)'); exception when others then insert into r(step,result) values('cheat VIP → denied', sqlerrm); end $$;
do $$ begin insert into public.profiles(id, display_name) values ('33333333-3333-3333-3333-333333333333','Fake'); insert into r(step,result) values('profile for another player','ALLOWED (bad)'); exception when others then insert into r(step,result) values('profile for another player → denied', sqlerrm); end $$;
insert into public.messages(channel_id, body) values ('00000000-0000-0000-0000-000000000001','Hail, realm!');
do $$ begin insert into public.messages(channel_id, body) values ('00000000-0000-0000-0000-000000000001','again'); insert into r(step,result) values('spam','ALLOWED (bad)'); exception when others then insert into r(step,result) values('spam → slow mode', sqlerrm); end $$;
do $$ begin perform public.create_group('Raiders', array[]::uuid[]); insert into r(step,result) values('group at VIP 0','ALLOWED (bad)'); exception when others then insert into r(step,result) values('group at VIP 0 → denied', sqlerrm); end $$;
insert into r(step,result) values('friend request', public.send_friend_request('22222222-2222-2222-2222-222222222222'));

-- Bjorn accepts, opens a DM, tries an image at VIP 0 (before any text, so slow mode does not interfere)
select set_config('request.jwt.claims','{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select public.respond_friend_request('11111111-1111-1111-1111-111111111111', true);
insert into ids values('dm', public.open_dm('11111111-1111-1111-1111-111111111111'));
do $$ begin insert into public.messages(channel_id, image_path) values ((select v from ids where k='dm'), (select v from ids where k='dm')::text || '/22222222-2222-2222-2222-222222222222/x.webp'); insert into r(step,result) values('image at VIP 0','ALLOWED (bad)'); exception when others then insert into r(step,result) values('image at VIP 0 → denied', sqlerrm); end $$;
insert into public.messages(channel_id, body) values ((select v from ids where k='dm'),'Shit, the draugr are back');
insert into r(step,result) values('word filter', (select body from public.messages where channel_id=(select v from ids where k='dm') order by id desc limit 1));

-- Eirik is a stranger
select set_config('request.jwt.claims','{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
insert into r(step,result) values('stranger reads DM (expect 0)', (select count(*)::text from public.messages where channel_id=(select v from ids where k='dm')));
insert into r(step,result) values('stranger reads realm (expect 1)', (select count(*)::text from public.messages where channel_id='00000000-0000-0000-0000-000000000001'));

-- Astrid reaches VIP 2 (server side) and creates a group with a friend and a stranger
reset role;
update public.profiles set vip_points = 120 where id = '11111111-1111-1111-1111-111111111111';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
insert into ids values('grp', public.create_group('Raiders', array['22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333']::uuid[]));
insert into r(step,result) values('group members (expect 2: no strangers)', (select count(*)::text from public.channel_members where channel_id=(select v from ids where k='grp')));
do $$ begin perform public.are_friends('22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333'); insert into r(step,result) values('probe others'' friendships','ALLOWED (bad)'); exception when others then insert into r(step,result) values('probe others'' friendships → denied', sqlerrm); end $$;

-- Bjorn blocks Astrid
select set_config('request.jwt.claims','{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
insert into public.blocks(blocked_id) values ('11111111-1111-1111-1111-111111111111');
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
do $$ begin insert into public.messages(channel_id, body) values ((select v from ids where k='dm'),'hello?'); insert into r(step,result) values('DM after block','ALLOWED (bad)'); exception when others then insert into r(step,result) values('DM after block → denied', sqlerrm); end $$;

reset role;
select step, result from r order by n;
rollback;
