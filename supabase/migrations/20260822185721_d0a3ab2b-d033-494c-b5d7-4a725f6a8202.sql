REVOKE EXECUTE ON FUNCTION public.current_intern_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_intern_id() FROM anon;
GRANT EXECUTE ON FUNCTION public.current_intern_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_intern_id() TO service_role;