-- Apply after 004. Preserve existing usage and reject future double deductions.
BEGIN;
CREATE OR REPLACE FUNCTION public.zar_single_benefit()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 PERFORM 1 FROM cases WHERE id=NEW.case_id FOR UPDATE;
 IF TG_TABLE_NAME='package_usage' THEN
  IF EXISTS(SELECT 1 FROM subscription_usage WHERE case_id=NEW.case_id) THEN
   RAISE EXCEPTION 'Bu murojaat allaqachon obunadan hisoblangan.';
  END IF;
 ELSE
  IF EXISTS(SELECT 1 FROM package_usage WHERE case_id=NEW.case_id) THEN
   RAISE EXCEPTION 'Bu murojaat allaqachon qo‘lda berilgan paketdan hisoblangan.';
  END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS zar_single_benefit ON public.package_usage;
CREATE TRIGGER zar_single_benefit BEFORE INSERT OR UPDATE OF case_id ON public.package_usage
 FOR EACH ROW EXECUTE FUNCTION public.zar_single_benefit();
DROP TRIGGER IF EXISTS zar_single_benefit ON public.subscription_usage;
CREATE TRIGGER zar_single_benefit BEFORE INSERT OR UPDATE OF case_id ON public.subscription_usage
 FOR EACH ROW EXECUTE FUNCTION public.zar_single_benefit();
REVOKE ALL ON FUNCTION public.zar_single_benefit() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.zar_benefit_ready()
RETURNS boolean LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
 SELECT count(*)=2 FROM pg_trigger WHERE tgname='zar_single_benefit'
 AND tgrelid IN ('public.package_usage'::regclass,'public.subscription_usage'::regclass) AND tgenabled='O';
$$;
REVOKE ALL ON FUNCTION public.zar_benefit_ready() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.zar_benefit_ready() TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
