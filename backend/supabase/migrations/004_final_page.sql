begin;

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

alter table public.checkout_configs
add column if not exists updated_at timestamptz not null default now();

create index if not exists final_page_blocks_quiz_id_idx
  on public.final_page_blocks(quiz_id);

drop trigger if exists final_page_blocks_set_updated_at
  on public.final_page_blocks;
create trigger final_page_blocks_set_updated_at
before update on public.final_page_blocks
for each row execute function public.set_updated_at();

drop trigger if exists checkout_configs_set_updated_at
  on public.checkout_configs;
create trigger checkout_configs_set_updated_at
before update on public.checkout_configs
for each row execute function public.set_updated_at();

create or replace function public.reorder_final_page_blocks(
  target_quiz_id uuid,
  ordered_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  item_id uuid;
  item_index integer := 0;
begin
  if (
    select count(*)
    from public.final_page_blocks
    where quiz_id = target_quiz_id
  ) <> coalesce(array_length(ordered_ids, 1), 0) then
    raise exception 'A lista deve conter todos os blocos da página final.';
  end if;

  if exists (
    select 1
    from unnest(ordered_ids) as requested_id
    where not exists (
      select 1
      from public.final_page_blocks
      where id = requested_id
        and quiz_id = target_quiz_id
    )
  ) then
    raise exception 'A lista contém um bloco inválido.';
  end if;

  update public.final_page_blocks
  set order_index = order_index + 1000000
  where quiz_id = target_quiz_id;

  foreach item_id in array ordered_ids loop
    update public.final_page_blocks
    set order_index = item_index
    where id = item_id
      and quiz_id = target_quiz_id;

    item_index := item_index + 1;
  end loop;
end;
$$;

alter table public.final_page_blocks enable row level security;

revoke all on table public.final_page_blocks from anon, authenticated;
grant select, insert, update, delete on table public.final_page_blocks
  to service_role;

revoke execute on function public.reorder_final_page_blocks(uuid, uuid[])
  from public;
grant execute on function public.reorder_final_page_blocks(uuid, uuid[])
  to service_role;

notify pgrst, 'reload schema';

commit;
