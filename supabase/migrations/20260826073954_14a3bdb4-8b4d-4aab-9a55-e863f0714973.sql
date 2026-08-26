UPDATE public.companies SET owner_id = 'f43afd45-d4e3-4615-9959-869fbb3fe88c' WHERE owner_id IS NULL;
UPDATE public.interns SET owner_id = 'f43afd45-d4e3-4615-9959-869fbb3fe88c' WHERE owner_id IS NULL;
UPDATE public.onboarded_companies SET owner_id = 'f43afd45-d4e3-4615-9959-869fbb3fe88c' WHERE owner_id IS NULL;

ALTER TABLE public.companies
  ALTER COLUMN owner_id SET DEFAULT auth.uid(),
  ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE public.interns
  ALTER COLUMN owner_id SET DEFAULT auth.uid(),
  ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE public.onboarded_companies
  ALTER COLUMN owner_id SET DEFAULT auth.uid(),
  ALTER COLUMN owner_id SET NOT NULL;

ALTER TABLE public.interns DROP CONSTRAINT IF EXISTS interns_email_key;
CREATE UNIQUE INDEX IF NOT EXISTS interns_owner_email_key ON public.interns (owner_id, lower(email));

UPDATE public.companies SET outcome = NULL, outcome_at = NULL
  WHERE outcome IS NOT NULL
    AND outcome NOT IN ('interested','not_interested','didnt_pick','onboard_request');
ALTER TABLE public.companies DROP CONSTRAINT IF EXISTS companies_outcome_check;
ALTER TABLE public.companies ADD CONSTRAINT companies_outcome_check
  CHECK (outcome IS NULL OR outcome IN ('interested','not_interested','didnt_pick','onboard_request'));