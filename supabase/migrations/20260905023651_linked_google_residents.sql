-- Keep verified legacy email sessions working while adding Google OAuth.
alter policy residents_reserve_own on public.residents
with check (
  (select auth.uid()) = user_id
  and coalesce((select auth.jwt())->>'is_anonymous', 'true') = 'false'
  and coalesce((select auth.jwt())->>'email', '') <> ''
  and (
    ((select auth.jwt())->'amr' @> '[{"method":"otp"}]'::jsonb
      and (select auth.jwt())->'app_metadata'->>'provider' = 'email')
    or
    ((select auth.jwt())->'amr' @> '[{"method":"oauth"}]'::jsonb
      and ((select auth.jwt())->'app_metadata'->>'provider' = 'google'
        or (select auth.jwt())->'app_metadata'->'providers' @> '["google"]'::jsonb))
  )
);
