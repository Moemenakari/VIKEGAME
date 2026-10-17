-- Teleports move your hold on the server too (owner bug: after a refresh the hold jumped
-- back to the first spot it was given). The tile must be free in that realm.
create function public.move_home(p_realm integer, p_x integer, p_y integer) returns jsonb
language plpgsql security definer set search_path = '' as $fn$
declare
  me uuid := (select auth.uid());
begin
  if me is null then raise exception 'Not signed in'; end if;
  if p_realm not between 1 and 4 or p_x not between 0 and 40 or p_y not between 0 and 40 then
    raise exception 'That spot is outside the realm';
  end if;
  begin
    update public.holds set realm = p_realm, x = p_x, y = p_y, updated_at = now() where user_id = me;
  exception when unique_violation then
    raise exception 'Someone already lives there';
  end;
  return jsonb_build_object('realm', p_realm, 'x', p_x, 'y', p_y);
end $fn$;

revoke execute on function public.move_home(integer, integer, integer) from public, anon;
grant execute on function public.move_home(integer, integer, integer) to authenticated;
