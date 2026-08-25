-- Owner columns
ALTER TABLE public.companies ADD COLUMN owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.interns ADD COLUMN owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.onboarded_companies ADD COLUMN owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX companies_owner_idx ON public.companies (owner_id);
CREATE INDEX interns_owner_idx ON public.interns (owner_id);
CREATE INDEX onboarded_owner_idx ON public.onboarded_companies (owner_id);

-- Per-owner uniqueness instead of global uniqueness
DROP INDEX IF EXISTS public.companies_name_lower_idx;
DROP INDEX IF EXISTS public.interns_email_lower_idx;
CREATE UNIQUE INDEX companies_owner_name_idx ON public.companies (owner_id, lower(name));
CREATE UNIQUE INDEX interns_owner_email_idx ON public.interns (owner_id, lower(email));

-- Single outcome instead of two booleans
ALTER TABLE public.companies ADD COLUMN outcome text
  CHECK (outcome IN ('interested', 'not_interested', 'didnt_pick', 'onboarded_request'));
ALTER TABLE public.companies ADD COLUMN outcome_at timestamptz;

UPDATE public.companies SET outcome = 'onboarded_request', outcome_at = onboarded_requested_at
  WHERE onboarded_request = true;
UPDATE public.companies SET outcome = 'interested', outcome_at = interested_at
  WHERE outcome IS NULL AND interested = true;

ALTER TABLE public.companies
  DROP COLUMN interested,
  DROP COLUMN interested_at,
  DROP COLUMN onboarded_request,
  DROP COLUMN onboarded_requested_at;

-- Drop old policies, then the old helper function
DROP POLICY IF EXISTS "Interns can view companies assigned to them" ON public.companies;
DROP POLICY IF EXISTS "Interns can flag their own assigned companies" ON public.companies;
DROP POLICY IF EXISTS "Interns can view their own record" ON public.interns;
DROP FUNCTION IF EXISTS public.current_intern_id();

-- An email can be an intern under multiple admins
CREATE OR REPLACE FUNCTION public.current_intern_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.interns
  WHERE lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

CREATE POLICY "Interns can view companies assigned to them" ON public.companies
  FOR SELECT TO authenticated
  USING (assigned_to IS NOT NULL AND assigned_to IN (SELECT public.current_intern_ids()));

CREATE POLICY "Interns can set outcome on their companies" ON public.companies
  FOR UPDATE TO authenticated
  USING (assigned_to IS NOT NULL AND assigned_to IN (SELECT public.current_intern_ids()))
  WITH CHECK (assigned_to IS NOT NULL AND assigned_to IN (SELECT public.current_intern_ids()));

CREATE POLICY "Owners manage their companies" ON public.companies
  FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Interns can view their own record" ON public.interns
  FOR SELECT TO authenticated
  USING (id IN (SELECT public.current_intern_ids()));

CREATE POLICY "Owners manage their interns" ON public.interns
  FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners manage their onboarded companies" ON public.onboarded_companies
  FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarded_companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
GRANT ALL ON public.interns TO service_role;
GRANT ALL ON public.onboarded_companies TO service_role;