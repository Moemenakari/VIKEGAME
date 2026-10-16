-- Security smoke test for the online realm (0005). Run it in the SQL editor: two throw-away
-- players claim tiles, found and join an alliance, attack and collect; it ROLLS BACK at the end.
-- Expected: inserts/moves denied, taken tile skipped, greedy loot denied, repeat attack denied,
-- clan chat readable only after joining, reports collected once.
begin;
insert into auth.users (id, instance_id, email, aud, role) values
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000000','a@test.local','authenticated','authenticated'),
 ('22222222-2222-2222-2222-222222222222','00000000-0000-0000-0000-000000000000','b@test.local','authenticated','authenticated');
insert into public.profiles(id, display_name) values ('11111111-1111-1111-1111-111111111111','Astrid'),('22222222-2222-2222-2222-222222222222','Bjorn');
create temp table r(n serial, step text, result text);
grant all on r to authenticated; grant usage on sequence r_n_seq to authenticated;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
insert into r(step,result) values ('A claims home', public.claim_home(1, '[[5,5],[6,6]]')::text);
do $$ begin insert into public.holds(user_id,realm,x,y) values ('22222222-2222-2222-2222-222222222222',1,9,9); insert into r(step,result) values('insert hold for other','ALLOWED (bad)'); exception when others then insert into r(step,result) values('insert hold for other → denied', sqlerrm); end $$;
update public.holds set power = 500, hall = 6, defence = '{"lootable":{"food":1000}}' where user_id = '11111111-1111-1111-1111-111111111111';
do $$ begin update public.holds set x = 1 where user_id = '11111111-1111-1111-1111-111111111111'; insert into r(step,result) values('move own tile directly','ALLOWED (bad)'); exception when others then insert into r(step,result) values('move tile → denied', sqlerrm); end $$;
insert into r(step,result) values ('A creates alliance', (public.create_alliance('ABC','Hammers of Thor') is not null)::text);
select set_config('request.jwt.claims','{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
insert into r(step,result) values ('B claims (taken tile skipped)', public.claim_home(1, '[[5,5],[7,7]]')::text);
insert into r(step,result) values ('B sees A clan chat (expect false)', public.can_read_channel((select channel_id from public.alliances limit 1))::text);
do $$ begin perform public.attack_hold('11111111-1111-1111-1111-111111111111', true, '{}', '{"food":900}', '{}'); insert into r(step,result) values('greedy loot','ALLOWED (bad)'); exception when others then insert into r(step,result) values('greedy loot → denied', sqlerrm); end $$;
insert into r(step,result) values ('fair attack', public.attack_hold('11111111-1111-1111-1111-111111111111', true, '{"shieldwall-1":3}', '{"food":250}', '{}')::text);
do $$ begin perform public.attack_hold('11111111-1111-1111-1111-111111111111', false, '{}', '{}', '{}'); insert into r(step,result) values('attack again at once','ALLOWED (bad)'); exception when others then insert into r(step,result) values('attack again → denied', sqlerrm); end $$;
select public.join_alliance((select id from public.alliances limit 1));
insert into r(step,result) values ('B joined, reads clan chat', public.can_read_channel((select channel_id from public.alliances limit 1))::text);
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
insert into r(step,result) values ('A collects', (select count(*)::text from public.collect_pvp()));
insert into r(step,result) values ('A collects twice (expect 0)', (select count(*)::text from public.collect_pvp()));
reset role;
select step, result from r order by n;
rollback;
