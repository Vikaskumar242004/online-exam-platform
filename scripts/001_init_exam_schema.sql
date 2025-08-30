-- Create core exam schema: profiles, quizzes, questions, options, attempts, answers, anti-cheat, assignments

-- Ensure extensions (gen_random_uuid comes from pgcrypto in Supabase)
create extension if not exists pgcrypto;

-- 1) Profiles - link to auth.users with a role
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('student','admin')) default 'student',
  full_name text,
  created_at timestamptz not null default now()
);

-- Auto-create profile on new auth user
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, role, full_name)
  values (new.id, 'student', null)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2) Quizzes
create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  duration_seconds integer not null check (duration_seconds > 0),
  start_at timestamptz,
  end_at timestamptz,
  is_public boolean not null default false,
  show_correct_answers text not null default 'after_due' check (show_correct_answers in ('never','after_due','immediate')),
  allow_tab_switches integer not null default 1 check (allow_tab_switches >= 0),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quizzes_created_by_idx on public.quizzes(created_by);
create index if not exists quizzes_time_idx on public.quizzes(start_at, end_at);

-- 3) Quiz assignments (target specific students; complements is_public)
create table if not exists public.quiz_assignments (
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (quiz_id, user_id)
);

create index if not exists quiz_assignments_user_idx on public.quiz_assignments(user_id);

-- 4) Questions
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  kind text not null check (kind in ('single','multiple','boolean','short')),
  prompt text not null,
  points numeric not null default 1,
  order_index integer not null default 0
);

create index if not exists questions_quiz_idx on public.questions(quiz_id);

-- 5) Options (for single/multiple/boolean)
create table if not exists public.options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  label text not null,
  is_correct boolean not null default false,
  order_index integer not null default 0
);

create index if not exists options_question_idx on public.options(question_id);

-- 6) Attempts (one or more attempts per student; attempt_number for clarity)
create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  attempt_number integer not null default 1,
  status text not null default 'in_progress' check (status in ('in_progress','submitted','auto_submitted')),
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  score numeric not null default 0,
  tab_switch_count integer not null default 0
);

create index if not exists attempts_quiz_user_idx on public.attempts(quiz_id, user_id);
create index if not exists attempts_status_idx on public.attempts(status);

-- 7) Answers
create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  selected_option_ids uuid[] default '{}',
  short_text text,
  correct boolean,
  points_awarded numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

create index if not exists answers_attempt_idx on public.answers(attempt_id);

-- 8) Anti-cheat events
create table if not exists public.anti_cheat_events (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  kind text not null check (kind in ('tab_blur','visibility_hidden','copy','paste','contextmenu','fullscreen_exit')),
  at timestamptz not null default now(),
  meta jsonb not null default '{}'::jsonb
);

create index if not exists ace_attempt_idx on public.anti_cheat_events(attempt_id);

-- 9) Update timestamp on quizzes
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists quizzes_set_updated_at on public.quizzes;
create trigger quizzes_set_updated_at
before update on public.quizzes
for each row execute function public.set_updated_at();
