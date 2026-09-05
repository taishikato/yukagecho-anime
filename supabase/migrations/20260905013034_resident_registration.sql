-- RESTRICT preserves reservations until account deletion policy is decided.
create table public.residents (
  user_id uuid primary key references auth.users(id) on delete restrict,
  username text not null unique,
  reserved_at timestamptz not null default now(),
  constraint residents_username_format check (username ~ '^[a-z0-9_]{3,20}$'),
  constraint residents_username_reserved check (username not in
    ('admin', 'administrator', 'support', 'system', 'yukagecho', 'moderator', 'staff', 'official'))
);
alter table public.residents enable row level security;
revoke all on public.residents from public, anon, authenticated;
grant select on public.residents to authenticated;
grant insert (user_id, username) on public.residents to authenticated;

create policy residents_read_own on public.residents for select to authenticated
using (
  (select auth.uid()) = user_id
  and coalesce((select auth.jwt()) ->> 'is_anonymous', 'true') = 'false'
  and coalesce((select auth.jwt()) ->> 'email', '') <> ''
);
create policy residents_reserve_own on public.residents for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and coalesce((select auth.jwt()) ->> 'is_anonymous', 'true') = 'false'
  and coalesce((select auth.jwt()) ->> 'email', '') <> ''
  and (select auth.jwt()) -> 'amr' @> '[{"method":"otp"}]'::jsonb
  and (select auth.jwt()) -> 'app_metadata' ->> 'provider' = 'email'
);
