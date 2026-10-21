-- Apply after 002 and 006. Registration proof is bound to the entered phone.
BEGIN;
CREATE TABLE IF NOT EXISTS public.telegram_registrations (
 token_hash TEXT PRIMARY KEY CHECK(token_hash ~ '^[a-f0-9]{64}$'),
 phone TEXT NOT NULL CHECK(phone ~ '^\+998[0-9]{9}$'),
 chat_id BIGINT, started_at TIMESTAMPTZ, verified_at TIMESTAMPTZ,
 expires_at TIMESTAMPTZ NOT NULL, consumed_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_telegram_registration_chat ON public.telegram_registrations(chat_id,started_at DESC);
ALTER TABLE public.telegram_registrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.telegram_registrations FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.telegram_registrations TO service_role;

CREATE OR REPLACE FUNCTION public.zar_start_telegram_registration(p_token_hash TEXT,p_chat_id BIGINT)
RETURNS JSONB LANGUAGE plpgsql SET search_path=public,extensions,pg_temp AS $$
DECLARE v telegram_registrations; BEGIN
 SELECT * INTO v FROM telegram_registrations WHERE token_hash=p_token_hash FOR UPDATE;
 IF v.token_hash IS NULL OR v.expires_at<=now() OR v.consumed_at IS NOT NULL OR p_chat_id IS NULL OR p_chat_id<=0
 OR (v.chat_id IS NOT NULL AND v.chat_id<>p_chat_id) THEN RETURN NULL; END IF;
 UPDATE telegram_registrations SET chat_id=p_chat_id,started_at=now() WHERE token_hash=p_token_hash;
 RETURN jsonb_build_object('phone',v.phone,'verified',v.verified_at IS NOT NULL);
END $$;

CREATE OR REPLACE FUNCTION public.zar_verify_telegram_registration(p_chat_id BIGINT,p_phone TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SET search_path=public,extensions,pg_temp AS $$
DECLARE v telegram_registrations; BEGIN
 SELECT * INTO v FROM telegram_registrations WHERE chat_id=p_chat_id AND expires_at>now()
 AND consumed_at IS NULL ORDER BY started_at DESC LIMIT 1 FOR UPDATE;
 IF v.token_hash IS NULL OR v.phone IS DISTINCT FROM p_phone THEN RETURN false; END IF;
 UPDATE telegram_registrations SET verified_at=coalesce(verified_at,now()) WHERE token_hash=v.token_hash;
 RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.zar_register_telegram_verified(p_token_hash TEXT,p_phone TEXT,p_name TEXT,p_password_hash TEXT)
RETURNS JSONB LANGUAGE plpgsql SET search_path=public,extensions,pg_temp AS $$
DECLARE v telegram_registrations; u users; BEGIN
 SELECT * INTO v FROM telegram_registrations WHERE token_hash=p_token_hash FOR UPDATE;
 IF v.token_hash IS NULL OR v.expires_at<=now() OR v.consumed_at IS NOT NULL OR v.verified_at IS NULL
 OR v.chat_id IS NULL OR v.phone IS DISTINCT FROM p_phone THEN RAISE EXCEPTION 'Avval Telegram botda o‘z telefon raqamingizni tasdiqlang.'; END IF;
 IF p_password_hash IS NULL OR p_password_hash !~ '^\$2a\$[0-9]{2}\$[./A-Za-z0-9]{53}$'
 OR length(trim(p_name)) NOT BETWEEN 2 AND 100 THEN RAISE EXCEPTION 'Hisob ma’lumotlari noto‘g‘ri.'; END IF;
 IF EXISTS(SELECT 1 FROM users WHERE login=p_phone OR regexp_replace(phone,'[[:space:]()-]','','g')=p_phone OR telegram_chat_id=v.chat_id)
 THEN RAISE EXCEPTION 'Bu telefon yoki Telegram hisobi allaqachon ro‘yxatdan o‘tgan. Hisobingizga kiring.'; END IF;
 INSERT INTO users(name,phone,login,password_hash,role,phone_verified_at,telegram_chat_id)
 VALUES(trim(p_name),p_phone,p_phone,p_password_hash,'client',now(),v.chat_id) RETURNING * INTO u;
 UPDATE telegram_registrations SET consumed_at=now() WHERE token_hash=p_token_hash;
 INSERT INTO account_audit(target_id,action) VALUES(u.id,'phone.verified.telegram'),(u.id,'telegram.linked');
 RETURN to_jsonb(u)-'password_hash'-'telegram_chat_id';
END $$;

REVOKE ALL ON FUNCTION public.zar_start_telegram_registration(TEXT,BIGINT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.zar_verify_telegram_registration(BIGINT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.zar_register_telegram_verified(TEXT,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.zar_start_telegram_registration(TEXT,BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.zar_verify_telegram_registration(BIGINT,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.zar_register_telegram_verified(TEXT,TEXT,TEXT,TEXT) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
