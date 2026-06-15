begin;

alter table public.question_options
add column if not exists next_step text not null default 'default';

alter table public.question_options
drop constraint if exists question_options_next_step_check;

alter table public.question_options
add constraint question_options_next_step_check
check (next_step in ('default', 'question', 'final'));

update public.question_options
set next_step = 'question'
where next_question_id is not null;

create or replace function public.reorder_quiz_questions(
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
    from public.questions
    where quiz_id = target_quiz_id
  ) <> coalesce(array_length(ordered_ids, 1), 0) then
    raise exception 'A lista deve conter todas as perguntas do quiz.';
  end if;

  if exists (
    select 1
    from unnest(ordered_ids) as requested_id
    where not exists (
      select 1
      from public.questions
      where id = requested_id
        and quiz_id = target_quiz_id
    )
  ) then
    raise exception 'A lista contém uma pergunta inválida.';
  end if;

  update public.questions
  set order_index = order_index + 1000000
  where quiz_id = target_quiz_id;

  foreach item_id in array ordered_ids loop
    update public.questions
    set order_index = item_index
    where id = item_id
      and quiz_id = target_quiz_id;

    item_index := item_index + 1;
  end loop;
end;
$$;

create or replace function public.reorder_question_options(
  target_question_id uuid,
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
    from public.question_options
    where question_id = target_question_id
  ) <> coalesce(array_length(ordered_ids, 1), 0) then
    raise exception 'A lista deve conter todas as opções da pergunta.';
  end if;

  if exists (
    select 1
    from unnest(ordered_ids) as requested_id
    where not exists (
      select 1
      from public.question_options
      where id = requested_id
        and question_id = target_question_id
    )
  ) then
    raise exception 'A lista contém uma opção inválida.';
  end if;

  update public.question_options
  set order_index = order_index + 1000000
  where question_id = target_question_id;

  foreach item_id in array ordered_ids loop
    update public.question_options
    set order_index = item_index
    where id = item_id
      and question_id = target_question_id;

    item_index := item_index + 1;
  end loop;
end;
$$;

revoke execute on function public.reorder_quiz_questions(uuid, uuid[]) from public;
revoke execute on function public.reorder_question_options(uuid, uuid[]) from public;
grant execute on function public.reorder_quiz_questions(uuid, uuid[]) to service_role;
grant execute on function public.reorder_question_options(uuid, uuid[]) to service_role;

notify pgrst, 'reload schema';

commit;
