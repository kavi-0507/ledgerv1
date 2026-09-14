CREATE TABLE public.rent_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  due_date date NOT NULL,
  recurrence text NOT NULL DEFAULT 'monthly',
  status text NOT NULL DEFAULT 'pending',
  paid_at timestamp with time zone,
  notes text,
  series_id uuid REFERENCES public.rent_bills(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT rent_bills_recurrence_check CHECK (recurrence IN ('one-off', 'weekly', 'monthly', 'termly', 'yearly')),
  CONSTRAINT rent_bills_status_check CHECK (status IN ('pending', 'paid'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rent_bills TO authenticated;
GRANT ALL ON public.rent_bills TO service_role;

ALTER TABLE public.rent_bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own rent bills"
  ON public.rent_bills
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX rent_bills_user_status_due ON public.rent_bills (user_id, status, due_date);
CREATE INDEX rent_bills_user_series ON public.rent_bills (user_id, series_id);

CREATE TRIGGER rent_bills_updated_at
  BEFORE UPDATE ON public.rent_bills
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();