-- Enable RLS and add policies for students and admins

-- Helper: check if current user is admin
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists(
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_assignments enable row level security;
alter table public.questions enable row level security;
alter table public.options enable row level security;
alter table public.attempts enable row level security;
alter table public.answers enable row level security;
alter table public.anti_cheat_events enable row level security;

-- profiles: users can view/update their own; admins can view all
drop policy if exists "profiles self select" on public.profiles;
create policy "profiles self select" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles
  for update using (id = auth.uid());

-- quizzes:
-- owners (created_by) can do everything
drop policy if exists "quizzes owner all" on public.quizzes;
create policy "quizzes owner all" on public.quizzes
  for all using (created_by = auth.uid() or public.is_admin())
  with check (created_by = auth.uid() or public.is_admin());

-- students can select quizzes that are public or assigned to them
drop policy if exists "quizzes student select" on public.quizzes;
create policy "quizzes student select" on public.quizzes
  for select using (
    is_public
    or exists (
      select 1 from public.quiz_assignments qa
      where qa.quiz_id = quizzes.id and qa.user_id = auth.uid()
    )
  );

-- quiz_assignments:
-- owners can manage assignments for their quizzes, students can read their own
drop policy if exists "assignment owner manage" on public.quiz_assignments;
create policy "assignment owner manage" on public.quiz_assignments
  for all using (
    public.is_admin()
    or exists (select 1 from public.quizzes q where q.id = quiz_assignments.quiz_id and q.created_by = auth.uid())
  )
  with check (
    public.is_admin()
    or exists (select 1 from public.quizzes q where q.id = quiz_assignments.quiz_id and q.created_by = auth.uid())
  );

drop policy if exists "assignment student read" on public.quiz_assignments;
create policy "assignment student read" on public.quiz_assignments
  for select using (user_id = auth.uid());

-- questions/options:
-- owner full access; students can select if assigned or public
drop policy if exists "questions owner all" on public.questions;
create policy "questions owner all" on public.questions
  for all using (
    public.is_admin()
    or exists (select 1 from public.quizzes q where q.id = questions.quiz_id and q.created_by = auth.uid())
  )
  with check (
    public.is_admin()
    or exists (select 1 from public.quizzes q where q.id = questions.quiz_id and q.created_by = auth.uid())
  );

drop policy if exists "questions student select" on public.questions;
create policy "questions student select" on public.questions
  for select using (
    exists (
      select 1
      from public.quizzes q
      left join public.quiz_assignments qa on qa.quiz_id = q.id and qa.user_id = auth.uid()
      where q.id = questions.quiz_id
        and (q.is_public or qa.user_id = auth.uid())
    )
  );

drop policy if exists "options owner all" on public.options;
create policy "options owner all" on public.options
  for all using (
    public.is_admin()
    or exists (
      select 1 from public.questions qu
      join public.quizzes q on q.id = qu.quiz_id
      where qu.id = options.question_id and q.created_by = auth.uid()
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.questions qu
      join public.quizzes q on q.id = qu.quiz_id
      where qu.id = options.question_id and q.created_by = auth.uid()
    )
  );

drop policy if exists "options student select" on public.options;
create policy "options student select" on public.options
  for select using (
    exists (
      select 1
      from public.questions qu
      join public.quizzes q on q.id = qu.quiz_id
      left join public.quiz_assignments qa on qa.quiz_id = q.id and qa.user_id = auth.uid()
      where qu.id = options.question_id
        and (q.is_public or qa.user_id = auth.uid())
    )
  );

-- attempts: students can create/select/update their own attempt for assigned/public quizzes; owners can read attempts
drop policy if exists "attempts student manage" on public.attempts;
create policy "attempts student manage" on public.attempts
  for all using (
    user_id = auth.uid()
    and exists (
      select 1 from public.quizzes q
      left join public.quiz_assignments qa on qa.quiz_id = q.id and qa.user_id = auth.uid()
      where q.id = attempts.quiz_id and (q.is_public or qa.user_id = auth.uid())
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.quizzes q
      left join public.quiz_assignments qa on qa.quiz_id = q.id and qa.user_id = auth.uid()
      where q.id = attempts.quiz_id and (q.is_public or qa.user_id = auth.uid())
    )
  );

drop policy if exists "attempts owner read" on public.attempts;
create policy "attempts owner read" on public.attempts
  for select using (
    public.is_admin()
    or exists (select 1 from public.quizzes q where q.id = attempts.quiz_id and q.created_by = auth.uid())
  );

-- answers: students manage their answers; owners/admins read
drop policy if exists "answers student manage" on public.answers;
create policy "answers student manage" on public.answers
  for all using (
    exists (select 1 from public.attempts a where a.id = answers.attempt_id and a.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.attempts a where a.id = answers.attempt_id and a.user_id = auth.uid())
  );

drop policy if exists "answers owner read" on public.answers;
create policy "answers owner read" on public.answers
  for select using (
    public.is_admin()
    or exists (
      select 1
      from public.attempts a
      join public.quizzes q on q.id = a.quiz_id
      where a.id = answers.attempt_id and q.created_by = auth.uid()
    )
  );

-- anti-cheat: students insert for their attempt; owners/admins read
drop policy if exists "ace student insert" on public.anti_cheat_events;
create policy "ace student insert" on public.anti_cheat_events
  for insert with check (
    exists (
      select 1 from public.attempts a
      where a.id = anti_cheat_events.attempt_id and a.user_id = auth.uid()
    )
  );

drop policy if exists "ace owner read" on public.anti_cheat_events;
create policy "ace owner read" on public.anti_cheat_events
  for select using (
    public.is_admin()
    or exists (
      select 1
      from public.attempts a
      join public.quizzes q on q.id = a.quiz_id
      where a.id = anti_cheat_events.attempt_id and q.created_by = auth.uid()
    )
  );
