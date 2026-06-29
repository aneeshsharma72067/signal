-- Signal — remove dead deliveries table.
-- The deliveries table and deliver-note edge function were used in the old
-- delivery-based feed model. Since the global feed migration (0002_global_feed.sql),
-- they are completely unused. Removing them reduces our attack surface and database clutter.

drop table if exists public.deliveries cascade;
