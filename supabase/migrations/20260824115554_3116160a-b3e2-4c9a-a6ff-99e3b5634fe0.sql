ALTER TABLE public.companies RENAME COLUMN ready_flag TO onboarded_request;
ALTER TABLE public.companies RENAME COLUMN ready_flagged_at TO onboarded_requested_at;
ALTER TABLE public.companies ADD COLUMN interested boolean NOT NULL DEFAULT false;
ALTER TABLE public.companies ADD COLUMN interested_at timestamp with time zone;