revoke all on function public.seed_user_default_setup(uuid) from public;
revoke all on function public.seed_user_default_setup(uuid) from anon;
revoke all on function public.seed_user_default_setup(uuid) from authenticated;
grant execute on function public.seed_user_default_setup(uuid) to service_role;

revoke all on function public.handle_new_user_default_setup() from public;
revoke all on function public.handle_new_user_default_setup() from anon;
revoke all on function public.handle_new_user_default_setup() from authenticated;
grant execute on function public.handle_new_user_default_setup() to service_role;