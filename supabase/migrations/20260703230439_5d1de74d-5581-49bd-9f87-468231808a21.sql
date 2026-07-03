alter table public.profiles
  add column if not exists defaults_seeded_at timestamptz,
  add column if not exists defaults_source_user_id uuid;

create or replace function public.seed_user_default_setup(_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source_user_id uuid;
  v_source_category_count integer := 0;
  v_category_map jsonb := '{}'::jsonb;
  v_budget record;
  v_rule record;
  v_category_ids uuid[];
begin
  if _user_id is null then
    return;
  end if;

  select id into v_source_user_id
  from auth.users
  where lower(email) = 'test@lovable.app'
  order by created_at asc
  limit 1;

  select count(*) into v_source_category_count
  from public.categories
  where user_id = v_source_user_id;

  insert into public.profiles (id, currency)
  values (_user_id, 'GBP')
  on conflict (id) do nothing;

  insert into public.accounts (user_id, name, is_active)
  select _user_id, 'Main Account', true
  where not exists (select 1 from public.accounts where user_id = _user_id);

  if v_source_user_id is not null and v_source_user_id <> _user_id and v_source_category_count > 0 then
    insert into public.categories (user_id, name, slug, behaviour, color, icon, sort_order)
    select
      _user_id,
      c.name,
      coalesce(c.slug, public.slugify_default_label(c.name)),
      c.behaviour,
      c.color,
      c.icon,
      c.sort_order
    from public.categories c
    where c.user_id = v_source_user_id
    on conflict (user_id, name) do update set
      slug = excluded.slug,
      behaviour = excluded.behaviour,
      color = excluded.color,
      icon = excluded.icon,
      sort_order = excluded.sort_order;

    select jsonb_object_agg(lower(name), id) into v_category_map
    from public.categories
    where user_id = _user_id;

    for v_rule in
      select
        r.pattern,
        r.behaviour,
        r.is_active,
        sc.name as source_category_name
      from public.merchant_rules r
      left join public.categories sc on sc.id = r.category_id and sc.user_id = v_source_user_id
      where r.user_id = v_source_user_id
      order by r.created_at asc
    loop
      if exists (
        select 1 from public.merchant_rules
        where user_id = _user_id and pattern = v_rule.pattern
      ) then
        update public.merchant_rules
        set
          category_id = case
            when v_rule.source_category_name is null then null
            else (v_category_map->>lower(v_rule.source_category_name))::uuid
          end,
          behaviour = v_rule.behaviour,
          is_active = coalesce(v_rule.is_active, true)
        where user_id = _user_id and pattern = v_rule.pattern;
      else
        insert into public.merchant_rules (user_id, pattern, category_id, behaviour, is_active)
        values (
          _user_id,
          v_rule.pattern,
          case
            when v_rule.source_category_name is null then null
            else (v_category_map->>lower(v_rule.source_category_name))::uuid
          end,
          v_rule.behaviour,
          coalesce(v_rule.is_active, true)
        );
      end if;
    end loop;

    for v_budget in
      select * from public.budget_groups
      where user_id = v_source_user_id
      order by created_at asc
    loop
      select coalesce(array_agg((v_category_map->>lower(sc.name))::uuid order by u.ord), '{}'::uuid[])
      into v_category_ids
      from unnest(v_budget.category_ids) with ordinality as u(source_category_id, ord)
      join public.categories sc on sc.id = u.source_category_id and sc.user_id = v_source_user_id
      where v_category_map ? lower(sc.name);

      if exists (
        select 1 from public.budget_groups
        where user_id = _user_id and lower(name) = lower(v_budget.name)
      ) then
        update public.budget_groups
        set
          category_ids = v_category_ids,
          amount = v_budget.amount,
          period = v_budget.period,
          kind = v_budget.kind
        where user_id = _user_id and lower(name) = lower(v_budget.name);
      else
        insert into public.budget_groups (user_id, name, category_ids, amount, period, kind)
        values (_user_id, v_budget.name, v_category_ids, v_budget.amount, v_budget.period, v_budget.kind);
      end if;
    end loop;
  else
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
      slug = excluded.slug,
      behaviour = excluded.behaviour,
      color = excluded.color,
      icon = excluded.icon,
      sort_order = excluded.sort_order;

    select jsonb_object_agg(lower(name), id) into v_category_map
    from public.categories
    where user_id = _user_id;

    insert into public.merchant_rules (user_id, pattern, category_id, behaviour, is_active)
    select _user_id, x.pattern, (v_category_map->>x.category_name)::uuid, null, true
    from (values
      ('\b(tfl|transport for london|oyster|uber|bolt|trainline|national rail|lner|gwr)\b', 'transport'),
      ('\b(sakshis?|saakshis?|tiffin|meal ?plan)\b', 'meal plan'),
      ('\b(tesco|sainsbury''?s?|lidl|aldi|co-?op|waitrose|morrisons|asda|iceland|m&s food)\b', 'groceries'),
      ('\b(deliveroo|uber ?eats|just ?eat|justeat)\b', 'eating out'),
      ('\b(wetherspoon|nando''?s|pret|greggs|leon|itsu|five ?guys|pizza express|dishoom|franco manca|wagamama|byron|starbucks|costa|caffe nero)\b', 'eating out'),
      ('\b(netflix|spotify|disney\+?|prime video|apple\.com\/bill|itunes|hbo|youtube ?premium)\b', 'subscriptions'),
      ('\b(voxi|vodafone|ee mobile|o2|three|giffgaff|sky mobile|bt|virgin ?media|octopus energy|british gas|thames water)\b', 'utilities'),
      ('\b(openai|chatgpt|anthropic|claude\.ai|github|cursor\.sh|figma|notion|vercel)\b', 'subscriptions'),
      ('\b(amazon|amzn|ebay|argos|ikea|zara|h&m|uniqlo|asos)\b', 'shopping'),
      ('\b(boots|superdrug|pharmacy|nhs)\b', 'health')
    ) as x(pattern, category_name)
    where not exists (
      select 1 from public.merchant_rules r
      where r.user_id = _user_id and r.pattern = x.pattern
    );

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
  end if;

  update public.profiles
  set
    defaults_seeded_at = coalesce(defaults_seeded_at, now()),
    defaults_source_user_id = v_source_user_id
  where id = _user_id;
end;
$$;

revoke all on function public.seed_user_default_setup(uuid) from public;
revoke all on function public.seed_user_default_setup(uuid) from anon;
revoke all on function public.seed_user_default_setup(uuid) from authenticated;
grant execute on function public.seed_user_default_setup(uuid) to service_role;

do $$
declare
  u record;
begin
  for u in select id from auth.users loop
    perform public.seed_user_default_setup(u.id);
  end loop;
end $$;