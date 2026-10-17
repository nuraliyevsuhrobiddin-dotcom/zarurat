-- Secure upgrade; preserves records.
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

ALTER TABLE public.cases ALTER COLUMN due_at DROP NOT NULL;

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
    due_at=CASE WHEN p_changes ? 'due_at' THEN (p_changes->>'due_at')::TIMESTAMPTZ ELSE due_at END,
    category=coalesce(p_changes->>'category',category),region=coalesce(p_changes->>'region',region),
    preferred_time=coalesce(p_changes->>'preferred_time',preferred_time),
    coordinator_id=CASE WHEN p_changes ? 'coordinator_id' THEN (p_changes->>'coordinator_id')::BIGINT ELSE coordinator_id END,updated_at=now() WHERE id=p_id;
  IF (p_changes->>'category' IS NOT NULL AND p_changes->>'category' IS DISTINCT FROM c.category) OR (p_changes->>'region' IS NOT NULL AND p_changes->>'region' IS DISTINCT FROM c.region) OR (p_changes->>'preferred_time' IS NOT NULL AND p_changes->>'preferred_time' IS DISTINCT FROM c.preferred_time) THEN
    INSERT INTO history(case_id,kind,message,actor_name) VALUES(p_id,'clarification','Murojaat ma''lumotlari aniqlashtirildi',actor.name);
  END IF;
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
    INSERT INTO history(case_id,kind,message,actor_name) VALUES(p_id,'deadline','Nazorat muddati yangilandi: '||coalesce(p_changes->>'due_at','-'),actor.name);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.zar_capabilities() RETURNS JSONB LANGUAGE sql SET search_path=public,pg_temp AS $$ SELECT '{"clarification":true}'::jsonb $$;


CREATE OR REPLACE FUNCTION public.zar_client_counts() RETURNS JSONB LANGUAGE sql SET search_path=public,pg_temp AS $$
SELECT coalesce(jsonb_object_agg(client_id::text,total),'{}'::jsonb) FROM (SELECT client_id,count(*) AS total FROM cases WHERE client_id IS NOT NULL GROUP BY client_id) counts
$$;

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

-- PAYME MIGRATION 004
-- Apply after migration 003. No secrets are stored in these tables.
BEGIN;
CREATE TABLE IF NOT EXISTS public.payment_orders (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 client_id BIGINT NOT NULL REFERENCES public.users(id),
 tier TEXT NOT NULL CHECK(tier IN ('STANDARD','COMFORT','PREMIUM')),
 amount BIGINT NOT NULL CHECK(amount>0), -- tiyin, not sum
 members JSONB NOT NULL CHECK(jsonb_typeof(members)='array'),
 terms JSONB NOT NULL,
 mode TEXT NOT NULL CHECK(mode IN ('test','live')),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','reserved','paid','cancelled','expired')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 paid_at TIMESTAMPTZ, starts_at TIMESTAMPTZ, expires_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS payment_orders_client ON public.payment_orders(client_id,created_at DESC);
CREATE TABLE IF NOT EXISTS public.payme_transactions (
 id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
 payme_id TEXT NOT NULL,
 mode TEXT NOT NULL CHECK(mode IN ('test','live')),
 order_id UUID NOT NULL REFERENCES public.payment_orders(id),
 payme_time BIGINT NOT NULL,
 amount BIGINT NOT NULL,
 account JSONB NOT NULL,
 create_time BIGINT NOT NULL,
 perform_time BIGINT NOT NULL DEFAULT 0,
 cancel_time BIGINT NOT NULL DEFAULT 0,
 state INT NOT NULL DEFAULT 1 CHECK(state IN (1,2,-1,-2)),
 reason INT,
 fiscal_perform JSONB, fiscal_cancel JSONB,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(mode,payme_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS payme_one_active_order ON public.payme_transactions(order_id) WHERE state IN (1,2);
CREATE INDEX IF NOT EXISTS payme_statement_time ON public.payme_transactions(mode,payme_time);
CREATE TABLE IF NOT EXISTS public.family_subscriptions (
 id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
 order_id UUID NOT NULL UNIQUE REFERENCES public.payment_orders(id),
 client_id BIGINT NOT NULL REFERENCES public.users(id),
 tier TEXT NOT NULL, mode TEXT NOT NULL CHECK(mode IN ('test','live')),
 members JSONB NOT NULL, terms JSONB NOT NULL,
 starts_at TIMESTAMPTZ NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','cancelled')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS family_subscriptions_client ON public.family_subscriptions(client_id,mode,expires_at);
CREATE TABLE IF NOT EXISTS public.subscription_usage (
 id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
 subscription_id BIGINT NOT NULL REFERENCES public.family_subscriptions(id),
 case_id BIGINT NOT NULL UNIQUE REFERENCES public.cases(id),
 kind TEXT NOT NULL CHECK(kind IN ('legal','psychology','business')),
 actor_id BIGINT NOT NULL REFERENCES public.users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payme_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_orders,public.payme_transactions,public.family_subscriptions,public.subscription_usage FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.payment_orders,public.payme_transactions,public.family_subscriptions,public.subscription_usage TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public.payme_transactions_id_seq,public.family_subscriptions_id_seq,public.subscription_usage_id_seq TO service_role;

CREATE OR REPLACE FUNCTION public.zar_payment_ready() RETURNS BOOLEAN LANGUAGE sql AS $$ SELECT true $$;

CREATE OR REPLACE FUNCTION public.zar_create_payment_order(p_client_id BIGINT,p_tier TEXT,p_members JSONB,p_mode TEXT)
RETURNS JSONB LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE o payment_orders; price BIGINT; max_members INT; details JSONB;
BEGIN
 PERFORM 1 FROM users u WHERE id=p_client_id AND role='client' AND to_jsonb(u)->>'blocked_at' IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Mijoz topilmadi.'; END IF;
 IF p_mode IS NULL OR p_mode NOT IN ('test','live') THEN RAISE EXCEPTION 'To‘lov rejimi noto‘g‘ri.'; END IF;
 CASE p_tier
 WHEN 'STANDARD' THEN price:=9900000; max_members:=4; details:='{"legalConsultations":1,"psychologicalConsultations":1,"businessConsultations":0,"familyMembers":4}'::jsonb;
 WHEN 'COMFORT' THEN price:=19900000; max_members:=5; details:='{"legalConsultations":2,"psychologicalConsultations":1,"businessConsultations":1,"familyMembers":5}'::jsonb;
 WHEN 'PREMIUM' THEN price:=39900000; max_members:=6; details:='{"legalConsultations":4,"psychologicalConsultations":2,"businessConsultations":2,"familyMembers":6}'::jsonb;
 ELSE RAISE EXCEPTION 'Tarif noto‘g‘ri.';
 END CASE;
 IF p_members IS NULL OR jsonb_typeof(p_members)<>'array' THEN RAISE EXCEPTION 'A’zolar noto‘g‘ri.'; END IF;
 IF jsonb_array_length(p_members)<1 OR jsonb_array_length(p_members)>max_members OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_members) m WHERE jsonb_typeof(m)<>'string' OR length(trim(m #>> '{}')) NOT BETWEEN 2 AND 100) THEN RAISE EXCEPTION 'Oila a’zolari soni yoki ismlari noto‘g‘ri.'; END IF;
 WITH expired AS (
  UPDATE payme_transactions pt SET state=-1,reason=4,cancel_time=floor(extract(epoch FROM clock_timestamp())*1000)
  FROM payment_orders po WHERE po.id=pt.order_id AND po.client_id=p_client_id AND pt.mode=p_mode AND pt.state=1 AND floor(extract(epoch FROM clock_timestamp())*1000)-pt.payme_time>=43200000 RETURNING pt.order_id
 ) UPDATE payment_orders SET status='expired' WHERE id IN (SELECT order_id FROM expired);
 UPDATE payment_orders SET status='expired' WHERE client_id=p_client_id AND mode=p_mode AND status='pending' AND created_at<=now()-interval '12 hours';
 IF EXISTS(SELECT 1 FROM family_subscriptions WHERE client_id=p_client_id AND mode=p_mode AND status='active' AND expires_at>now()) THEN RAISE EXCEPTION 'Amaldagi abonementingiz bor. Muddati tugagach yangi to‘lov qiling.'; END IF;
 SELECT * INTO o FROM payment_orders WHERE client_id=p_client_id AND tier=p_tier AND members=p_members AND mode=p_mode AND status IN ('pending','reserved') AND created_at>now()-interval '12 hours' ORDER BY created_at DESC LIMIT 1;
 IF o.id IS NULL THEN
  INSERT INTO payment_orders(client_id,tier,amount,members,terms,mode) VALUES(p_client_id,p_tier,price,p_members,details,p_mode) RETURNING * INTO o;
 END IF;
 RETURN to_jsonb(o);
END $$;

CREATE OR REPLACE FUNCTION public.zar_payme_error(p_code INT,p_message TEXT,p_data TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE sql AS $$
 SELECT jsonb_build_object('error',jsonb_build_object('code',p_code,'message',jsonb_build_object('uz',p_message,'ru',p_message,'en',p_message)) || CASE WHEN p_data IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('data',p_data) END)
$$;

CREATE OR REPLACE FUNCTION public.zar_payme(p_method TEXT,p_params JSONB,p_mode TEXT,p_account_field TEXT)
RETURNS JSONB LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE o payment_orders; t payme_transactions; other payme_transactions; client BIGINT; ms BIGINT:=floor(extract(epoch FROM clock_timestamp())*1000); started TIMESTAMPTZ; finished TIMESTAMPTZ; rows JSONB;
BEGIN
 IF p_mode IS NULL OR p_mode NOT IN ('test','live') THEN RETURN zar_payme_error(-32400,'To‘lov rejimi noto‘g‘ri.'); END IF;
 IF p_method='GetStatement' THEN
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',payme_id,'time',payme_time,'amount',amount,'account',account,'create_time',create_time,'perform_time',perform_time,'cancel_time',cancel_time,'transaction',id::text,'state',state,'reason',reason) ORDER BY payme_time,id),'[]'::jsonb) INTO rows FROM payme_transactions WHERE mode=p_mode AND payme_time BETWEEN (p_params->>'from')::bigint AND (p_params->>'to')::bigint;
  RETURN jsonb_build_object('result',jsonb_build_object('transactions',rows));
 END IF;
 -- All mutations for a client share the same lock: order creation, reserve,
 -- settlement, refund and timeout cannot race or grant two active subscriptions.
 IF p_method IN ('CheckPerformTransaction','CreateTransaction') THEN
  SELECT * INTO o FROM payment_orders WHERE id=(p_params->'account'->>p_account_field)::uuid AND mode=p_mode;
 ELSE
  SELECT * INTO t FROM payme_transactions WHERE payme_id=p_params->>'id' AND mode=p_mode;
  IF t.id IS NULL THEN RETURN zar_payme_error(CASE WHEN p_method='SetFiscalData' THEN -32001 ELSE -31003 END,'Tranzaksiya topilmadi.'); END IF;
  SELECT * INTO o FROM payment_orders WHERE id=t.order_id;
 END IF;
 IF o.id IS NULL THEN RETURN zar_payme_error(-31050,'Buyurtma topilmadi.',p_account_field); END IF;
 client:=o.client_id;
 PERFORM 1 FROM users WHERE id=client FOR UPDATE;
 SELECT * INTO o FROM payment_orders WHERE id=o.id FOR UPDATE;
 -- Persist timeouts, even when returning an error. Time uses Payme's timestamp.
 FOR other IN SELECT pt.* FROM payme_transactions pt JOIN payment_orders po ON po.id=pt.order_id WHERE po.client_id=client AND pt.mode=p_mode AND pt.state=1 AND ms-pt.payme_time>=43200000 FOR UPDATE OF pt LOOP
  UPDATE payme_transactions SET state=-1,reason=4,cancel_time=ms WHERE id=other.id;
  UPDATE payment_orders SET status='expired' WHERE id=other.order_id;
 END LOOP;
 SELECT * INTO o FROM payment_orders WHERE id=o.id;
 IF p_method IN ('CheckPerformTransaction','CreateTransaction') THEN
  IF o.amount<>(p_params->>'amount')::bigint THEN RETURN zar_payme_error(-31001,'To‘lov summasi noto‘g‘ri.'); END IF;
  IF p_method='CreateTransaction' THEN
   SELECT * INTO t FROM payme_transactions WHERE payme_id=p_params->>'id' AND mode=p_mode FOR UPDATE;
   IF t.id IS NOT NULL THEN
    IF t.order_id<>o.id OR t.amount<>(p_params->>'amount')::bigint OR t.payme_time<>(p_params->>'time')::bigint OR t.account<>p_params->'account' OR t.state<>1 THEN RETURN zar_payme_error(-31008,'Amalni bajarib bo‘lmaydi.'); END IF;
    RETURN jsonb_build_object('result',jsonb_build_object('create_time',t.create_time,'transaction',t.id::text,'state',t.state));
   END IF;
  END IF;
  IF o.status NOT IN ('pending','reserved') OR (o.status='pending' AND o.created_at<=now()-interval '12 hours') OR EXISTS(SELECT 1 FROM users u WHERE id=client AND to_jsonb(u)->>'blocked_at' IS NOT NULL) OR EXISTS(SELECT 1 FROM family_subscriptions WHERE client_id=client AND mode=p_mode AND status='active' AND expires_at>now()) THEN RETURN zar_payme_error(-31050,'Buyurtma uchun to‘lovni bajarib bo‘lmaydi.',p_account_field); END IF;
  IF EXISTS(SELECT 1 FROM payme_transactions pt JOIN payment_orders po ON po.id=pt.order_id WHERE po.client_id=client AND pt.mode=p_mode AND pt.state=1 AND (pt.order_id<>o.id OR p_method='CreateTransaction')) THEN RETURN zar_payme_error(-31050,'Boshqa to‘lov tasdiqlanishi kutilmoqda.',p_account_field); END IF;
  IF p_method='CheckPerformTransaction' THEN RETURN '{"result":{"allow":true}}'::jsonb; END IF;
  IF ms-(p_params->>'time')::bigint>=43200000 OR (p_params->>'time')::bigint>ms+300000 THEN RETURN zar_payme_error(-31008,'Tranzaksiya muddati noto‘g‘ri.'); END IF;
  INSERT INTO payme_transactions(payme_id,mode,order_id,payme_time,amount,account,create_time) VALUES(p_params->>'id',p_mode,o.id,(p_params->>'time')::bigint,o.amount,p_params->'account',ms) RETURNING * INTO t;
  UPDATE payment_orders SET status='reserved' WHERE id=o.id;
  RETURN jsonb_build_object('result',jsonb_build_object('create_time',t.create_time,'transaction',t.id::text,'state',t.state));
 END IF;
 SELECT * INTO t FROM payme_transactions WHERE payme_id=p_params->>'id' AND mode=p_mode FOR UPDATE;
 IF p_method='PerformTransaction' THEN
  IF t.state NOT IN (1,2) THEN RETURN zar_payme_error(-31008,'Tranzaksiya bekor qilingan.'); END IF;
  IF t.state=1 THEN
   started:=clock_timestamp(); finished:=started+interval '1 month';
   INSERT INTO family_subscriptions(order_id,client_id,tier,mode,members,terms,starts_at,expires_at) VALUES(o.id,client,o.tier,p_mode,o.members,o.terms,started,finished);
   UPDATE payment_orders SET status='paid',paid_at=started,starts_at=started,expires_at=finished WHERE id=o.id;
   UPDATE payme_transactions SET state=2,perform_time=ms WHERE id=t.id RETURNING * INTO t;
  END IF;
  RETURN jsonb_build_object('result',jsonb_build_object('transaction',t.id::text,'perform_time',t.perform_time,'state',t.state));
 ELSIF p_method='CancelTransaction' THEN
  IF t.state IN (1,2) THEN
   IF t.state=2 AND EXISTS(SELECT 1 FROM subscription_usage u JOIN family_subscriptions s ON s.id=u.subscription_id WHERE s.order_id=o.id) THEN RETURN zar_payme_error(-31007,'Abonement xizmatidan foydalanilgan. Bekor qilib bo‘lmaydi.'); END IF;
   UPDATE family_subscriptions SET status='cancelled' WHERE order_id=o.id;
   UPDATE payment_orders SET status='cancelled' WHERE id=o.id;
   UPDATE payme_transactions SET state=CASE WHEN state=2 THEN -2 ELSE -1 END,reason=(p_params->>'reason')::int,cancel_time=ms WHERE id=t.id RETURNING * INTO t;
  END IF;
  RETURN jsonb_build_object('result',jsonb_build_object('transaction',t.id::text,'cancel_time',t.cancel_time,'state',t.state));
 ELSIF p_method='CheckTransaction' THEN
  RETURN jsonb_build_object('result',jsonb_build_object('create_time',t.create_time,'perform_time',t.perform_time,'cancel_time',t.cancel_time,'transaction',t.id::text,'state',t.state,'reason',t.reason));
 ELSIF p_method='SetFiscalData' THEN
  IF p_params->>'type'='PERFORM' THEN UPDATE payme_transactions SET fiscal_perform=p_params->'fiscal_data' WHERE id=t.id;
  ELSE UPDATE payme_transactions SET fiscal_cancel=p_params->'fiscal_data' WHERE id=t.id; END IF;
  RETURN '{"result":{"success":true}}'::jsonb;
 END IF;
 RETURN zar_payme_error(-32601,'Usul topilmadi.',p_method);
EXCEPTION WHEN unique_violation THEN RETURN zar_payme_error(-31008,'Tranzaksiya allaqachon mavjud.');
END $$;

CREATE OR REPLACE FUNCTION public.zar_use_subscription(p_subscription_id BIGINT,p_case_id BIGINT,p_kind TEXT,p_actor_id BIGINT)
RETURNS VOID LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE s family_subscriptions; c cases; actor users; lim INT; term_key TEXT;
BEGIN
 SELECT * INTO actor FROM users u WHERE id=p_actor_id AND role IN ('operator','director') AND to_jsonb(u)->>'blocked_at' IS NULL;
 IF actor.id IS NULL THEN RAISE EXCEPTION 'Ruxsat yo‘q.'; END IF;
 SELECT * INTO s FROM family_subscriptions WHERE id=p_subscription_id;
 IF s.id IS NULL THEN RAISE EXCEPTION 'Abonement topilmadi.'; END IF;
 PERFORM 1 FROM users WHERE id=s.client_id FOR UPDATE;
 SELECT * INTO s FROM family_subscriptions WHERE id=p_subscription_id FOR UPDATE;
 SELECT * INTO c FROM cases WHERE id=p_case_id;
 IF c.id IS NULL OR c.client_id IS DISTINCT FROM s.client_id OR c.status<>'completed' THEN RAISE EXCEPTION 'Faqat shu mijozning yakunlangan murojaati hisobga olinadi.'; END IF;
 IF c.updated_at<s.starts_at OR c.updated_at>=s.expires_at THEN RAISE EXCEPTION 'Maslahat abonement muddati ichida yakunlanmagan.'; END IF;
 IF s.mode<>'live' OR s.status<>'active' OR s.expires_at<=now() THEN RAISE EXCEPTION 'Abonement amalda emas.'; END IF;
 CASE p_kind WHEN 'legal' THEN term_key:='legalConsultations'; WHEN 'psychology' THEN term_key:='psychologicalConsultations'; WHEN 'business' THEN term_key:='businessConsultations'; ELSE RAISE EXCEPTION 'Maslahat turi noto‘g‘ri.'; END CASE;
 IF c.category<>p_kind AND NOT(p_kind='legal' AND c.category='documents') THEN RAISE EXCEPTION 'Maslahat turi murojaat yo‘nalishiga mos emas.'; END IF;
 lim:=(s.terms->>term_key)::int;
 IF (SELECT count(*) FROM subscription_usage WHERE subscription_id=s.id AND kind=p_kind)>=lim THEN RAISE EXCEPTION 'Bu oy uchun maslahat limiti tugagan.'; END IF;
 INSERT INTO subscription_usage(subscription_id,case_id,kind,actor_id) VALUES(s.id,c.id,p_kind,p_actor_id);
 INSERT INTO history(case_id,kind,message,actor_name) VALUES(c.id,'package','Oylik abonementdan maslahat qayd etildi: '||p_kind,actor.name);
END $$;

REVOKE ALL ON FUNCTION public.zar_payment_ready(),public.zar_create_payment_order(BIGINT,TEXT,JSONB,TEXT),public.zar_payme_error(INT,TEXT,TEXT),public.zar_payme(TEXT,JSONB,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.zar_payment_ready(),public.zar_create_payment_order(BIGINT,TEXT,JSONB,TEXT),public.zar_payme_error(INT,TEXT,TEXT),public.zar_payme(TEXT,JSONB,TEXT,TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.zar_use_subscription(BIGINT,BIGINT,TEXT,BIGINT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.zar_use_subscription(BIGINT,BIGINT,TEXT,BIGINT) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
