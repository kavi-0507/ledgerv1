
CREATE TABLE public.budget_group_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month date NOT NULL,
  groups jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, month)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_group_snapshots TO authenticated;
GRANT ALL ON public.budget_group_snapshots TO service_role;

ALTER TABLE public.budget_group_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own budget snapshots"
  ON public.budget_group_snapshots FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX budget_group_snapshots_user_month_idx
  ON public.budget_group_snapshots (user_id, month DESC);

CREATE TRIGGER update_budget_group_snapshots_updated_at
  BEFORE UPDATE ON public.budget_group_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
