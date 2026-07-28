-- School Management MVP — core schema
-- Multi-tenant: every row (except app_users' own auth link) is scoped to a school via school_id.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- schools
-- ---------------------------------------------------------------------------
create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  logo_url text,
  current_session text not null default to_char(now(), 'YYYY') || '/' || to_char(now() + interval '1 year', 'YYYY'),
  current_term text not null default '1' check (current_term in ('1', '2', '3')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- app_users — staff logins (Proprietor/Admin, Teacher). Row id = auth.users.id.
-- ---------------------------------------------------------------------------
create table if not exists public.app_users (
  id uuid primary key references auth.users (id) on delete cascade,
  -- nullable: set once the user creates/joins a school via bootstrap_school()
  school_id uuid references public.schools (id) on delete cascade,
  name text not null,
  email text,
  phone text,
  role text not null check (role in ('proprietor', 'teacher')),
  created_at timestamptz not null default now()
);

create index if not exists app_users_school_id_idx on public.app_users (school_id);

-- ---------------------------------------------------------------------------
-- classes
-- ---------------------------------------------------------------------------
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  teacher_id uuid references public.app_users (id) on delete set null,
  session text not null,
  term text not null check (term in ('1', '2', '3')),
  created_at timestamptz not null default now()
);

create index if not exists classes_school_id_idx on public.classes (school_id);
create index if not exists classes_teacher_id_idx on public.classes (teacher_id);

-- ---------------------------------------------------------------------------
-- students
-- ---------------------------------------------------------------------------
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  full_name text not null,
  class_id uuid references public.classes (id) on delete set null,
  date_of_birth date,
  parent_name text,
  parent_phone text,
  admission_date date not null default current_date,
  status text not null default 'active' check (status in ('active', 'withdrawn')),
  created_at timestamptz not null default now()
);

create index if not exists students_school_id_idx on public.students (school_id);
create index if not exists students_class_id_idx on public.students (class_id);

-- ---------------------------------------------------------------------------
-- fee_records — one per student per term/session; payments recorded separately
-- ---------------------------------------------------------------------------
create table if not exists public.fee_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  session text not null,
  term text not null check (term in ('1', '2', '3')),
  amount_expected numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, session, term)
);

create index if not exists fee_records_school_id_idx on public.fee_records (school_id);
create index if not exists fee_records_student_id_idx on public.fee_records (student_id);

-- ---------------------------------------------------------------------------
-- fee_payments — payment history against a fee_record
-- ---------------------------------------------------------------------------
create table if not exists public.fee_payments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  fee_record_id uuid not null references public.fee_records (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  payment_date date not null default current_date,
  method text not null default 'cash' check (method in ('cash', 'transfer')),
  reference_number text,
  recorded_by uuid references public.app_users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists fee_payments_fee_record_id_idx on public.fee_payments (fee_record_id);
create index if not exists fee_payments_school_id_idx on public.fee_payments (school_id);

-- ---------------------------------------------------------------------------
-- attendance
-- ---------------------------------------------------------------------------
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  date date not null default current_date,
  status text not null check (status in ('present', 'absent', 'late')),
  marked_by uuid references public.app_users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (student_id, date)
);

create index if not exists attendance_school_id_idx on public.attendance (school_id);
create index if not exists attendance_class_id_date_idx on public.attendance (class_id, date);

-- ---------------------------------------------------------------------------
-- results — CA + exam scores per subject per term
-- ---------------------------------------------------------------------------
create table if not exists public.results (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  subject text not null,
  session text not null,
  term text not null check (term in ('1', '2', '3')),
  ca_score numeric(5, 2) not null default 0 check (ca_score >= 0 and ca_score <= 40),
  exam_score numeric(5, 2) not null default 0 check (exam_score >= 0 and exam_score <= 60),
  total numeric(5, 2) generated always as (ca_score + exam_score) stored,
  grade text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, subject, session, term)
);

create index if not exists results_school_id_idx on public.results (school_id);
create index if not exists results_student_id_idx on public.results (student_id);
