CREATE TABLE public.interns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX interns_email_lower_idx ON public.interns (lower(email));

CREATE TABLE public.companies (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'unassigned' CHECK (status IN ('unassigned','assigned')),
  assigned_to uuid REFERENCES public.interns(id) ON DELETE SET NULL,
  date_assigned date,
  ready_flag boolean NOT NULL DEFAULT false,
  ready_flagged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX companies_name_lower_idx ON public.companies (lower(name));
CREATE INDEX companies_status_idx ON public.companies (status);
CREATE INDEX companies_assigned_idx ON public.companies (assigned_to, date_assigned);

CREATE TABLE public.onboarded_companies (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  onboarded_by text,
  intern_id uuid REFERENCES public.interns(id) ON DELETE SET NULL,
  date_onboarded date NOT NULL DEFAULT current_date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX onboarded_date_idx ON public.onboarded_companies (date_onboarded);

CREATE OR REPLACE FUNCTION public.current_intern_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.interns
  WHERE lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  LIMIT 1
$$;

GRANT SELECT ON public.interns TO authenticated;
GRANT ALL ON public.interns TO service_role;
GRANT SELECT ON public.companies TO authenticated;
GRANT UPDATE (ready_flag, ready_flagged_at) ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
GRANT ALL ON public.onboarded_companies TO service_role;

ALTER TABLE public.interns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarded_companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Interns can view their own record"
  ON public.interns FOR SELECT TO authenticated
  USING (id = public.current_intern_id());

CREATE POLICY "Interns can view companies assigned to them"
  ON public.companies FOR SELECT TO authenticated
  USING (assigned_to IS NOT NULL AND assigned_to = public.current_intern_id());

CREATE POLICY "Interns can flag their own assigned companies"
  ON public.companies FOR UPDATE TO authenticated
  USING (assigned_to IS NOT NULL AND assigned_to = public.current_intern_id())
  WITH CHECK (assigned_to IS NOT NULL AND assigned_to = public.current_intern_id());