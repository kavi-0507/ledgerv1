drop trigger if exists on_auth_user_created_default_setup on auth.users;
create trigger on_auth_user_created_default_setup
after insert on auth.users
for each row execute function public.handle_new_user_default_setup();

do $$
declare
  u record;
begin
  for u in select id from auth.users loop
    perform public.seed_user_default_setup(u.id);
  end loop;
end $$;

revoke all on function public.seed_user_default_setup(uuid) from public;
revoke all on function public.seed_user_default_setup(uuid) from anon;
revoke all on function public.seed_user_default_setup(uuid) from authenticated;
grant execute on function public.seed_user_default_setup(uuid) to service_role;

revoke all on function public.handle_new_user_default_setup() from public;
revoke all on function public.handle_new_user_default_setup() from anon;
revoke all on function public.handle_new_user_default_setup() from authenticated;
grant execute on function public.handle_new_user_default_setup() to service_role;