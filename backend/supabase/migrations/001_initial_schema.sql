begin;

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text not null,
  password_hash text not null,
  role text not null constraint users_role_check
    check (role in ('admin', 'client')),
  plan text not null default 'free' constraint users_plan_check
    check (plan in ('free', 'starter', 'pro', 'elite')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  slug text unique not null,
  subdomain text unique,
  status text not null default 'draft' constraint quizzes_status_check
    check (status in ('draft', 'active', 'inactive')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  order_index integer not null constraint questions_order_index_check
    check (order_index >= 0),
  type text not null constraint questions_type_check
    check (
      type in (
        'multiple_choice',
        'text',
        'name',
        'email',
        'phone',
        'number'
      )
    ),
  title text not null,
  description text,
  variable_name text,
  is_required boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (quiz_id, order_index)
);

create table if not exists public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  order_index integer not null constraint question_options_order_index_check
    check (order_index >= 0),
  label text not null,
  value text not null,
  variable_value text,
  next_step text not null default 'default'
    constraint question_options_next_step_check
    check (next_step in ('default', 'question', 'final')),
  next_question_id uuid references public.questions(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (question_id, order_index)
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  public_token uuid unique not null default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  name text,
  email text,
  phone text,
  answers jsonb not null default '{}'::jsonb,
  variables jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}'::text[],
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  fbclid text,
  gclid text,
  completed boolean not null default false,
  completed_at timestamptz,
  cta_clicked boolean not null default false,
  checkout_clicked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quiz_integrations (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  type text not null constraint quiz_integrations_type_check
    check (
      type in (
        'activecampaign',
        'webhook',
        'pixel_facebook',
        'gtm',
        'ga4'
      )
  ),
  settings jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (quiz_id, type)
);

create table if not exists public.checkout_configs (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  provider text not null constraint checkout_configs_provider_check
    check (provider in ('hotmart', 'kiwify', 'eduzz', 'stripe', 'custom')),
  checkout_url text not null,
  url_template text not null,
  custom_params jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.final_page_blocks (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  type text not null constraint final_page_blocks_type_check
    check (
      type in (
        'title',
        'subtitle',
        'paragraph',
        'image',
        'video',
        'bullets',
        'testimonial',
        'cta_button',
        'checkout_button',
        'divider',
        'spacer'
      )
    ),
  order_index integer not null constraint final_page_blocks_order_index_check
    check (order_index >= 0),
  content jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (quiz_id, order_index)
);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  event_type text not null constraint analytics_events_type_check
    check (
      event_type in (
        'visit',
        'start',
        'complete',
        'cta_click',
        'checkout_click'
      )
    ),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.integration_logs (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid references public.quiz_integrations(id) on delete set null,
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  event text not null,
  status text not null constraint integration_logs_status_check
    check (status in ('success', 'error')),
  attempt integer not null default 1 constraint integration_logs_attempt_check
    check (attempt between 1 and 3),
  message text,
  response_status integer,
  created_at timestamptz not null default now()
);

create index if not exists quizzes_user_id_idx
  on public.quizzes(user_id);
create unique index if not exists users_email_lower_idx
  on public.users(lower(email));
create index if not exists questions_quiz_id_idx
  on public.questions(quiz_id);
create index if not exists question_options_question_id_idx
  on public.question_options(question_id);
create index if not exists question_options_next_question_id_idx
  on public.question_options(next_question_id);
create index if not exists leads_quiz_id_created_at_idx
  on public.leads(quiz_id, created_at desc);
create index if not exists leads_email_idx
  on public.leads(email)
  where email is not null;
create index if not exists leads_quiz_email_lower_idx
  on public.leads(quiz_id, lower(email))
  where email is not null;
create index if not exists quiz_integrations_quiz_id_idx
  on public.quiz_integrations(quiz_id);
create unique index if not exists quiz_integrations_quiz_type_unique_idx
  on public.quiz_integrations(quiz_id, type);
create index if not exists checkout_configs_quiz_id_idx
  on public.checkout_configs(quiz_id);
create index if not exists final_page_blocks_quiz_id_idx
  on public.final_page_blocks(quiz_id);
create index if not exists analytics_events_quiz_id_created_at_idx
  on public.analytics_events(quiz_id, created_at desc);
create index if not exists analytics_events_lead_id_idx
  on public.analytics_events(lead_id)
  where lead_id is not null;
create index if not exists integration_logs_quiz_created_at_idx
  on public.integration_logs(quiz_id, created_at desc);
create index if not exists integration_logs_integration_created_at_idx
  on public.integration_logs(integration_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists quizzes_set_updated_at on public.quizzes;
create trigger quizzes_set_updated_at
before update on public.quizzes
for each row execute function public.set_updated_at();

drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at
before update on public.leads
for each row execute function public.set_updated_at();

drop trigger if exists checkout_configs_set_updated_at
  on public.checkout_configs;
create trigger checkout_configs_set_updated_at
before update on public.checkout_configs
for each row execute function public.set_updated_at();

drop trigger if exists final_page_blocks_set_updated_at
  on public.final_page_blocks;
create trigger final_page_blocks_set_updated_at
before update on public.final_page_blocks
for each row execute function public.set_updated_at();

drop trigger if exists quiz_integrations_set_updated_at
  on public.quiz_integrations;
create trigger quiz_integrations_set_updated_at
before update on public.quiz_integrations
for each row execute function public.set_updated_at();

alter table public.users enable row level security;
alter table public.quizzes enable row level security;
alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.leads enable row level security;
alter table public.quiz_integrations enable row level security;
alter table public.checkout_configs enable row level security;
alter table public.final_page_blocks enable row level security;
alter table public.analytics_events enable row level security;
alter table public.integration_logs enable row level security;

revoke all on table
  public.users,
  public.quizzes,
  public.questions,
  public.question_options,
  public.leads,
  public.quiz_integrations,
  public.checkout_configs,
  public.final_page_blocks,
  public.analytics_events,
  public.integration_logs
from anon, authenticated;

grant select, insert, update, delete on table
  public.users,
  public.quizzes,
  public.questions,
  public.question_options,
  public.leads,
  public.quiz_integrations,
  public.checkout_configs,
  public.final_page_blocks,
  public.analytics_events,
  public.integration_logs
to service_role;

revoke execute on function public.set_updated_at() from public;
grant execute on function public.set_updated_at() to service_role;

notify pgrst, 'reload schema';

commit;
