begin;

create index if not exists analytics_events_quiz_type_created_at_idx
  on public.analytics_events(quiz_id, event_type, created_at desc);
create index if not exists analytics_events_created_at_idx
  on public.analytics_events(created_at desc);
create index if not exists leads_quiz_completed_created_at_idx
  on public.leads(quiz_id, completed, created_at desc);
create index if not exists leads_quiz_email_created_at_idx
  on public.leads(quiz_id, created_at desc)
  where email is not null;
create index if not exists leads_answers_gin_idx
  on public.leads using gin(answers);

create or replace function public.analytics_summary_by_quiz(
  target_quiz_ids uuid[],
  start_at timestamptz,
  end_at timestamptz
)
returns table (
  quiz_id uuid,
  quiz_name text,
  visitors bigint,
  starts bigint,
  completions bigint,
  leads bigint,
  cta_clicks bigint,
  checkout_clicks bigint
)
language sql
security invoker
set search_path = ''
as $$
  with selected_quizzes as (
    select id, title
    from public.quizzes
    where id = any(target_quiz_ids)
  ), event_counts as (
    select
      analytics_events.quiz_id,
      count(distinct case when event_type = 'visit' then coalesce(
        nullif(concat_ws('|', metadata->>'ip', metadata->>'userAgent'), ''),
        analytics_events.id::text
      ) end) as visitors,
      count(*) filter (where event_type = 'start') as starts,
      count(*) filter (where event_type = 'complete') as completions,
      count(*) filter (where event_type = 'cta_click') as cta_clicks,
      count(*) filter (where event_type = 'checkout_click') as checkout_clicks
    from public.analytics_events
    where analytics_events.quiz_id = any(target_quiz_ids)
      and analytics_events.created_at >= start_at
      and analytics_events.created_at < end_at
    group by analytics_events.quiz_id
  ), lead_counts as (
    select leads.quiz_id, count(*) as leads
    from public.leads
    where leads.quiz_id = any(target_quiz_ids)
      and leads.created_at >= start_at
      and leads.created_at < end_at
    group by leads.quiz_id
  )
  select
    selected_quizzes.id,
    selected_quizzes.title,
    coalesce(event_counts.visitors, 0)::bigint,
    coalesce(event_counts.starts, 0)::bigint,
    coalesce(event_counts.completions, 0)::bigint,
    coalesce(lead_counts.leads, 0)::bigint,
    coalesce(event_counts.cta_clicks, 0)::bigint,
    coalesce(event_counts.checkout_clicks, 0)::bigint
  from selected_quizzes
  left join event_counts on event_counts.quiz_id = selected_quizzes.id
  left join lead_counts on lead_counts.quiz_id = selected_quizzes.id
  order by selected_quizzes.title;
$$;

create or replace function public.analytics_timeline(
  target_quiz_ids uuid[],
  start_at timestamptz,
  end_at timestamptz
)
returns table (
  day date,
  visitors bigint,
  starts bigint,
  completions bigint,
  leads bigint,
  checkout_clicks bigint
)
language sql
security invoker
set search_path = ''
as $$
  with days as (
    select generate_series(date_trunc('day', start_at), date_trunc('day', end_at - interval '1 second'), interval '1 day')::date as day
  ), event_counts as (
    select
      date_trunc('day', created_at)::date as day,
      count(distinct case when event_type = 'visit' then coalesce(
        nullif(concat_ws('|', metadata->>'ip', metadata->>'userAgent'), ''),
        id::text
      ) end) as visitors,
      count(*) filter (where event_type = 'start') as starts,
      count(*) filter (where event_type = 'complete') as completions,
      count(*) filter (where event_type = 'checkout_click') as checkout_clicks
    from public.analytics_events
    where quiz_id = any(target_quiz_ids)
      and created_at >= start_at
      and created_at < end_at
    group by 1
  ), lead_counts as (
    select date_trunc('day', created_at)::date as day, count(*) as leads
    from public.leads
    where quiz_id = any(target_quiz_ids)
      and created_at >= start_at
      and created_at < end_at
    group by 1
  )
  select
    days.day,
    coalesce(event_counts.visitors, 0)::bigint,
    coalesce(event_counts.starts, 0)::bigint,
    coalesce(event_counts.completions, 0)::bigint,
    coalesce(lead_counts.leads, 0)::bigint,
    coalesce(event_counts.checkout_clicks, 0)::bigint
  from days
  left join event_counts on event_counts.day = days.day
  left join lead_counts on lead_counts.day = days.day
  order by days.day;
$$;

create or replace function public.analytics_funnel(
  target_quiz_id uuid,
  start_at timestamptz,
  end_at timestamptz
)
returns table (
  step_key text,
  label text,
  order_index integer,
  count bigint
)
language sql
security invoker
set search_path = ''
as $$
  with event_counts as (
    select
      count(distinct case when event_type = 'visit' then coalesce(
        nullif(concat_ws('|', metadata->>'ip', metadata->>'userAgent'), ''),
        id::text
      ) end) as visitors,
      count(*) filter (where event_type = 'start') as starts,
      count(*) filter (where event_type = 'complete') as completions,
      count(*) filter (where event_type = 'checkout_click') as checkout_clicks
    from public.analytics_events
    where quiz_id = target_quiz_id
      and created_at >= start_at
      and created_at < end_at
  ), questions as (
    select id, order_index, title
    from public.questions
    where quiz_id = target_quiz_id
    order by order_index
  ), question_counts as (
    select
      questions.id,
      questions.order_index,
      questions.title,
      count(leads.id) as answers_count
    from questions
    left join public.leads
      on leads.quiz_id = target_quiz_id
      and leads.created_at >= start_at
      and leads.created_at < end_at
      and leads.answers ? questions.id::text
    group by questions.id, questions.order_index, questions.title
  )
  select
    'visitors'::text as step_key,
    'Visitantes'::text as label,
    0 as order_index,
    coalesce((select visitors from event_counts), 0)::bigint as count
  union all
  select 'starts', 'Inícios', 1, coalesce((select starts from event_counts), 0)::bigint
  union all
  select id::text, 'Concluíram pergunta ' || (order_index + 1)::text || ': ' || title, order_index + 2, answers_count::bigint
  from question_counts
  union all
  select 'completions', 'Conclusões', 100000, coalesce((select completions from event_counts), 0)::bigint
  union all
  select 'checkout_clicks', 'Checkout', 100001, coalesce((select checkout_clicks from event_counts), 0)::bigint
  order by order_index;
$$;

create or replace function public.analytics_answer_distribution(
  target_quiz_id uuid,
  start_at timestamptz,
  end_at timestamptz
)
returns table (
  question_id uuid,
  question_title text,
  option_label text,
  option_value text,
  count bigint,
  total bigint
)
language sql
security invoker
set search_path = ''
as $$
  with options as (
    select
      questions.id as question_id,
      questions.title as question_title,
      question_options.label as option_label,
      question_options.value as option_value,
      question_options.order_index
    from public.questions
    join public.question_options on question_options.question_id = questions.id
    where questions.quiz_id = target_quiz_id
      and questions.type = 'multiple_choice'
  ), counts as (
    select
      options.question_id,
      options.option_value,
      count(leads.id) as answer_count
    from options
    left join public.leads
      on leads.quiz_id = target_quiz_id
      and leads.created_at >= start_at
      and leads.created_at < end_at
      and leads.answers ->> options.question_id::text = options.option_value
    group by options.question_id, options.option_value
  ), totals as (
    select question_id, sum(answer_count)::bigint as total
    from counts
    group by question_id
  )
  select
    options.question_id,
    options.question_title,
    options.option_label,
    options.option_value,
    coalesce(counts.answer_count, 0)::bigint,
    coalesce(totals.total, 0)::bigint
  from options
  left join counts on counts.question_id = options.question_id and counts.option_value = options.option_value
  left join totals on totals.question_id = options.question_id
  order by options.question_title, options.order_index;
$$;

create or replace function public.analytics_utm_distribution(
  target_quiz_id uuid,
  start_at timestamptz,
  end_at timestamptz
)
returns table (
  utm_source text,
  utm_medium text,
  utm_campaign text,
  visitors bigint,
  leads bigint,
  conversions bigint
)
language sql
security invoker
set search_path = ''
as $$
  with visit_counts as (
    select
      coalesce(nullif(metadata #>> '{attribution,utmSource}', ''), '(sem origem)') as source,
      coalesce(nullif(metadata #>> '{attribution,utmMedium}', ''), '(sem mídia)') as medium,
      coalesce(nullif(metadata #>> '{attribution,utmCampaign}', ''), '(sem campanha)') as campaign,
      count(distinct coalesce(
        nullif(concat_ws('|', metadata->>'ip', metadata->>'userAgent'), ''),
        id::text
      )) as visitors
    from public.analytics_events
    where quiz_id = target_quiz_id
      and event_type = 'visit'
      and created_at >= start_at
      and created_at < end_at
    group by 1, 2, 3
  ), lead_counts as (
    select
      coalesce(nullif(utm_source, ''), '(sem origem)') as source,
      coalesce(nullif(utm_medium, ''), '(sem mídia)') as medium,
      coalesce(nullif(utm_campaign, ''), '(sem campanha)') as campaign,
      count(*) as leads,
      count(*) filter (where completed = true) as conversions
    from public.leads
    where quiz_id = target_quiz_id
      and created_at >= start_at
      and created_at < end_at
    group by 1, 2, 3
  ), keys as (
    select source, medium, campaign from visit_counts
    union
    select source, medium, campaign from lead_counts
  )
  select
    keys.source,
    keys.medium,
    keys.campaign,
    coalesce(visit_counts.visitors, 0)::bigint,
    coalesce(lead_counts.leads, 0)::bigint,
    coalesce(lead_counts.conversions, 0)::bigint
  from keys
  left join visit_counts using (source, medium, campaign)
  left join lead_counts using (source, medium, campaign)
  order by coalesce(visit_counts.visitors, 0) desc, coalesce(lead_counts.leads, 0) desc;
$$;

revoke execute on function public.analytics_summary_by_quiz(uuid[], timestamptz, timestamptz) from public;
revoke execute on function public.analytics_timeline(uuid[], timestamptz, timestamptz) from public;
revoke execute on function public.analytics_funnel(uuid, timestamptz, timestamptz) from public;
revoke execute on function public.analytics_answer_distribution(uuid, timestamptz, timestamptz) from public;
revoke execute on function public.analytics_utm_distribution(uuid, timestamptz, timestamptz) from public;

grant execute on function public.analytics_summary_by_quiz(uuid[], timestamptz, timestamptz) to service_role;
grant execute on function public.analytics_timeline(uuid[], timestamptz, timestamptz) to service_role;
grant execute on function public.analytics_funnel(uuid, timestamptz, timestamptz) to service_role;
grant execute on function public.analytics_answer_distribution(uuid, timestamptz, timestamptz) to service_role;
grant execute on function public.analytics_utm_distribution(uuid, timestamptz, timestamptz) to service_role;

notify pgrst, 'reload schema';

commit;
