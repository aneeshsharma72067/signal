-- Signal — self-service account deletion.
-- Problem: there is no way for a user to delete their own account. The client
-- holds only the anon key and cannot touch auth.users, so deletion was
-- impossible from the app. Self-service account deletion is also an App Store /
-- Play Store requirement — the app cannot ship without it.
--
-- Fix: a security-definer RPC that deletes the caller's own auth.users row.
-- The FK chain does the rest: auth.users → public.users (on delete cascade,
-- migration 0001) → voice_notes, reactions, follows, blocks, notifications all
-- cascade. Audio objects in Storage are left orphaned (best-effort, matching
-- deleteNote's existing behavior).
--
-- The function deletes strictly `auth.uid()`, so a caller can only ever delete
-- themselves. Execute is granted to authenticated only.
--
-- Run in the Supabase SQL editor (or `supabase db push`). Idempotent.

create or replace function public.delete_own_account()
returns void
language sql
security definer
set search_path = public, auth
as $$
  delete from auth.users where id = auth.uid();
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
