-- TypeMe sample metadata patch.
-- Additive only: keeps existing persona_response_samples rows and table name.
-- Run in Supabase SQL Editor after supabase/schema.sql.

alter table public.persona_response_samples
  add column if not exists client_version text,
  add column if not exists source_locale text,
  add column if not exists analysis_status text not null default 'unknown',
  add column if not exists quality_flags jsonb not null default '{}'::jsonb;

create index if not exists persona_response_samples_analysis_status_idx
  on public.persona_response_samples (analysis_status);

create index if not exists persona_response_samples_quality_flags_gin_idx
  on public.persona_response_samples using gin (quality_flags);

grant select, insert, update, delete on public.persona_response_samples to service_role;

-- RLS remains enabled. The app writes through the server-side service role only.
