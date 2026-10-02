-- Apply to the Supabase project configured by this repository's .env.
create table if not exists public.ledger_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  revision integer not null check (revision > 0),
  updated_at timestamptz not null default now(),
  constraint ledger_state_shape check (
    jsonb_typeof(state) = 'object'
    and jsonb_typeof(state -> 'transactions') = 'array'
    and jsonb_typeof(state -> 'budgets') = 'array'
    and jsonb_typeof(state -> 'bills') = 'array'
    and jsonb_typeof(state -> 'rules') = 'array'
    and jsonb_typeof(state -> 'imports') = 'array'
    and octet_length(state::text) <= 8000000
  )
);

alter table public.ledger_workspaces enable row level security;
grant select, insert, update on public.ledger_workspaces to authenticated;
revoke all on public.ledger_workspaces from anon;

create policy "Read own Ledger workspace" on public.ledger_workspaces
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Create own Ledger workspace" on public.ledger_workspaces
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own Ledger workspace" on public.ledger_workspaces
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- The revision comparison and write happen in one database statement.
create or replace function public.save_ledger_workspace(
  expected_revision integer,
  next_state jsonb
) returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare saved_revision integer;
begin
  if auth.uid() is null then
    raise exception 'sign_in_required';
  end if;
  if expected_revision < 0 or next_state is null then
    raise exception 'invalid_workspace';
  end if;
  if expected_revision > 0 and not exists (
    select 1 from public.ledger_workspaces
    where user_id = auth.uid()
  ) then
    raise exception 'revision_conflict';
  end if;
  insert into public.ledger_workspaces (user_id, state, revision)
    values (auth.uid(), next_state, 1)
  on conflict (user_id) do update
    set state = excluded.state,
        revision = public.ledger_workspaces.revision + 1,
        updated_at = now()
    where public.ledger_workspaces.revision = expected_revision
  returning revision into saved_revision;
  if saved_revision is null then
    raise exception 'revision_conflict';
  end if;
  return saved_revision;
end;
$$;

revoke all on function public.save_ledger_workspace(integer, jsonb) from public;
grant execute on function public.save_ledger_workspace(integer, jsonb) to authenticated;
