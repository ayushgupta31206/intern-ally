-- Allow "survey_completed" as a valid outcome value for companies
ALTER TABLE public.companies DROP CONSTRAINT IF EXISTS companies_outcome_check;
ALTER TABLE public.companies ADD CONSTRAINT companies_outcome_check
  CHECK (outcome IS NULL OR outcome IN ('interested','not_interested','didnt_pick','onboard_request','survey_completed'));
