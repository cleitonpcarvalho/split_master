begin;

alter table public.leads
add column if not exists completed_at timestamptz;

alter table public.quiz_integrations
add column if not exists updated_at timestamptz not null default now();

create unique index if not exists quiz_integrations_quiz_type_unique_idx
  on public.quiz_integrations(quiz_id, type);

drop trigger if exists quiz_integrations_set_updated_at
  on public.quiz_integrations;
create trigger quiz_integrations_set_updated_at
before update on public.quiz_integrations
for each row execute function public.set_updated_at();

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

create index if not exists integration_logs_quiz_created_at_idx
  on public.integration_logs(quiz_id, created_at desc);
create index if not exists integration_logs_integration_created_at_idx
  on public.integration_logs(integration_id, created_at desc);

alter table public.integration_logs enable row level security;

revoke all on table public.integration_logs from anon, authenticated;
grant select, insert, update, delete on table public.integration_logs
  to service_role;

notify pgrst, 'reload schema';

commit;
