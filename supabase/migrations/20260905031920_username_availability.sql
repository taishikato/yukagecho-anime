-- Deliberate pre-authentication API: exposes only exact-name availability.
-- No resident identifiers, timestamps, or directory/list access are exposed.
create function public.username_available(candidate text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(
    candidate ~ '^[a-z0-9_]{3,20}$'
    and candidate not in ('admin', 'administrator', 'support', 'system', 'yukagecho', 'moderator', 'staff', 'official')
    and not exists (select 1 from public.residents where username = candidate),
    false
  );
$$;
revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;
