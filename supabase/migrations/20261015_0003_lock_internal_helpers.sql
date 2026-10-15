-- Helpers only used inside SECURITY DEFINER functions and triggers: not callable from the API
-- (otherwise anyone could ask whether two other players are friends or have blocked each other).
revoke execute on function public.are_friends(uuid, uuid) from authenticated, anon, public;
revoke execute on function public.is_blocked_between(uuid, uuid) from authenticated, anon, public;
revoke execute on function public.messages_before_insert() from authenticated, anon, public;
revoke execute on function public.profiles_sync_vip() from authenticated, anon, public;
