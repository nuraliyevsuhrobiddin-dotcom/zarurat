-- Apply after 008. Preserve valid links and bound contact retries.
BEGIN;
ALTER TABLE public.telegram_recovery_contacts ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_recovery_contacts_chat ON public.telegram_recovery_contacts(chat_id) WHERE consumed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_recovery_contacts_expiry ON public.telegram_recovery_contacts(expires_at);
CREATE OR REPLACE FUNCTION public.zar_prepare_contact_recovery(p_id TEXT,p_login TEXT)
RETURNS VOID LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 DELETE FROM telegram_recovery_contacts WHERE expires_at<now()-interval '1 day';
 INSERT INTO telegram_recovery_contacts(id,login) VALUES(p_id,p_login);
END $$;

CREATE OR REPLACE FUNCTION public.zar_open_contact_recovery(p_id TEXT,p_chat_id BIGINT)
RETURNS BOOLEAN LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE active_id TEXT; BEGIN
 IF p_chat_id IS NULL OR p_chat_id<=0 THEN RETURN false; END IF;
 PERFORM pg_advisory_xact_lock(p_chat_id);
 SELECT id INTO active_id FROM telegram_recovery_contacts
 WHERE id=p_id AND expires_at>now() AND consumed_at IS NULL AND attempts<5
 AND (chat_id IS NULL OR chat_id=p_chat_id) FOR UPDATE;
 IF active_id IS NULL THEN RETURN false; END IF;
 UPDATE telegram_recovery_contacts SET consumed_at=now()
 WHERE chat_id=p_chat_id AND id<>p_id AND consumed_at IS NULL;
 UPDATE telegram_recovery_contacts SET chat_id=p_chat_id WHERE id=p_id;
 RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.zar_contact_recovery(p_id TEXT,p_chat_id BIGINT,p_phone TEXT,p_code_hash TEXT)
RETURNS JSONB LANGUAGE plpgsql SET search_path=public,extensions,pg_temp AS $$
DECLARE c telegram_recovery_contacts; u users; result JSONB; BEGIN
 IF p_chat_id IS NULL OR p_chat_id<=0 OR p_phone IS NULL OR p_code_hash IS NULL
 OR p_phone !~ '^\+998[0-9]{9}$' OR p_code_hash !~ '^[a-f0-9]{64}$' THEN RETURN NULL; END IF;
 PERFORM pg_advisory_xact_lock(p_chat_id);
 SELECT * INTO c FROM telegram_recovery_contacts WHERE id=p_id AND chat_id=p_chat_id
 AND consumed_at IS NULL AND expires_at>now() AND attempts<5 LIMIT 1 FOR UPDATE;
 IF c.id IS NULL THEN RETURN NULL; END IF;
 UPDATE telegram_recovery_contacts SET attempts=attempts+1 WHERE id=c.id;
 -- Ambiguous numbers must be resolved by support, never select an arbitrary account.
 IF (SELECT count(*) FROM users WHERE regexp_replace(phone,'[[:space:]()-]','','g')=p_phone)<>1 THEN RETURN NULL; END IF;
 SELECT * INTO u FROM users WHERE role='client' AND blocked_at IS NULL
 AND regexp_replace(phone,'[[:space:]()-]','','g')=p_phone
 AND (lower(login)=lower(c.login) OR p_phone=c.login) FOR UPDATE;
 IF u.id IS NULL OR (u.telegram_chat_id IS NOT NULL AND u.telegram_chat_id<>p_chat_id)
 OR EXISTS(SELECT 1 FROM users WHERE telegram_chat_id=p_chat_id AND id<>u.id)
 OR EXISTS(SELECT 1 FROM telegram_recovery WHERE user_id=u.id AND created_at>now()-interval '1 minute')
 THEN RETURN NULL; END IF;
 UPDATE users SET telegram_chat_id=p_chat_id WHERE id=u.id;
 result:=zar_start_telegram_recovery(c.login,p_code_hash,c.id);
 UPDATE telegram_recovery_contacts SET consumed_at=now() WHERE id=c.id;
 INSERT INTO account_audit(target_id,action) VALUES(u.id,'telegram.linked.contact');
 RETURN result;
END $$;

NOTIFY pgrst,'reload schema';
COMMIT;
