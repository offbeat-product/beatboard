
CREATE TABLE IF NOT EXISTS public.finance_monthly (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id TEXT NOT NULL,
  year_month TEXT NOT NULL,
  cash_and_deposits BIGINT DEFAULT 0,
  accounts_receivable BIGINT DEFAULT 0,
  accounts_payable BIGINT DEFAULT 0,
  borrowings BIGINT DEFAULT 0,
  interest_expense BIGINT DEFAULT 0,
  income_amount BIGINT DEFAULT 0,
  expense_amount BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, year_month)
);

ALTER TABLE public.finance_monthly ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all finance_monthly" ON public.finance_monthly FOR ALL USING (true) WITH CHECK (true);
