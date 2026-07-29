-- Unguessable per-student token powering the public, read-only parent view
-- at /p/[token] (no login — this is the Phase-2 "parent portal" pulled
-- forward as a minimal share-link instead of a full account system).

alter table public.students
  add column if not exists access_token text unique default encode(gen_random_bytes(16), 'hex');

update public.students set access_token = encode(gen_random_bytes(16), 'hex') where access_token is null;

alter table public.students alter column access_token set not null;

create index if not exists students_access_token_idx on public.students (access_token);
