-- Apply to the existing database before deploying the new server.
-- Transactional and repeatable. Preserves business records and existing account roles.
BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='pgcrypto' AND n.nspname<>'extensions') THEN
    ALTER EXTENSION pgcrypto SET SCHEMA extensions;
  END IF;
END $$;
GRANT USAGE ON SCHEMA public,extensions TO service_role;
CREATE TABLE IF NOT EXISTS public.sessions (
  token_hash TEXT PRIMARY KEY CHECK(length(token_hash)=64),
  user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON public.sessions(expires_at);
CREATE TABLE IF NOT EXISTS public.rate_limits (
  key TEXT PRIMARY KEY, attempts INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One-time conversion of legacy plaintext; already hashed passwords remain unchanged.
UPDATE public.users SET password_hash=extensions.crypt(password_hash,extensions.gen_salt('bf',12))
WHERE password_hash !~ '^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$';

DO $$ DECLARE t TEXT; p RECORD; BEGIN
  FOREACH t IN ARRAY ARRAY['users','partners','cases','services','history','attachments','feedback','packages','package_usage','notifications','sessions','rate_limits'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,t);
    END LOOP;
    EXECUTE format('REVOKE ALL ON public.%I FROM anon,authenticated',t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
  END LOOP;
END $$;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon,authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon,authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon,authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.zar_rate_limit(p_key TEXT,p_limit INT,p_seconds INT)
RETURNS BOOLEAN LANGUAGE plpgsql SET search_path=public,extensions,pg_temp AS $$
DECLARE n INT; BEGIN
  DELETE FROM sessions WHERE expires_at < now();
  DELETE FROM rate_limits WHERE window_start < now()-interval '1 day';
  INSERT INTO rate_limits(key) VALUES(p_key) ON CONFLICT(key) DO UPDATE
  SET attempts=CASE WHEN rate_limits.window_start < now()-make_interval(secs=>p_seconds) THEN 1 ELSE rate_limits.attempts+1 END,
      window_start=CASE WHEN rate_limits.window_start < now()-make_interval(secs=>p_seconds) THEN now() ELSE rate_limits.window_start END
  RETURNING attempts INTO n;
  RETURN n<=p_limit;
END $$;

CREATE OR REPLACE FUNCTION public.zar_login(p_login TEXT,p_password TEXT)
RETURNS JSONB LANGUAGE plpgsql SET search_path=public,extensions,pg_temp AS $$
DECLARE u users; BEGIN
  SELECT * INTO u FROM users WHERE login=p_login OR regexp_replace(phone,'[[:space:]()-]','','g')=p_login LIMIT 1;
  IF u.id IS NULL OR u.password_hash<>extensions.crypt(p_password,u.password_hash) THEN RETURN NULL; END IF;
  RETURN to_jsonb(u)-'password_hash';
END $$;

CREATE OR REPLACE FUNCTION public.zar_create_user(p_name TEXT,p_phone TEXT,p_login TEXT,p_password TEXT,p_role TEXT,p_partner_id BIGINT)
RETURNS JSONB LANGUAGE plpgsql SET search_path=public,extensions,pg_temp AS $$
DECLARE u users; BEGIN
  IF p_role NOT IN ('client','operator','partner') THEN RAISE EXCEPTION 'Rol noto‘g‘ri.'; END IF;
  IF length(p_password)<10 OR octet_length(p_password)>72 THEN RAISE EXCEPTION 'Parol uzunligi noto‘g‘ri.'; END IF;
  IF EXISTS(SELECT 1 FROM users WHERE login IN (p_login,p_phone) OR regexp_replace(phone,'[[:space:]()-]','','g') IN (p_login,p_phone)) THEN RAISE EXCEPTION 'Bu telefon yoki login allaqachon ro‘yxatdan o‘tgan.'; END IF;
  IF p_role='partner' AND NOT EXISTS(SELECT 1 FROM partners WHERE id=p_partner_id) THEN RAISE EXCEPTION 'Hamkor topilmadi.'; END IF;
  INSERT INTO users(name,phone,login,password_hash,role,partner_id)
  VALUES(p_name,p_phone,p_login,extensions.crypt(p_password,extensions.gen_salt('bf',12)),p_role,p_partner_id) RETURNING * INTO u;
  RETURN to_jsonb(u)-'password_hash';
END $$;

CREATE OR REPLACE FUNCTION public.zar_create_request(p_input JSONB,p_user_id BIGINT)
RETURNS JSONB LANGUAGE plpgsql SET search_path=public,extensions,pg_temp AS $$
DECLARE c cases; f JSONB; secret TEXT:=encode(extensions.gen_random_bytes(32),'hex'); BEGIN
  INSERT INTO cases(name,phone,region,category,description,preferred_time,client_id,tracking_token)
  VALUES(p_input->>'name',p_input->>'phone',p_input->>'region',p_input->>'category',p_input->>'description',p_input->>'preferred_time',p_user_id,secret) RETURNING * INTO c;
  UPDATE cases SET number='ZAR-'||lpad(c.id::text,greatest(6,length(c.id::text)),'0') WHERE id=c.id RETURNING * INTO c;
  FOR f IN SELECT value FROM jsonb_array_elements(coalesce(p_input->'attachments','[]')) LOOP
    INSERT INTO attachments(case_id,name,type,size,data) VALUES(c.id,f->>'name',f->>'type',(f->>'size')::BIGINT,f->>'data');
  END LOOP;
  INSERT INTO history(case_id,kind,message,actor_name) VALUES(c.id,'status','Qabul qilindi','Tizim');
  INSERT INTO notifications(case_id,event,recipient_phone,message) VALUES(c.id,'request.created',c.phone,'Murojaat qabul qilindi: '||c.number);
  RETURN jsonb_build_object('case',jsonb_build_object('id',c.id,'number',c.number,'status',c.status),'trackingToken',secret);
END $$;

CREATE OR REPLACE FUNCTION public.zar_update_case(p_id BIGINT,p_changes JSONB,p_actor_id BIGINT)
RETURNS VOID LANGUAGE plpgsql SET search_path=public,extensions,pg_temp AS $$
DECLARE c cases; actor users; next_status TEXT; BEGIN
  SELECT * INTO actor FROM users WHERE id=p_actor_id AND role IN ('operator','director');
  IF actor.id IS NULL THEN RAISE EXCEPTION 'Ruxsat yo‘q.'; END IF;
  SELECT * INTO c FROM cases WHERE id=p_id FOR UPDATE;
  IF c.id IS NULL THEN RAISE EXCEPTION 'Murojaat topilmadi.'; END IF;
  IF c.status IN ('completed','cancelled') THEN RAISE EXCEPTION 'Yakunlangan murojaat o‘zgartirilmaydi.'; END IF;
  next_status:=coalesce(p_changes->>'status',c.status);
  IF next_status='completed' AND (NOT EXISTS(SELECT 1 FROM services WHERE case_id=p_id AND status<>'cancelled') OR EXISTS(SELECT 1 FROM services WHERE case_id=p_id AND status NOT IN ('completed','cancelled'))) THEN
    RAISE EXCEPTION 'Avval barcha faol xizmatlarni yakunlang.';
  END IF;
  IF next_status='cancelled' AND length(trim(coalesce(p_changes->>'note','')))=0 THEN RAISE EXCEPTION 'Bekor qilish sababini ichki qaydga yozing.'; END IF;
  IF p_changes->>'coordinator_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM users WHERE id=(p_changes->>'coordinator_id')::BIGINT AND role IN ('operator','director')) THEN RAISE EXCEPTION 'Koordinator noto‘g‘ri.'; END IF;
  UPDATE cases SET status=next_status,priority=coalesce(p_changes->>'priority',priority),
    due_at=coalesce((p_changes->>'due_at')::TIMESTAMPTZ,due_at),
    coordinator_id=CASE WHEN p_changes ? 'coordinator_id' THEN (p_changes->>'coordinator_id')::BIGINT ELSE coordinator_id END,updated_at=now() WHERE id=p_id;
  IF next_status='cancelled' THEN UPDATE services SET status='cancelled' WHERE case_id=p_id AND status NOT IN ('completed','cancelled'); END IF;
  IF next_status<>c.status THEN
    INSERT INTO history(case_id,kind,message,actor_name) VALUES(p_id,'status',next_status,actor.name);
    INSERT INTO notifications(case_id,event,recipient_phone,message) VALUES(p_id,'case.status_changed',c.phone,c.number||': '||next_status);
  END IF;
  IF p_changes->>'note' IS NOT NULL THEN INSERT INTO history(case_id,kind,message,actor_name) VALUES(p_id,'note',p_changes->>'note',actor.name); END IF;
  IF (p_changes ? 'coordinator_id') AND (p_changes->>'coordinator_id')::BIGINT IS DISTINCT FROM c.coordinator_id THEN
    INSERT INTO history(case_id,kind,message,actor_name) VALUES(p_id,'assignment','Koordinator yangilandi',actor.name);
  END IF;
  IF (p_changes ? 'due_at') AND (p_changes->>'due_at')::TIMESTAMPTZ IS DISTINCT FROM c.due_at THEN
    INSERT INTO history(case_id,kind,message,actor_name) VALUES(p_id,'deadline','Nazorat muddati yangilandi: '||(p_changes->>'due_at'),actor.name);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.zar_add_service(p_case_id BIGINT,p_title TEXT,p_partner_id BIGINT,p_price BIGINT,p_actor_id BIGINT)
RETURNS VOID LANGUAGE plpgsql SET search_path=public,extensions,pg_temp AS $$
DECLARE c cases; actor users; BEGIN
  SELECT * INTO actor FROM users WHERE id=p_actor_id AND role IN ('operator','director');
  IF actor.id IS NULL THEN RAISE EXCEPTION 'Ruxsat yo‘q.'; END IF;
  SELECT * INTO c FROM cases WHERE id=p_case_id FOR UPDATE;
  IF c.id IS NULL OR c.status IN ('completed','cancelled') THEN RAISE EXCEPTION 'Murojaat faol emas.'; END IF;
  IF p_partner_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM partners WHERE id=p_partner_id AND contract_status='active') THEN RAISE EXCEPTION 'Faqat faol shartnomali hamkorni tanlang.'; END IF;
  INSERT INTO services(case_id,title,partner_id,price) VALUES(p_case_id,p_title,p_partner_id,p_price);
  INSERT INTO history(case_id,kind,message,actor_name) VALUES(p_case_id,'service','Xizmat qo‘shildi: '||p_title,actor.name);
  INSERT INTO notifications(case_id,event,recipient_phone,message) VALUES(p_case_id,'service.assigned',c.phone,'Murojaat tarkibiga xizmat qo‘shildi: '||c.number);
END $$;

CREATE OR REPLACE FUNCTION public.zar_update_service(p_id BIGINT,p_status TEXT,p_partner_id BIGINT,p_change_partner BOOLEAN,p_actor_id BIGINT)
RETURNS BIGINT LANGUAGE plpgsql SET search_path=public,extensions,pg_temp AS $$
DECLARE s services; c cases; actor users; BEGIN
  SELECT * INTO actor FROM users WHERE id=p_actor_id;
  SELECT * INTO s FROM services WHERE id=p_id;
  IF s.id IS NULL THEN RAISE EXCEPTION 'Xizmat topilmadi.'; END IF;
  -- Always lock the parent before the service, consistent with case completion.
  SELECT * INTO c FROM cases WHERE id=s.case_id FOR UPDATE;
  SELECT * INTO s FROM services WHERE id=p_id FOR UPDATE;
  IF actor.id IS NULL OR actor.role NOT IN ('operator','director','partner') THEN RAISE EXCEPTION 'Ruxsat yo‘q.'; END IF;
  IF c.status IN ('completed','cancelled') OR s.status IN ('completed','cancelled') THEN RAISE EXCEPTION 'Yakunlangan xizmat o‘zgartirilmaydi.'; END IF;
  IF actor.role='partner' THEN
    IF actor.partner_id IS DISTINCT FROM s.partner_id OR p_change_partner THEN RAISE EXCEPTION 'Ruxsat yo‘q.'; END IF;
    IF p_status IS DISTINCT FROM (CASE s.status WHEN 'pending' THEN 'accepted' WHEN 'accepted' THEN 'contacted' WHEN 'contacted' THEN 'delivered' WHEN 'delivered' THEN 'completed' END) THEN RAISE EXCEPTION 'Keyingi bosqichni tanlang.'; END IF;
  END IF;
  IF p_change_partner AND p_partner_id IS DISTINCT FROM s.partner_id THEN
    IF s.status<>'pending' THEN RAISE EXCEPTION 'Boshlangan xizmat hamkori almashtirilmaydi.'; END IF;
    IF p_partner_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM partners WHERE id=p_partner_id AND contract_status='active') THEN RAISE EXCEPTION 'Faol shartnomali hamkor kerak.'; END IF;
  END IF;
  IF p_status IN ('accepted','contacted','delivered','completed') AND (CASE WHEN p_change_partner THEN p_partner_id ELSE s.partner_id END) IS NULL THEN RAISE EXCEPTION 'Avval hamkor biriktiring.'; END IF;
  UPDATE services SET status=p_status,partner_id=CASE WHEN p_change_partner THEN p_partner_id ELSE partner_id END WHERE id=p_id;
  INSERT INTO history(case_id,kind,message,actor_name) VALUES(s.case_id,'service',s.title||': '||p_status,actor.name);
  INSERT INTO notifications(case_id,event,recipient_phone,message) VALUES(s.case_id,'service.status_changed',c.phone,c.number||': xizmat holati yangilandi');
  RETURN s.case_id;
END $$;

CREATE OR REPLACE FUNCTION public.zar_save_package(p_client_id BIGINT,p_tier TEXT,p_expires_at TIMESTAMPTZ,p_limit INT,p_members JSONB)
RETURNS JSONB LANGUAGE plpgsql SET search_path=public,extensions,pg_temp AS $$
DECLARE p packages; BEGIN
  IF NOT EXISTS(SELECT 1 FROM users WHERE id=p_client_id AND role='client') THEN RAISE EXCEPTION 'Mijoz topilmadi.'; END IF;
  SELECT * INTO p FROM packages WHERE client_id=p_client_id FOR UPDATE;
  IF p.id IS NOT NULL AND p_limit<(SELECT count(*) FROM package_usage WHERE package_id=p.id) THEN RAISE EXCEPTION 'Limit foydalanilgan miqdordan kam bo‘lmasligi kerak.'; END IF;
  INSERT INTO packages(client_id,tier,expires_at,service_limit,members) VALUES(p_client_id,p_tier,p_expires_at,p_limit,p_members)
  ON CONFLICT(client_id) DO UPDATE SET tier=excluded.tier,expires_at=excluded.expires_at,service_limit=excluded.service_limit,members=excluded.members RETURNING * INTO p;
  RETURN to_jsonb(p);
END $$;

CREATE OR REPLACE FUNCTION public.zar_use_package(p_id BIGINT,p_case_id BIGINT,p_actor_id BIGINT)
RETURNS VOID LANGUAGE plpgsql SET search_path=public,extensions,pg_temp AS $$
DECLARE p packages; c cases; actor users; BEGIN
  SELECT * INTO actor FROM users WHERE id=p_actor_id AND role IN ('operator','director');
  IF actor.id IS NULL THEN RAISE EXCEPTION 'Ruxsat yo‘q.'; END IF;
  SELECT * INTO p FROM packages WHERE id=p_id FOR UPDATE;
  SELECT * INTO c FROM cases WHERE id=p_case_id;
  IF p.id IS NULL OR c.id IS NULL OR c.client_id IS DISTINCT FROM p.client_id THEN RAISE EXCEPTION 'Murojaat bu paket mijoziga tegishli emas.'; END IF;
  IF c.status<>'completed' THEN RAISE EXCEPTION 'Faqat yakunlangan murojaat hisobga olinadi.'; END IF;
  IF p.expires_at<=now() THEN RAISE EXCEPTION 'Paket muddati tugagan.'; END IF;
  IF (SELECT count(*) FROM package_usage WHERE package_id=p_id)>=p.service_limit THEN RAISE EXCEPTION 'Paket limiti tugagan.'; END IF;
  INSERT INTO package_usage(package_id,case_id) VALUES(p_id,p_case_id);
  INSERT INTO history(case_id,kind,message,actor_name) VALUES(p_case_id,'package','Oila paketidan 1 birlik foydalanildi',actor.name);
END $$;

CREATE OR REPLACE FUNCTION public.zar_stats()
RETURNS JSONB LANGUAGE sql SET search_path=public,extensions,pg_temp AS $$
 SELECT jsonb_build_object(
 'total',(SELECT count(*) FROM cases),
 'today',(SELECT count(*) FROM cases WHERE (created_at AT TIME ZONE 'Asia/Tashkent')::date=(now() AT TIME ZONE 'Asia/Tashkent')::date),
 'open',(SELECT count(*) FROM cases WHERE status NOT IN ('completed','cancelled')),
 'completed',(SELECT count(*) FROM cases WHERE status='completed'),
 'overdue',(SELECT count(*) FROM cases WHERE due_at<now() AND status NOT IN ('completed','cancelled')),
 'partners',(SELECT count(*) FROM partners),'clients',(SELECT count(*) FROM users WHERE role='client'),
 'packagesCount',(SELECT count(*) FROM packages),
 'activePackagesCount',(SELECT count(*) FROM packages p WHERE expires_at>now() AND service_limit>(SELECT count(*) FROM package_usage WHERE package_id=p.id)),
 'averageRating',(SELECT avg(rating) FROM feedback),
 'categories',coalesce((SELECT jsonb_agg(x) FROM (SELECT category AS id,category AS name,count(*) AS count FROM cases GROUP BY category) x),'[]'::jsonb));
$$;

-- These functions are callable ONLY by the server's service_role, never public RPC.
DO $$ DECLARE f RECORD; BEGIN
 FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'zar_%' LOOP
   EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
   EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
 END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
