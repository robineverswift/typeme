-- Persona Mirror V2 database foundation.
-- Safe to add before live integration. Secrets must stay server-side.

create extension if not exists pgcrypto;

create table if not exists public.test_sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'draft' check (status in ('draft', 'scored', 'analyzing', 'complete', 'failed')),
  answer_hash text,
  answers_json jsonb not null default '[]'::jsonb,
  open_answers_json jsonb not null default '[]'::jsonb,
  deterministic_result_json jsonb,
  ai_pack_json jsonb,
  persona_visual_json jsonb,
  prompt_version text,
  model_name text,
  generation_ms integer,
  error_message text
);

create table if not exists public.ai_analysis_cache (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  input_hash text not null unique,
  type_code text not null,
  prompt_version text not null,
  model_name text,
  ai_pack_json jsonb not null,
  persona_visual_json jsonb,
  latency_ms integer,
  token_estimate integer
);

create table if not exists public.analysis_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  session_id uuid references public.test_sessions(id) on delete set null,
  event_type text not null,
  message text,
  metadata_json jsonb not null default '{}'::jsonb,
  latency_ms integer
);

create table if not exists public.persona_types (
  id uuid primary key default gen_random_uuid(),
  type_code text not null unique,
  display_name text,
  short_description text,
  long_description text,
  keywords_json jsonb not null default '[]'::jsonb,
  strengths_json jsonb not null default '[]'::jsonb,
  risks_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.persona_visual_presets (
  id uuid primary key default gen_random_uuid(),
  type_code text not null,
  palette_json jsonb not null default '[]'::jsonb,
  motifs_json jsonb not null default '[]'::jsonb,
  dot_matrix_params_json jsonb not null default '{}'::jsonb,
  anime_style_params_json jsonb not null default '{}'::jsonb,
  background_field_params_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prompt_versions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version text not null,
  purpose text,
  prompt_text text not null,
  schema_json jsonb not null default '{}'::jsonb,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, version)
);

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

alter table public.prompt_versions
  add column if not exists updated_at timestamptz not null default now();

create index if not exists test_sessions_answer_hash_idx on public.test_sessions (answer_hash);
create index if not exists test_sessions_created_at_idx on public.test_sessions (created_at desc);
create index if not exists test_sessions_status_idx on public.test_sessions (status);

create index if not exists ai_analysis_cache_type_code_idx on public.ai_analysis_cache (type_code);
create index if not exists ai_analysis_cache_prompt_version_idx on public.ai_analysis_cache (prompt_version);

create index if not exists analysis_logs_session_id_idx on public.analysis_logs (session_id);
create index if not exists analysis_logs_event_type_idx on public.analysis_logs (event_type);
create index if not exists analysis_logs_created_at_idx on public.analysis_logs (created_at desc);

create index if not exists persona_visual_presets_type_code_idx on public.persona_visual_presets (type_code);
create index if not exists persona_types_updated_at_idx on public.persona_types (updated_at desc);
create index if not exists persona_visual_presets_updated_at_idx on public.persona_visual_presets (updated_at desc);
create index if not exists prompt_versions_name_active_idx on public.prompt_versions (name, is_active);
create index if not exists prompt_versions_is_active_idx on public.prompt_versions (is_active);
create index if not exists persona_response_samples_final_type_idx on public.persona_response_samples (final_type);
create index if not exists persona_response_samples_created_at_idx on public.persona_response_samples (created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_test_sessions_updated_at on public.test_sessions;
create trigger set_test_sessions_updated_at
before update on public.test_sessions
for each row execute function public.set_updated_at();

drop trigger if exists set_persona_types_updated_at on public.persona_types;
create trigger set_persona_types_updated_at
before update on public.persona_types
for each row execute function public.set_updated_at();

drop trigger if exists set_persona_visual_presets_updated_at on public.persona_visual_presets;
create trigger set_persona_visual_presets_updated_at
before update on public.persona_visual_presets
for each row execute function public.set_updated_at();

drop trigger if exists set_prompt_versions_updated_at on public.prompt_versions;
create trigger set_prompt_versions_updated_at
before update on public.prompt_versions
for each row execute function public.set_updated_at();

alter table public.test_sessions enable row level security;
alter table public.ai_analysis_cache enable row level security;
alter table public.analysis_logs enable row level security;
alter table public.persona_types enable row level security;
alter table public.persona_visual_presets enable row level security;
alter table public.prompt_versions enable row level security;
alter table public.persona_response_samples enable row level security;

-- No public policies yet. The app should use server-side access only.
-- Future Studio policies must be added after authentication is implemented.

-- == How to enable DB (future) ==
-- 1. Run this schema in Supabase SQL editor.
-- 2. Set env vars in Vercel dashboard:
--      SUPABASE_URL=https://<project>.supabase.co
--      SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
-- 3. The app detects these on startup via type_profile_storage.is_db_enabled().
--    Without them, all storage functions return None (safe no-op).
-- 4. The service role key is server-side only (Python). Never expose to frontend.
-- 5. When Studio authentication is ready, add per-role RLS policies.
