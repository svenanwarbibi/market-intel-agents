-- Market-Intelligence pipeline schema (docs/PLAN.md §4). Keyed by job_id, not date.

create table if not exists sources (
  id           bigint generated always as identity primary key,
  name         text not null,
  kind         text not null check (kind in ('rss','news','social','forum','review','filing','regulatory','market','events')),
  geographies  text[] not null default '{}',
  chapters     int[]  not null default '{}',
  url          text,
  enabled      boolean not null default true,
  config       jsonb not null default '{}'
);

create table if not exists research_jobs (
  id           uuid primary key default gen_random_uuid(),
  scope        jsonb not null,
  status       text not null default 'queued' check (status in ('queued','running','done','failed')),
  created_by   text,
  created_at   timestamptz not null default now(),
  finished_at  timestamptz,
  token_cost   bigint
);

create table if not exists documents (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null references research_jobs(id) on delete cascade,
  source_id    bigint references sources(id),
  url          text,
  title        text,
  author       text,
  published_at timestamptz,
  raw_text     text,
  lang         text,
  hash         text,                       -- dedup key
  fetched_at   timestamptz not null default now()
);
create index if not exists documents_job_idx on documents(job_id);
create unique index if not exists documents_job_hash_idx on documents(job_id, hash);

create table if not exists chapter_outputs (
  id                 uuid primary key default gen_random_uuid(),
  job_id             uuid not null references research_jobs(id) on delete cascade,
  chapter            int not null check (chapter between 1 and 6),
  payload            jsonb not null,
  model              text,
  token_cost         bigint,
  automation_tag     text,                 -- 🤖 / 🤖👤 / 👤 (IC-3 readiness)
  needs_human_review boolean not null default false,
  created_at         timestamptz not null default now()
);
create unique index if not exists chapter_outputs_job_chapter_idx on chapter_outputs(job_id, chapter);

create table if not exists claims (
  id                uuid primary key default gen_random_uuid(),
  chapter_output_id uuid not null references chapter_outputs(id) on delete cascade,
  statement         text not null,
  confidence        real,
  document_id       uuid references documents(id)   -- every claim cites a scraped doc
);
