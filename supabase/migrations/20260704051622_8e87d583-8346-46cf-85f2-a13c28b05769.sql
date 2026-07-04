DROP POLICY IF EXISTS "Users manage own budget snapshots" ON public.budget_group_snapshots;

CREATE POLICY "Users manage own budget snapshots"
ON public.budget_group_snapshots
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);