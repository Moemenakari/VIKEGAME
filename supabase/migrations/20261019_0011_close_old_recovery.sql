-- The 7-argument request_recovery is replaced by the 10-argument one (security answers);
-- nobody may call the old one any more.
revoke execute on function public.request_recovery(text, bigint, integer, text, text, text, text) from public, anon, authenticated;
