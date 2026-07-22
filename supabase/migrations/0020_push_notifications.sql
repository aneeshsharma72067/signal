-- Signal — push notifications (Android, Expo Push).
-- Problem: activity (reactions, follows, notes, replies, DMs) is only visible
-- while the app is open. Nothing reaches a user who has the app backgrounded or
-- closed — the same retention gap migration 0013 opened the in-app bell for,
-- but off-device.
--
-- Design (reuses existing fan-out — no new notification logic):
--   * push_tokens          — one row per (user, device token). A user may have
--                            several devices; the Expo token is the PK.
--   * notify_push_*         — AFTER INSERT triggers on the two tables that
--                            already represent a delivered event:
--                              - public.notifications  (migration 0013 already
--                                fans out reaction/follow/note/reply, ONE row
--                                per recipient — so we notify per row, no
--                                re-fan-out here)
--                              - public.messages        (1:1 voice DM, 0019)
--                            Each trigger POSTs the new row to the `push` edge
--                            function via pg_net; the function resolves tokens
--                            and calls the Expo Push API.
--
-- Secrets: the trigger reads the project URL + service-role key from Vault
-- (never hardcoded — this file is committed). Create them once (see the
-- migration footer / the setup notes returned to the developer).
--
-- Idempotent. Run via `supabase db push` or the SQL editor.

-- ─────────────────────────────────────────────────────────────
-- 0. Extensions: pg_net for async outbound HTTP from triggers.
-- ─────────────────────────────────────────────────────────────
create extension if not exists pg_net with schema extensions;

-- ─────────────────────────────────────────────────────────────
-- 1. push_tokens: a device's Expo push token, owned by a user.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.push_tokens (
  token      text primary key,                 -- ExpoPushToken[...] — globally unique per device
  user_id    uuid not null references public.users (id) on delete cascade,
  platform   text not null default 'android' check (platform in ('android', 'ios')),
  updated_at timestamptz not null default now()
);

-- "all tokens for this recipient" — the only lookup the edge function does.
create index if not exists push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

-- A user may only see and manage their own device tokens. The edge function
-- reads across users via the service-role key (bypasses RLS).
create policy "push_tokens_select_own" on public.push_tokens
  for select to authenticated using (auth.uid() = user_id);

create policy "push_tokens_insert_own" on public.push_tokens
  for insert to authenticated with check (auth.uid() = user_id);

create policy "push_tokens_update_own" on public.push_tokens
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "push_tokens_delete_own" on public.push_tokens
  for delete to authenticated using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- 2. Helper: fire-and-forget POST of a row to the `push` edge function.
-- Reads the project URL + service-role key from Vault so no secret is
-- committed. security definer so it can read vault.decrypted_secrets.
-- pg_net is async: the trigger returns immediately, the HTTP call runs in the
-- background worker — a slow/erroring push never blocks the source INSERT.
-- ─────────────────────────────────────────────────────────────
create or replace function public.invoke_push(kind text, record jsonb)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  project_url text;
  service_key text;
begin
  select decrypted_secret into project_url
    from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into service_key
    from vault.decrypted_secrets where name = 'service_role_key';

  -- Secrets not configured yet → no-op rather than error, so INSERTs keep
  -- working before push is set up. (See setup notes.)
  if project_url is null or service_key is null then
    return;
  end if;

  perform net.http_post(
    url     := project_url || '/functions/v1/push',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || service_key
               ),
    body    := jsonb_build_object('kind', kind, 'record', record)
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 3. Trigger: in-app notification row → push. Covers reaction / follow /
-- note / reply — migration 0013/0016 already wrote ONE row per recipient.
-- ─────────────────────────────────────────────────────────────
create or replace function public.notify_push_on_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.invoke_push('notification', row_to_json(new)::jsonb);
  return new;
end;
$$;

drop trigger if exists notify_push_on_notification on public.notifications;
create trigger notify_push_on_notification
  after insert on public.notifications
  for each row execute function public.notify_push_on_notification();

-- ─────────────────────────────────────────────────────────────
-- 4. Trigger: new voice DM → push to the recipient. The message row only
-- carries sender + conversation; the edge function resolves the recipient.
-- ─────────────────────────────────────────────────────────────
create or replace function public.notify_push_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.invoke_push('message', row_to_json(new)::jsonb);
  return new;
end;
$$;

drop trigger if exists notify_push_on_message on public.messages;
create trigger notify_push_on_message
  after insert on public.messages
  for each row execute function public.notify_push_on_message();

-- ─────────────────────────────────────────────────────────────
-- Setup (run ONCE in the SQL editor — NOT committed, uses your real values):
--
--   select vault.create_secret('https://<PROJECT_REF>.supabase.co', 'project_url');
--   select vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key');
--
-- To rotate, use vault.update_secret(id, new_value).
-- ─────────────────────────────────────────────────────────────
