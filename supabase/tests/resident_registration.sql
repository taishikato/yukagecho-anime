-- Run against the designated Supabase production project. All fixtures roll back.
begin;
set local statement_timeout = '10s';
do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  taken text := 't_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 18);
  n integer;
  invalid text;
begin
  insert into auth.users (id, email, email_confirmed_at, raw_app_meta_data)
  values (a, a::text || '@example.invalid', now(), '{"provider":"email"}'),
         (b, b::text || '@example.invalid', now(), '{"provider":"email"}');
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'email', a::text || '@example.invalid',
    'is_anonymous', false, 'amr', json_build_array(json_build_object('method','oauth')),
    'app_metadata', json_build_object('provider','google'))::text, true);
  set local role authenticated;
  insert into public.residents(user_id, username) values(a, taken);
  select count(*) into n from public.residents where user_id = a;
  if n <> 1 then raise exception 'Owner cannot read reservation'; end if;
  begin
    insert into public.residents(user_id, username) values(b, 'forged_owner');
    raise exception 'Forged ownership accepted';
  exception when insufficient_privilege then null; end;
  begin
    update public.residents set username = 'renamed' where user_id = a;
    raise exception 'Update accepted';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.residents where user_id = a;
    raise exception 'Delete accepted';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.residents(user_id, username, reserved_at) values(a, 'custom_date', now());
    raise exception 'Client supplied timestamp accepted';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.residents(user_id, username) values(a, 'second_name');
    raise exception 'Second reservation accepted';
  exception when unique_violation then null; end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'email', b::text || '@example.invalid',
    'is_anonymous', false, 'amr', json_build_array(json_build_object('method','oauth')),
    'app_metadata', json_build_object('provider','google'))::text, true);
  set local role authenticated;
  select count(*) into n from public.residents where user_id = a;
  if n <> 0 then raise exception 'Another user can read reservation'; end if;
  begin
    insert into public.residents(user_id, username) values(b, taken);
    raise exception 'Duplicate username accepted';
  exception when unique_violation then null; end;
  foreach invalid in array array['ab', repeat('a',21), 'ABC', 'two words', 'a-b', '湯影町',
    'admin','administrator','support','system','yukagecho','moderator','staff','official'] loop
    begin
      insert into public.residents(user_id, username) values(b, invalid);
      raise exception 'Invalid username accepted: %', invalid;
    exception when check_violation then null; end;
  end loop;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'email', b::text || '@example.invalid',
    'is_anonymous', true, 'amr', json_build_array(json_build_object('method','oauth')),
    'app_metadata', json_build_object('provider','google'))::text, true);
  set local role authenticated;
  begin
    insert into public.residents(user_id, username) values(b, 'anonymous_test');
    raise exception 'Anonymous session accepted';
  exception when insufficient_privilege then null; end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'email', b::text || '@example.invalid',
    'is_anonymous', false, 'amr', json_build_array(json_build_object('method','password')),
    'app_metadata', json_build_object('provider','google'))::text, true);
  set local role authenticated;
  begin
    insert into public.residents(user_id, username) values(b, 'no_otp_test');
    raise exception 'Session without OAuth accepted';
  exception when insufficient_privilege then null; end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'email', b::text || '@example.invalid',
    'is_anonymous', false, 'amr', json_build_array(json_build_object('method','oauth')),
    'app_metadata', json_build_object('provider','github'),
    'user_metadata', json_build_object('provider','google','providers',json_build_array('google')))::text, true);
  set local role authenticated;
  begin
    insert into public.residents(user_id, username) values(b, 'fake_google');
    raise exception 'User-editable Google provider accepted';
  exception when insufficient_privilege then null; end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'email', b::text || '@example.invalid',
    'is_anonymous', false, 'amr', json_build_array(json_build_object('method','oauth')),
    'app_metadata', json_build_object('provider','email','providers',json_build_array('email','google')))::text, true);
  set local role authenticated;
  insert into public.residents(user_id, username) values(b, 'l_' || substr(replace(b::text, '-', ''), 1, 18));
  reset role;
  set local role anon;
  if public.username_available(taken) is distinct from false then
    raise exception 'Taken username reported available'; end if;
  if public.username_available('f_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 18)) is distinct from true then
    raise exception 'Free username reported unavailable'; end if;
  foreach invalid in array array[null::text, '', 'ABC', 'ab', repeat('a',21), 'admin', 'a%'] loop
    if public.username_available(invalid) is distinct from false then
      raise exception 'Invalid username reported available'; end if;
  end loop;
  begin
    perform * from public.residents;
    raise exception 'Anon read accepted';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.residents(user_id, username) values(b, 'anon_test');
    raise exception 'Anon insert accepted';
  exception when insufficient_privilege then null; end;
  reset role;
end $$;
rollback;
select 'All ownership, privilege, namespace and Google OAuth assertions passed; fixtures rolled back.' as result;
