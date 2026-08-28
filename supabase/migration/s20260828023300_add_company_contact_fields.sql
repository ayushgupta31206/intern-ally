ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS contact_name text, ADD COLUMN IF NOT EXISTS contact_designation text, ADD COLUMN IF NOT EXISTS contact_email text;
