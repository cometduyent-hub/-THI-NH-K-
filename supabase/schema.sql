-- Physics Test Arena - Supabase schema
create extension if not exists "pgcrypto";

create table if not exists teachers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  full_name text,
  created_at timestamptz default now()
);

create table if not exists question_banks (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references teachers(id) on delete cascade,
  name text not null,
  subject text default 'Vật lí',
  grade text,
  created_at timestamptz default now()
);

create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  bank_id uuid references question_banks(id) on delete cascade,
  external_id text,
  section text not null check(section in ('MCQ','TF','SHORT','ESSAY')),
  subject text default 'Vật lí',
  grade text,
  topic text,
  difficulty text check(difficulty in ('NB','TH','VD','VDC')),
  content text not null,
  image_url text,
  options jsonb,
  correct_option text,
  tf jsonb,
  short_answer text,
  tolerance numeric default 0,
  points numeric default 1,
  explanation text,
  created_at timestamptz default now()
);

create table if not exists exams (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references teachers(id) on delete set null,
  title text not null,
  join_code text unique not null,
  duration_minutes int not null default 45,
  matrix jsonb not null,
  created_at timestamptz default now()
);

create table if not exists exam_questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid references exams(id) on delete cascade,
  question_id uuid references questions(id) on delete restrict,
  position int not null,
  randomized_options jsonb,
  unique(exam_id, position)
);

create table if not exists attempts (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid references exams(id) on delete cascade,
  student_name text not null,
  class_name text,
  started_at timestamptz default now(),
  submitted_at timestamptz,
  auto_score numeric default 0,
  essay_score numeric default 0,
  total_score numeric default 0
);

create table if not exists answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid references attempts(id) on delete cascade,
  exam_question_id uuid references exam_questions(id) on delete cascade,
  answer jsonb,
  auto_score numeric default 0,
  teacher_score numeric,
  teacher_comment text,
  unique(attempt_id, exam_question_id)
);

create index if not exists idx_questions_bank on questions(bank_id);
create index if not exists idx_questions_section_difficulty on questions(section, difficulty);
create index if not exists idx_attempts_exam on attempts(exam_id);
create index if not exists idx_answers_attempt on answers(attempt_id);

-- Recommended next step: configure RLS policies based on your teacher authentication model.
