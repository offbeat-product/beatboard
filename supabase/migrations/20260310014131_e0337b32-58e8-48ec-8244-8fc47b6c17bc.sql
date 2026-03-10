ALTER TABLE public.finance_monthly
  ADD COLUMN total_assets bigint NULL,
  ADD COLUMN total_liabilities bigint NULL,
  ADD COLUMN net_assets bigint NULL;