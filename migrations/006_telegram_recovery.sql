-- Apply after 002_accounts_notifications.sql. No SMS provider is required.
BEGIN;
CREATE TABLE IF NOT EXISTS public.telegram_recovery (
 id TEXT PRIMARY KEY CHECK(id ~ '^[a-f0-9]{64}$'),
 user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 chat_id BIGINT NOT NULL, password_revision TEXT NOT NULL,
 code_hash TEXT NOT NULL CHECK(code_hash ~ '^[a-f0-9]{64}$'),
 attempts INTEGER NOT NULL DEFAULT 0, expires_at TIMESTAMPTZ NOT NULL,
 consumed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_telegram_recovery_user ON public.telegram_recovery(user_id);
ALTER TABLE public.telegram_recovery ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.telegram_recovery FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.telegram_recovery TO service_role;

CREATE OR REPLACE FUNCTION public.zar_start_telegram_recovery(p_login TEXT,p_code_hash TEXT,p_id TEXT)
RETURNS JSONB LANGUAGE plpgsql SET search_path=public,extensions,pg_temp AS $$
DECLARE u users; BEGIN
 IF p_id !~ '^[a-f0-9]{64}$' OR p_code_hash !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'So‘rov noto‘g‘ri.'; END IF;
 SELECT * INTO u FROM users WHERE blocked_at IS NULL AND telegram_chat_id IS NOT NULL
 AND (lower(login)=lower(p_login) OR regexp_replace(phone,'[[:space:]()-]','','g')=p_login)
 ORDER BY id LIMIT 1 FOR UPDATE;
 IF u.id IS NULL THEN RETURN NULL; END IF;
 -- Account-level cooldown also covers alternate spellings of the same login.
 IF EXISTS(SELECT 1 FROM telegram_recovery WHERE user_id=u.id AND created_at>now()-interval '1 minute') THEN RETURN NULL; END IF;
 UPDATE telegram_recovery SET consumed_at=now() WHERE user_id=u.id AND consumed_at IS NULL;
 INSERT INTO telegram_recovery(id,user_id,chat_id,password_revision,code_hash,expires_at)
 VALUES(p_id,u.id,u.telegram_chat_id,u.password_hash,p_code_hash,now()+interval '10 minutes');
 RETURN jsonb_build_object('chatId',u.telegram_chat_id);
END $$;

CREATE OR REPLACE FUNCTION public.zar_confirm_telegram_recovery(p_id TEXT,p_code_hash TEXT,p_password_hash TEXT)
RETURNS JSONB LANGUAGE plpgsql SET search_path=public,extensions,pg_temp AS $$
DECLARE c telegram_recovery; u users; uid BIGINT; BEGIN
 SELECT user_id INTO uid FROM telegram_recovery WHERE id=p_id;
 SELECT * INTO u FROM users WHERE id=uid AND blocked_at IS NULL FOR UPDATE;
 IF u.id IS NULL THEN RETURN jsonb_build_object('ok',false); END IF;
 SELECT * INTO c FROM telegram_recovery WHERE id=p_id FOR UPDATE;
 IF c.id IS NULL OR c.consumed_at IS NOT NULL OR c.expires_at<=now() OR c.attempts>=5
 OR u.telegram_chat_id IS DISTINCT FROM c.chat_id OR u.password_hash IS DISTINCT FROM c.password_revision
 THEN RETURN jsonb_build_object('ok',false); END IF;
 UPDATE telegram_recovery SET attempts=attempts+1 WHERE id=p_id;
 IF c.code_hash IS DISTINCT FROM p_code_hash OR p_password_hash IS NULL
 OR p_password_hash !~ '^\$2a\$[0-9]{2}\$[./A-Za-z0-9]{53}$' THEN RETURN jsonb_build_object('ok',false); END IF;
 UPDATE users SET password_hash=p_password_hash WHERE id=u.id;
 DELETE FROM sessions WHERE user_id=u.id;
 UPDATE telegram_recovery SET consumed_at=now() WHERE user_id=u.id AND consumed_at IS NULL;
 UPDATE otp_challenges SET consumed_at=now() WHERE user_id=u.id AND consumed_at IS NULL;
 INSERT INTO account_audit(target_id,action) VALUES(u.id,'password.reset.telegram');
 RETURN jsonb_build_object('ok',true);
END $$;

REVOKE ALL ON FUNCTION public.zar_start_telegram_recovery(TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.zar_confirm_telegram_recovery(TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.zar_start_telegram_recovery(TEXT,TEXT,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.zar_confirm_telegram_recovery(TEXT,TEXT,TEXT) TO service_role;
CREATE OR REPLACE FUNCTION public.zar_unlink_telegram(p_chat_id BIGINT)
RETURNS VOID LANGUAGE plpgsql SET search_path=public,extensions,pg_temp AS $$
DECLARE uid BIGINT; BEGIN
 UPDATE users SET telegram_chat_id=NULL WHERE telegram_chat_id=p_chat_id RETURNING id INTO uid;
 IF uid IS NOT NULL THEN
  UPDATE telegram_recovery SET consumed_at=now() WHERE user_id=uid AND consumed_at IS NULL;
  UPDATE notifications SET status='suppressed',claim_token=NULL,lease_until=NULL WHERE case_id IN (SELECT id FROM cases WHERE client_id=uid) AND status IN ('queued','failed','sending');
  INSERT INTO account_audit(target_id,action) VALUES(uid,'telegram.unlinked');
 END IF;
END $$;

NOTIFY pgrst,'reload schema';
COMMIT;
