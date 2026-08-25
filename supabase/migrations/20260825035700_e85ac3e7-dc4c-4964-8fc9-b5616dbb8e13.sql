REVOKE EXECUTE ON FUNCTION public.current_intern_ids() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_intern_ids() FROM anon;
GRANT EXECUTE ON FUNCTION public.current_intern_ids() TO authenticated;