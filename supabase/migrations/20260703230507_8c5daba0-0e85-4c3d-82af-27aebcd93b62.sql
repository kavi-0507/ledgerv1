do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'transactions_category_id_fkey') then
    alter table public.transactions
      add constraint transactions_category_id_fkey foreign key (category_id) references public.categories(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'transactions_account_id_fkey') then
    alter table public.transactions
      add constraint transactions_account_id_fkey foreign key (account_id) references public.accounts(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'transactions_import_id_fkey') then
    alter table public.transactions
      add constraint transactions_import_id_fkey foreign key (import_id) references public.imports(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'budgets_category_id_fkey') then
    alter table public.budgets
      add constraint budgets_category_id_fkey foreign key (category_id) references public.categories(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'merchant_rules_category_id_fkey') then
    alter table public.merchant_rules
      add constraint merchant_rules_category_id_fkey foreign key (category_id) references public.categories(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reminders_category_id_fkey') then
    alter table public.reminders
      add constraint reminders_category_id_fkey foreign key (category_id) references public.categories(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'recommendations_category_id_fkey') then
    alter table public.recommendations
      add constraint recommendations_category_id_fkey foreign key (category_id) references public.categories(id) on delete set null;
  end if;
end $$;