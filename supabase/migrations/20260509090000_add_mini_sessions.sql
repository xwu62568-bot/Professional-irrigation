create table if not exists public.mini_sessions (
  token uuid primary key,
  user_id text not null,
  user_email text not null,
  user_name text not null,
  user_role text,
  project_id text,
  project_name text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_mini_sessions_expires_at
  on public.mini_sessions (expires_at);
