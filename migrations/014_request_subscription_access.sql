-- Public submission gate: one free request per normalized phone, then an owned benefit.
BEGIN;
CREATE OR REPLACE FUNCTION public.zar_submit_request(p_input JSONB,p_user_id BIGINT,p_actor_id BIGINT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SET search_path=public,extensions,pg_temp AS $$
DECLARE mobile TEXT:=regexp_replace(coalesce(p_input->>'phone',''),'[^0-9]','','g'); u users; allowed BOOLEAN:=false;
BEGIN
 IF length(mobile)=9 THEN mobile:='998'||mobile; END IF;
 IF mobile !~ '^998[0-9]{9}$' THEN RAISE EXCEPTION 'Telefon raqami noto‘g‘ri.'; END IF;
 IF p_actor_id IS NOT NULL THEN
  SELECT * INTO u FROM users WHERE id=p_actor_id AND role IN ('operator','director') AND to_jsonb(users)->>'blocked_at' IS NULL;
  IF u.id IS NULL THEN RAISE EXCEPTION 'Ruxsat yo‘q.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('request:'||mobile,0));
  RETURN zar_create_request(p_input,p_user_id);
 END IF;
 IF p_user_id IS NOT NULL THEN
  SELECT * INTO u FROM users WHERE id=p_user_id AND role='client' AND to_jsonb(users)->>'blocked_at' IS NULL FOR UPDATE;
  IF u.id IS NULL THEN RAISE EXCEPTION 'Mijoz hisobi topilmadi.'; END IF;
  -- A subscriber may request help for family members through their own account.
  SELECT EXISTS(SELECT 1 FROM family_subscriptions WHERE client_id=u.id AND mode='live' AND status='active' AND starts_at<=now() AND expires_at>now())
    OR EXISTS(SELECT 1 FROM packages p WHERE p.client_id=u.id AND p.expires_at>now() AND p.service_limit>(SELECT count(*) FROM package_usage pu WHERE pu.package_id=p.id)) INTO allowed;
 END IF;
 -- Account before phone matches Telegram/Payme lock order and prevents a refund race.
 PERFORM pg_advisory_xact_lock(hashtextextended('request:'||mobile,0));
 IF NOT allowed AND EXISTS(SELECT 1 FROM cases WHERE
  CASE WHEN length(regexp_replace(phone,'[^0-9]','','g'))=9 THEN '998'||regexp_replace(phone,'[^0-9]','','g') ELSE regexp_replace(phone,'[^0-9]','','g') END=mobile)
 THEN RETURN jsonb_build_object('subscriptionRequired',true); END IF;
 RETURN zar_create_request(p_input,p_user_id);
END $$;
REVOKE ALL ON FUNCTION public.zar_submit_request(JSONB,BIGINT,BIGINT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.zar_submit_request(JSONB,BIGINT,BIGINT) TO service_role;
CREATE INDEX IF NOT EXISTS cases_request_phone_access ON public.cases
 ((CASE WHEN length(regexp_replace(phone,'[^0-9]','','g'))=9 THEN '998'||regexp_replace(phone,'[^0-9]','','g') ELSE regexp_replace(phone,'[^0-9]','','g') END));
NOTIFY pgrst,'reload schema';
COMMIT;
