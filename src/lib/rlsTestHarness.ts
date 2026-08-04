import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type RoleName = "authenticated" | "anon";

/**
 * RLS test harness.
 *
 * Runs the real supabase/migrations against an in-memory PostgreSQL (pglite —
 * a genuine PG16 compiled to WASM, no Docker needed) and emulates Supabase's
 * environment closely enough that the RLS policies execute with their real
 * semantics:
 *
 *  - an `auth` schema with an `auth.users` table and an `auth.uid()`
 *    function that reads the `request.jwt.claims` GUC (exactly how Supabase
 *    surfaces the JWT's `sub` to policies);
 *  - a `storage` schema with the two tables and the `foldername()` helper the
 *    storage policies reference;
 *  - `anon` / `authenticated` / `service_role` roles with Supabase's usual
 *    grants (usage on public + all on tables/sequences; function grants stay
 *    exactly as the migrations set them, so 0075's revokes are honored);
 *  - a `gen_random_bytes()` shim, because pglite has no `pgcrypto` extension
 *    (migrations only use it for token generation, so a md5-based stand-in is
 *    fine) and `create extension` lines are stripped.
 *
 * Queries are executed with `SET ROLE authenticated` / `anon` plus
 * `SET request.jwt.claims`, which is what makes RLS actually apply (the
 * connecting postgres superuser would otherwise bypass it, like the table
 * owner does).
 */

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

export const AUTH_SHIM_SQL = `
-- Minimal stand-in for Supabase's auth schema. The real auth.users has many
-- more columns, but the app only ever reads id/email/raw_user_meta_data and
-- the migrations only create the trigger on the table.
create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- auth.uid(): the JWT subject, surfaced exactly the way Supabase does it —
-- from the request.jwt.claims setting PostgREST populates per request.
-- Must return uuid (not text): the migrations' SQL functions that call
-- auth.uid() declare uuid return types, and Postgres raises
-- "return type mismatch" at runtime if the actual value is text.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
$$;

create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant execute on function auth.jwt() to anon, authenticated, service_role;
`;

export const STORAGE_SHIM_SQL = `
-- Minimal stand-in for Supabase's storage schema: just enough for the
-- storage-policy migrations (0018, 0024, 0029, 0031) to apply cleanly.
create schema if not exists storage;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text,
  name text,
  owner uuid,
  created_at timestamptz not null default now()
);

-- storage.foldername(name): the first path segment of an object's name —
-- Supabase returns the full path tokens; the policies only ever index [1].
create or replace function storage.foldername(name text)
returns text[]
language sql
immutable
as $$
  select string_to_array(name, '/')
$$;

alter table storage.objects enable row level security;
alter table storage.buckets enable row level security;

grant usage on schema storage to anon, authenticated, service_role;
grant all on all tables in schema storage to anon, authenticated, service_role;
`;

export const GEN_RANDOM_BYTES_SHIM_SQL = `
-- pglite ships without pgcrypto, so gen_random_bytes() (used for student
-- access tokens and class share tokens) is shimmed with md5 of a random
-- string. Deterministic enough for tests; uniqueness is not load-bearing here.
create or replace function public.gen_random_bytes(length integer)
returns bytea
language sql
as $$
  select decode(substr(md5(random()::text || clock_timestamp()::text), 1, greatest(length * 2, 2)), 'hex')
$$;
`;

export const ROLE_GRANTS_SQL = `
-- Replicate Supabase's baseline grants. Table/sequence access is granted to
-- all three roles (RLS is what actually gates rows). Function grants are
-- deliberately NOT granted here — they come from the migrations themselves
-- (and the PUBLIC default), so 0075's revokes keep their teeth.
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
`;

/** Strip `create extension` statements — pglite cannot install pgcrypto. */
function stripCreateExtension(sql: string): string {
  return sql.replace(/create\s+extension[^;]*;/gi, "-- create extension stripped for pglite\n");
}

export async function createTestDb(): Promise<PGlite> {
  const db = new PGlite();

  // Roles first — the shims and migrations grant to them.
  await db.exec(`
    do $$ begin
      create role anon nologin;
    exception when duplicate_object then null; end $$;
    do $$ begin
      create role authenticated nologin;
    exception when duplicate_object then null; end $$;
    do $$ begin
      create role service_role nologin bypassrls;
    exception when duplicate_object then null; end $$;
  `);

  await db.exec(AUTH_SHIM_SQL);
  await db.exec(STORAGE_SHIM_SQL);
  await db.exec(GEN_RANDOM_BYTES_SHIM_SQL);

  // Run every migration in order.
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql") && /^\d{4}_/.test(f))
    .sort();

  for (const file of files) {
    const sql = stripCreateExtension(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
    await db.exec(sql);
  }

  await db.exec(ROLE_GRANTS_SQL);

  return db;
}

/**
 * Run a callback as a given Supabase role with a specific JWT subject, the
 * same way PostgREST would. Resets role and claims afterwards so tests don't
 * leak session state into each other.
 */
export async function asRole<T>(
  db: PGlite,
  role: RoleName,
  sub: string | null,
  fn: () => Promise<T>
): Promise<T> {
  const claims = sub ? JSON.stringify({ sub }) : "null";
  await db.exec(`set role ${role};`);
  await db.exec(`select set_config('request.jwt.claims', '${claims.replace(/'/g, "''")}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role;");
    await db.exec("select set_config('request.jwt.claims', 'null', false);");
  }
}

/** Count rows a role can see through RLS. */
export async function countRows(db: PGlite, role: RoleName, sub: string | null, sql: string): Promise<number> {
  return asRole(db, role, sub, async () => {
    const res = await db.query<{ n: string }>(`select count(*)::text as n from (${sql}) as rls_rows`);
    return Number(res.rows[0]?.n ?? 0);
  });
}

export type Uuid = string;

/**
 * Seed fixture: two schools, each with students/fees/results/attendance, and
 * every role the tests exercise (proprietor, two teachers on different
 * classes, a bursar with the "fees" grant, staff with "expenses" and
 * "admissions" grants, a linked parent, and a second school's proprietor
 * for cross-tenant isolation).
 *
 * Auth rows are inserted into auth.users so the real signup trigger
 * (handle_new_auth_user) provisions the app_users / parents rows, exactly as
 * it would in production; the seed then sets school/role on top.
 */
export async function seedTestData(db: PGlite): Promise<SeedIds> {
  const ids = {
    schoolA: "11111111-1111-1111-1111-111111111111",
    schoolB: "22222222-2222-2222-2222-222222222222",
    proprietorA: "aaaaaaaa-0000-0000-0000-000000000001",
    teacherA1: "aaaaaaaa-0000-0000-0000-000000000002",
    teacherA2: "aaaaaaaa-0000-0000-0000-000000000003",
    bursar: "aaaaaaaa-0000-0000-0000-000000000004",
    staffExpenses: "aaaaaaaa-0000-0000-0000-000000000005",
    staffAdmissions: "aaaaaaaa-0000-0000-0000-000000000006",
    parentP1: "aaaaaaaa-0000-0000-0000-000000000007",
    proprietorB: "bbbbbbbb-0000-0000-0000-000000000001",
    classA1: "aaaaaaaa-0000-0000-0000-000000000011",
    classA2: "aaaaaaaa-0000-0000-0000-000000000012",
    classB1: "bbbbbbbb-0000-0000-0000-000000000011",
    studentA1: "aaaaaaaa-0000-0000-0000-000000000021",
    studentA2: "aaaaaaaa-0000-0000-0000-000000000022",
    studentB1: "bbbbbbbb-0000-0000-0000-000000000021",
    feeTypeA: "aaaaaaaa-0000-0000-0000-000000000031",
    feeTypeB: "bbbbbbbb-0000-0000-0000-000000000031",
    feeRecordA1: "aaaaaaaa-0000-0000-0000-000000000041",
    feeRecordA2: "aaaaaaaa-0000-0000-0000-000000000042",
    feeRecordB1: "bbbbbbbb-0000-0000-0000-000000000041",
    expenseCatA: "aaaaaaaa-0000-0000-0000-000000000051",
  } as const;

  const s = (n: string) => `'${n}'`;
  const au = (n: string) => s(ids[n as keyof SeedIds] as string);

  await db.exec(`
  -- Schools (admission_prefix is NOT NULL after 0056, no default)
  insert into public.schools (id, name, address, admission_prefix) values
    (${s(ids.schoolA)}, 'Alpha Academy', '12 Adeola Street, Lagos', 'ALPHA'),
    (${s(ids.schoolB)}, 'Beta College', '3 Broad Street, Ibadan', 'BETA');

  -- Auth users: staff first (no account_type => staff branch), parents after
  insert into auth.users (id, email, raw_user_meta_data) values
    (${au("proprietorA")}, 'proprietor@alpha.test', '{"name":"Ada Proprietor"}'),
    (${au("teacherA1")}, 'teacher1@alpha.test', '{"name":"Teacher One"}'),
    (${au("teacherA2")}, 'teacher2@alpha.test', '{"name":"Teacher Two"}'),
    (${au("bursar")}, 'bursar@alpha.test', '{"name":"Bursar"}'),
    (${au("staffExpenses")}, 'expenses@alpha.test', '{"name":"Expenses Clerk"}'),
    (${au("staffAdmissions")}, 'admissions@alpha.test', '{"name":"Admissions Officer"}'),
    (${au("proprietorB")}, 'proprietor@beta.test', '{"name":"Bello Proprietor"}');

  insert into auth.users (id, email, raw_user_meta_data) values
    (${au("parentP1")}, 'parent1@example.com', '{"account_type":"parent","name":"Parent One","phone":"+2348000000001"}');

  -- Set schools/roles on the triggered app_users rows
  update public.app_users set school_id = ${s(ids.schoolA)}, role = 'proprietor' where id = ${au("proprietorA")};
  update public.app_users set school_id = ${s(ids.schoolA)}, role = 'teacher'   where id = ${au("teacherA1")};
  update public.app_users set school_id = ${s(ids.schoolA)}, role = 'teacher'   where id = ${au("teacherA2")};
  update public.app_users set school_id = ${s(ids.schoolA)}, role = 'staff'     where id = ${au("bursar")};
  update public.app_users set school_id = ${s(ids.schoolA)}, role = 'staff'     where id = ${au("staffExpenses")};
  update public.app_users set school_id = ${s(ids.schoolA)}, role = 'staff'     where id = ${au("staffAdmissions")};
  update public.app_users set school_id = ${s(ids.schoolB)}, role = 'proprietor' where id = ${au("proprietorB")};

  -- Classes
  insert into public.classes (id, school_id, name, teacher_id, session, term) values
    (${s(ids.classA1)}, ${s(ids.schoolA)}, 'JSS1A', ${au("teacherA1")}, '2025/2026', '2'),
    (${s(ids.classA2)}, ${s(ids.schoolA)}, 'JSS2A', ${au("teacherA2")}, '2025/2026', '2'),
    (${s(ids.classB1)}, ${s(ids.schoolB)}, 'JSS1B', null, '2025/2026', '2');

  -- Students
  insert into public.students (id, school_id, class_id, full_name, parent_email) values
    (${s(ids.studentA1)}, ${s(ids.schoolA)}, ${s(ids.classA1)}, 'Chidinma Okafor', 'parent1@example.com'),
    (${s(ids.studentA2)}, ${s(ids.schoolA)}, ${s(ids.classA2)}, 'Tunde Bakare', null),
    (${s(ids.studentB1)}, ${s(ids.schoolB)}, ${s(ids.classB1)}, 'Ifeoma Eze', null);

  -- Fee types + records + payments
  insert into public.fee_types (id, school_id, name) values
    (${s(ids.feeTypeA)}, ${s(ids.schoolA)}, 'School Fees'),
    (${s(ids.feeTypeB)}, ${s(ids.schoolB)}, 'School Fees');

  insert into public.fee_records (id, school_id, student_id, fee_type_id, session, term, amount_expected) values
    (${s(ids.feeRecordA1)}, ${s(ids.schoolA)}, ${s(ids.studentA1)}, ${s(ids.feeTypeA)}, '2025/2026', '2', 45000),
    (${s(ids.feeRecordA2)}, ${s(ids.schoolA)}, ${s(ids.studentA2)}, ${s(ids.feeTypeA)}, '2025/2026', '2', 50000),
    (${s(ids.feeRecordB1)}, ${s(ids.schoolB)}, ${s(ids.studentB1)}, ${s(ids.feeTypeB)}, '2025/2026', '2', 60000);

  insert into public.fee_payments (school_id, fee_record_id, amount, payment_date, method) values
    (${s(ids.schoolA)}, ${s(ids.feeRecordA1)}, 20000, current_date - 5, 'cash'),
    (${s(ids.schoolA)}, ${s(ids.feeRecordA2)}, 50000, current_date - 3, 'transfer'),
    (${s(ids.schoolB)}, ${s(ids.feeRecordB1)}, 60000, current_date - 2, 'cash');

  -- Results + attendance
  insert into public.results (school_id, student_id, subject, session, term, ca_score, exam_score) values
    (${s(ids.schoolA)}, ${s(ids.studentA1)}, 'Mathematics', '2025/2026', '2', 30, 55),
    (${s(ids.schoolA)}, ${s(ids.studentA2)}, 'Mathematics', '2025/2026', '2', 25, 40),
    (${s(ids.schoolB)}, ${s(ids.studentB1)}, 'Mathematics', '2025/2026', '2', 28, 50);

  insert into public.attendance (school_id, student_id, class_id, date, status) values
    (${s(ids.schoolA)}, ${s(ids.studentA1)}, ${s(ids.classA1)}, current_date, 'present'),
    (${s(ids.schoolA)}, ${s(ids.studentA2)}, ${s(ids.classA2)}, current_date, 'absent');

  -- Parent linking (via the invitation outcome, i.e. a parent_students row)
  update public.parents set name = 'Parent One', email = 'parent1@example.com' where id = ${au("parentP1")};
  insert into public.parent_students (parent_id, student_id) values
    (${au("parentP1")}, ${s(ids.studentA1)});

  -- Staff permissions (module grants)
  insert into public.staff_permissions (school_id, staff_id, permission) values
    (${s(ids.schoolA)}, ${au("bursar")}, 'fees'),
    (${s(ids.schoolA)}, ${au("staffExpenses")}, 'expenses'),
    (${s(ids.schoolA)}, ${au("staffAdmissions")}, 'admissions');

  -- Proprietor-only data: salaries, payment intents, transfer alerts
  insert into public.staff_salaries (school_id, staff_id, monthly_salary) values
    (${s(ids.schoolA)}, ${au("teacherA1")}, 150000);

  insert into public.payment_intents (school_id, fee_record_id, student_id, reference, amount, status) values
    (${s(ids.schoolA)}, ${s(ids.feeRecordA1)}, ${s(ids.studentA1)}, 'schfee_deadbeef0001', 25000, 'pending');

  insert into public.bank_transfer_alerts (school_id, amount, narration, status) values
    (${s(ids.schoolA)}, 50000, 'Transfer from Tunde Bakare', 'unmatched');

  -- Expenses module data (school A)
  insert into public.expense_categories (id, school_id, name) values
    (${s(ids.expenseCatA)}, ${s(ids.schoolA)}, 'Rent');

  insert into public.expenses (school_id, category_id, session, term, amount, description) values
    (${s(ids.schoolA)}, ${s(ids.expenseCatA)}, '2025/2026', '2', 300000, 'Term rent');

  -- Admissions module data (school A)
  insert into public.admission_prospects (school_id, session, full_name, status) values
    (${s(ids.schoolA)}, '2025/2026', 'Kelechi Uche', 'inquiry');
  `);

  return ids as SeedIds;
}

export interface SeedIds {
  schoolA: Uuid;
  schoolB: Uuid;
  proprietorA: Uuid;
  teacherA1: Uuid;
  teacherA2: Uuid;
  bursar: Uuid;
  staffExpenses: Uuid;
  staffAdmissions: Uuid;
  parentP1: Uuid;
  proprietorB: Uuid;
  classA1: Uuid;
  classA2: Uuid;
  classB1: Uuid;
  studentA1: Uuid;
  studentA2: Uuid;
  studentB1: Uuid;
  feeTypeA: Uuid;
  feeTypeB: Uuid;
  feeRecordA1: Uuid;
  feeRecordA2: Uuid;
  feeRecordB1: Uuid;
  expenseCatA: Uuid;
}
