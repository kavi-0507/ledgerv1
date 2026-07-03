create table if not exists public.profiles (
  id uuid primary key,
  display_name text,
  currency text not null default 'GBP',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles_delete_own" on public.profiles for delete to authenticated using (auth.uid() = id);

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.accounts to authenticated;
grant all on public.accounts to service_role;
alter table public.accounts enable row level security;
create index if not exists accounts_user_id_idx on public.accounts(user_id);

drop policy if exists "accounts_manage_own" on public.accounts;
create policy "accounts_manage_own" on public.accounts for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  slug text,
  behaviour text,
  color text,
  icon text,
  sort_order integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);
grant select, insert, update, delete on public.categories to authenticated;
grant all on public.categories to service_role;
alter table public.categories enable row level security;
create index if not exists categories_user_id_idx on public.categories(user_id);

drop policy if exists "categories_manage_own" on public.categories;
create policy "categories_manage_own" on public.categories for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.merchant_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  pattern text not null,
  category_id uuid,
  behaviour text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.merchant_rules to authenticated;
grant all on public.merchant_rules to service_role;
alter table public.merchant_rules enable row level security;
create index if not exists merchant_rules_user_id_idx on public.merchant_rules(user_id);

drop policy if exists "merchant_rules_manage_own" on public.merchant_rules;
create policy "merchant_rules_manage_own" on public.merchant_rules for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.budget_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  category_ids uuid[] not null default '{}',
  amount numeric not null default 0,
  period text not null default 'monthly' check (period in ('weekly','monthly','termly')),
  kind text not null default 'expense' check (kind in ('expense','savings')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.budget_groups to authenticated;
grant all on public.budget_groups to service_role;
alter table public.budget_groups enable row level security;
create index if not exists budget_groups_user_id_idx on public.budget_groups(user_id);

drop policy if exists "budget_groups_manage_own" on public.budget_groups;
create policy "budget_groups_manage_own" on public.budget_groups for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  scope text not null default 'category' check (scope in ('overall','category')),
  period text not null default 'monthly' check (period in ('weekly','monthly')),
  category_id uuid,
  amount numeric not null default 0,
  starts_on date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.budgets to authenticated;
grant all on public.budgets to service_role;
alter table public.budgets enable row level security;
create index if not exists budgets_user_id_idx on public.budgets(user_id);

drop policy if exists "budgets_manage_own" on public.budgets;
create policy "budgets_manage_own" on public.budgets for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  filename text,
  status text check (status in ('preview','pending','confirmed','committed','completed','cancelled','failed')),
  total_rows integer default 0,
  new_rows integer default 0,
  duplicate_rows integer default 0,
  invalid_rows integer default 0,
  imported_rows integer default 0,
  preview_token text,
  committed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.imports to authenticated;
grant all on public.imports to service_role;
alter table public.imports enable row level security;
create index if not exists imports_user_id_idx on public.imports(user_id);

drop policy if exists "imports_manage_own" on public.imports;
create policy "imports_manage_own" on public.imports for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  account_id uuid,
  category_id uuid,
  occurred_on date not null,
  amount numeric not null,
  direction text not null check (direction in ('in','out')),
  description text not null,
  merchant text,
  notes text,
  behaviour text,
  needs_review boolean not null default false,
  is_transfer boolean default false,
  source text,
  import_id uuid,
  external_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.transactions to authenticated;
grant all on public.transactions to service_role;
alter table public.transactions enable row level security;
create index if not exists transactions_user_id_idx on public.transactions(user_id);
create index if not exists transactions_user_occurred_idx on public.transactions(user_id, occurred_on desc);

drop policy if exists "transactions_manage_own" on public.transactions;
create policy "transactions_manage_own" on public.transactions for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  detail text,
  due_on date,
  state text not null default 'pending' check (state in ('pending','snoozed','dismissed','done')),
  snoozed_until timestamptz,
  amount numeric,
  category_id uuid,
  recurrence text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.reminders to authenticated;
grant all on public.reminders to service_role;
alter table public.reminders enable row level security;
create index if not exists reminders_user_id_idx on public.reminders(user_id);

drop policy if exists "reminders_manage_own" on public.reminders;
create policy "reminders_manage_own" on public.reminders for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  body text,
  tone text check (tone in ('positive','warning','negative','neutral','info')),
  category_id uuid,
  score_delta integer,
  dismissed boolean not null default false,
  valid_for text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.recommendations to authenticated;
grant all on public.recommendations to service_role;
alter table public.recommendations enable row level security;
create index if not exists recommendations_user_id_idx on public.recommendations(user_id);

drop policy if exists "recommendations_manage_own" on public.recommendations;
create policy "recommendations_manage_own" on public.recommendations for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  week_start date not null,
  state text not null default 'open' check (state in ('open','completed')),
  score integer,
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.weekly_reviews to authenticated;
grant all on public.weekly_reviews to service_role;
alter table public.weekly_reviews enable row level security;
create index if not exists weekly_reviews_user_id_idx on public.weekly_reviews(user_id);

drop policy if exists "weekly_reviews_manage_own" on public.weekly_reviews;
create policy "weekly_reviews_manage_own" on public.weekly_reviews for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.update_updated_at_column();
drop trigger if exists categories_updated_at on public.categories;
create trigger categories_updated_at before update on public.categories for each row execute function public.update_updated_at_column();
drop trigger if exists merchant_rules_updated_at on public.merchant_rules;
create trigger merchant_rules_updated_at before update on public.merchant_rules for each row execute function public.update_updated_at_column();
drop trigger if exists budget_groups_updated_at on public.budget_groups;
create trigger budget_groups_updated_at before update on public.budget_groups for each row execute function public.update_updated_at_column();
drop trigger if exists budgets_updated_at on public.budgets;
create trigger budgets_updated_at before update on public.budgets for each row execute function public.update_updated_at_column();
drop trigger if exists imports_updated_at on public.imports;
create trigger imports_updated_at before update on public.imports for each row execute function public.update_updated_at_column();
drop trigger if exists transactions_updated_at on public.transactions;
create trigger transactions_updated_at before update on public.transactions for each row execute function public.update_updated_at_column();
drop trigger if exists reminders_updated_at on public.reminders;
create trigger reminders_updated_at before update on public.reminders for each row execute function public.update_updated_at_column();
drop trigger if exists recommendations_updated_at on public.recommendations;
create trigger recommendations_updated_at before update on public.recommendations for each row execute function public.update_updated_at_column();
drop trigger if exists weekly_reviews_updated_at on public.weekly_reviews;
create trigger weekly_reviews_updated_at before update on public.weekly_reviews for each row execute function public.update_updated_at_column();

create or replace function public.slugify_default_label(_value text)
returns text
language sql
immutable
set search_path = public
as $$
  select trim(both '-' from regexp_replace(lower(coalesce(_value, '')), '[^a-z0-9]+', '-', 'g'))
$$;

create or replace function public.seed_user_default_setup(_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category_map jsonb := '{}'::jsonb;
  v_ids uuid[];
begin
  if _user_id is null then
    return;
  end if;

  insert into public.profiles (id, currency)
  values (_user_id, 'GBP')
  on conflict (id) do nothing;

  insert into public.accounts (user_id, name, is_active)
  select _user_id, 'Main Account', true
  where not exists (select 1 from public.accounts where user_id = _user_id);

  insert into public.categories (user_id, name, slug, behaviour, color, icon, sort_order)
  values
    (_user_id, 'Rent & Housing', 'rent-housing', 'necessary', '#3F8F76', '🏠', 10),
    (_user_id, 'Utilities', 'utilities', 'necessary', '#3F8F76', '💡', 20),
    (_user_id, 'Groceries', 'groceries', 'necessary', '#3F8F76', '🛒', 30),
    (_user_id, 'Meal Plan', 'meal-plan', 'necessary', '#3F8F76', '🍱', 40),
    (_user_id, 'Transport', 'transport', 'necessary', '#3F8F76', '🚇', 50),
    (_user_id, 'Eating Out', 'eating-out', 'social', '#E1A54B', '🍔', 60),
    (_user_id, 'Shopping', 'shopping', 'treat', '#E1A54B', '🛍️', 70),
    (_user_id, 'Entertainment', 'entertainment', 'social', '#E1A54B', '🎮', 80),
    (_user_id, 'Subscriptions', 'subscriptions', 'convenience', '#E1A54B', '📺', 90),
    (_user_id, 'Health', 'health', 'necessary', '#E1A54B', '🏥', 100),
    (_user_id, 'Savings', 'savings', 'necessary', '#5FB89A', '💰', 110),
    (_user_id, 'Income', 'income', null, '#5FB89A', '📈', 120),
    (_user_id, 'Transfer', 'transfer', null, '#5FB89A', '🔄', 130),
    (_user_id, 'Other', 'other', null, '#8AA39B', '📦', 200)
  on conflict (user_id, name) do update set
    slug = coalesce(public.categories.slug, excluded.slug),
    behaviour = coalesce(public.categories.behaviour, excluded.behaviour),
    color = coalesce(public.categories.color, excluded.color),
    icon = coalesce(public.categories.icon, excluded.icon),
    sort_order = coalesce(public.categories.sort_order, excluded.sort_order);

  select jsonb_object_agg(lower(name), id) into v_category_map
  from public.categories
  where user_id = _user_id;

  insert into public.merchant_rules (user_id, pattern, category_id, behaviour, is_active)
  values
    (_user_id, '\b(tfl|transport for london|oyster|uber|bolt|trainline|national rail|lner|gwr)\b', (v_category_map->>'transport')::uuid, null, true),
    (_user_id, '\b(sakshis?|saakshis?|tiffin|meal ?plan)\b', (v_category_map->>'meal plan')::uuid, null, true),
    (_user_id, '\b(tesco|sainsbury''?s?|lidl|aldi|co-?op|waitrose|morrisons|asda|iceland|m&s food)\b', (v_category_map->>'groceries')::uuid, null, true),
    (_user_id, '\b(deliveroo|uber ?eats|just ?eat|justeat)\b', (v_category_map->>'eating out')::uuid, null, true),
    (_user_id, '\b(wetherspoon|nando''?s|pret|greggs|leon|itsu|five ?guys|pizza express|dishoom|franco manca|wagamama|byron|starbucks|costa|caffe nero)\b', (v_category_map->>'eating out')::uuid, null, true),
    (_user_id, '\b(netflix|spotify|disney\+?|prime video|apple\.com\/bill|itunes|hbo|youtube ?premium)\b', (v_category_map->>'subscriptions')::uuid, null, true),
    (_user_id, '\b(voxi|vodafone|ee mobile|o2|three|giffgaff|sky mobile|bt|virgin ?media|octopus energy|british gas|thames water)\b', (v_category_map->>'utilities')::uuid, null, true),
    (_user_id, '\b(openai|chatgpt|anthropic|claude\.ai|github|cursor\.sh|figma|notion|vercel)\b', (v_category_map->>'subscriptions')::uuid, null, true),
    (_user_id, '\b(amazon|amzn|ebay|argos|ikea|zara|h&m|uniqlo|asos)\b', (v_category_map->>'shopping')::uuid, null, true),
    (_user_id, '\b(boots|superdrug|pharmacy|nhs)\b', (v_category_map->>'health')::uuid, null, true)
  on conflict do nothing;

  if not exists (select 1 from public.budget_groups where user_id = _user_id) then
    insert into public.budget_groups (user_id, name, category_ids, amount, period, kind)
    values
      (_user_id, 'Rent & Bills', array_remove(array[(v_category_map->>'rent & housing')::uuid, (v_category_map->>'utilities')::uuid], null), 800, 'monthly', 'expense'),
      (_user_id, 'Food Budget', array_remove(array[(v_category_map->>'groceries')::uuid, (v_category_map->>'meal plan')::uuid, (v_category_map->>'eating out')::uuid], null), 250, 'monthly', 'expense'),
      (_user_id, 'Transport Budget', array_remove(array[(v_category_map->>'transport')::uuid], null), 80, 'monthly', 'expense'),
      (_user_id, 'Lifestyle Budget', array_remove(array[(v_category_map->>'shopping')::uuid, (v_category_map->>'entertainment')::uuid], null), 120, 'monthly', 'expense'),
      (_user_id, 'Subscriptions Budget', array_remove(array[(v_category_map->>'subscriptions')::uuid], null), 30, 'monthly', 'expense'),
      (_user_id, 'Health Budget', array_remove(array[(v_category_map->>'health')::uuid], null), 30, 'monthly', 'expense'),
      (_user_id, 'Other Buffer', array_remove(array[(v_category_map->>'other')::uuid], null), 40, 'monthly', 'expense'),
      (_user_id, 'Savings Target', array_remove(array[(v_category_map->>'savings')::uuid], null), 100, 'monthly', 'savings');
  end if;
end;
$$;

grant execute on function public.seed_user_default_setup(uuid) to authenticated;
grant execute on function public.seed_user_default_setup(uuid) to service_role;

create or replace function public.handle_new_user_default_setup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_user_default_setup(new.id);
  return new;
end;
$$;

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