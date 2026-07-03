-- TypeMe Studio patch: anonymous response samples.
-- Run this in the Supabase SQL editor if /api/studio/dashboard reports
-- PGRST205 for public.persona_response_samples.

create table if not exists public.persona_response_samples (
  id uuid primary key default gen_random_uuid(),
  sample_id text not null unique,
  schema_version text not null default 'persona_sample_v1',
  app_version text,
  question_version text,
  prompt_version text,
  final_type text,
  traditional_type text,
  ai_type text,
  answer_quality_score integer,
  consent_scope text not null default 'anonymous_research',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists persona_response_samples_final_type_idx
  on public.persona_response_samples (final_type);

create index if not exists persona_response_samples_created_at_idx
  on public.persona_response_samples (created_at desc);

alter table public.persona_response_samples enable row level security;

-- No public policies are required. TypeMe writes and reads this table only from
-- the Vercel serverless API with SUPABASE_SERVICE_ROLE_KEY.
