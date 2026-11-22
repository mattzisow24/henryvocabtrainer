-- Sam's vocab trainer: schema and access rules.
-- Run once in the Supabase SQL editor, then add the family's emails at the bottom.

-- Who may use the app. Anyone not listed here is signed out at the door.
create table if not exists members (
  email text primary key check (email = lower(email)),
  role text not null check (role in ('learner', 'parent')),
  display_name text not null default '',
  created_at timestamptz not null default now()
);

-- The signed-in user's role, or null if they are not a member.
create or replace function my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from members where email = lower(auth.jwt() ->> 'email')
$$;

-- What the coach has learned about how the learner learns.
create table if not exists learner_profile (
  learner_id uuid primary key references auth.users on delete cascade,
  profile jsonb not null default '{}'::jsonb,
  onboarded_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Spaced-repetition state, one row per word the learner has met.
create table if not exists word_state (
  learner_id uuid not null references auth.users on delete cascade,
  word_id text not null,
  box int not null default 0,
  due date not null,
  seen int not null default 0,
  correct int not null default 0,
  lapses int not null default 0,
  last_grade text check (last_grade in ('knew', 'partial', 'missed')),
  -- What he mixed the word up with, and the coach's note on it.
  confused_with text,
  note text,
  updated_at timestamptz not null default now(),
  primary key (learner_id, word_id)
);

-- Coach conversations. `messages` is the full model transcript, so a session
-- can be resumed; `transcript` is the readable version for the dashboard.
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references auth.users on delete cascade,
  status text not null default 'active' check (status in ('active', 'done')),
  day date not null,
  plan jsonb not null default '{}'::jsonb,
  system_prompt text not null,
  messages jsonb not null default '[]'::jsonb,
  transcript jsonb not null default '[]'::jsonb,
  summary text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  last_turn_at timestamptz not null default now()
);
create index if not exists sessions_learner_day on sessions (learner_id, day desc);

-- Every graded answer, from the coach or a drill.
create table if not exists reviews (
  id bigint generated always as identity primary key,
  learner_id uuid not null references auth.users on delete cascade,
  word_id text not null,
  source text not null check (source in ('coach', 'drill', 'sort', 'cards')),
  grade text not null check (grade in ('knew', 'partial', 'missed')),
  session_id uuid references sessions on delete set null,
  day date not null,
  created_at timestamptz not null default now()
);
create index if not exists reviews_learner_day on reviews (learner_id, day desc);

-- Completed Words in Context drills.
create table if not exists drill_runs (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references auth.users on delete cascade,
  timed boolean not null default false,
  total int not null,
  correct int not null,
  seconds int not null,
  items jsonb not null default '[]'::jsonb,
  day date not null,
  created_at timestamptz not null default now()
);
create index if not exists drill_runs_learner_day on drill_runs (learner_id, day desc);

-- Access rules: every member can read everything (one family, one learner).
-- Only the learner writes practice data. Only parents manage the member list.
alter table members enable row level security;
alter table learner_profile enable row level security;
alter table word_state enable row level security;
alter table sessions enable row level security;
alter table reviews enable row level security;
alter table drill_runs enable row level security;

create policy members_read on members for select using (my_role() is not null);
create policy members_manage on members for all using (my_role() = 'parent') with check (my_role() = 'parent');

do $$
declare t text;
begin
  foreach t in array array['learner_profile', 'word_state', 'sessions', 'reviews', 'drill_runs'] loop
    execute format('create policy %I on %I for select using (my_role() is not null)', t || '_read', t);
    execute format(
      'create policy %I on %I for all using (my_role() = ''learner'' and learner_id = auth.uid()) with check (my_role() = ''learner'' and learner_id = auth.uid())',
      t || '_write', t);
  end loop;
end $$;

-- Add the family. Replace the emails, then run. More parents can be added
-- later from the dashboard.
-- insert into members (email, role, display_name) values
--   ('henry@example.com', 'learner', 'Henry'),
--   ('parent1@example.com', 'parent', 'Dad'),
--   ('parent2@example.com', 'parent', 'Mom');
