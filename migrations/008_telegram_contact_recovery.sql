-- Apply after 006. Contact recovery is limited to unlinked client accounts.
BEGIN;
CREATE TABLE IF NOT EXISTS public.telegram_recovery_contacts (
 id TEXT PRIMARY KEY CHECK(id ~ '^[a-f0-9]{64}$'),
 login TEXT NOT NULL, chat_id BIGINT,
 expires_at TIMESTAMPTZ NOT NULL DEFAULT now()+interval '10 minutes',
 consumed_at TIMESTAMPTZ
);
ALTER TABLE public.telegram_recovery_contacts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.telegram_recovery_contacts FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.telegram_recovery_contacts TO service_role;

CREATE OR REPLACE FUNCTION public.zar_prepare_contact_recovery(p_id TEXT,p_login TEXT)
RETURNS VOID LANGUAGE sql SET search_path=public,pg_temp AS $$
 INSERT INTO telegram_recovery_contacts(id,login) VALUES(p_id,p_login);
$$;

CREATE OR REPLACE FUNCTION public.zar_open_contact_recovery(p_id TEXT,p_chat_id BIGINT)
RETURNS BOOLEAN LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF p_chat_id IS NULL OR p_chat_id<=0 THEN RETURN false; END IF;
 -- One active contact operation per chat; registration remains a separate flow.
 UPDATE telegram_recovery_contacts SET consumed_at=now()
 WHERE chat_id=p_chat_id AND id<>p_id AND consumed_at IS NULL;
 UPDATE telegram_recovery_contacts SET chat_id=p_chat_id
 WHERE id=p_id AND expires_at>now() AND consumed_at IS NULL
 AND (chat_id IS NULL OR chat_id=p_chat_id);
 RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.zar_contact_recovery(p_id TEXT,p_chat_id BIGINT,p_phone TEXT,p_code_hash TEXT)
RETURNS JSONB LANGUAGE plpgsql SET search_path=public,extensions,pg_temp AS $$
DECLARE c telegram_recovery_contacts; u users; result JSONB; BEGIN
 SELECT * INTO c FROM telegram_recovery_contacts WHERE id=p_id AND chat_id=p_chat_id
 AND consumed_at IS NULL AND expires_at>now() LIMIT 1 FOR UPDATE;
 IF c.id IS NULL THEN RETURN NULL; END IF;
 UPDATE telegram_recovery_contacts SET consumed_at=now() WHERE id=c.id;
 IF p_phone !~ '^\+998[0-9]{9}$' OR p_code_hash !~ '^[a-f0-9]{64}$' THEN RETURN NULL; END IF;
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
 INSERT INTO account_audit(target_id,action) VALUES(u.id,'telegram.linked.contact');
 RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.zar_prepare_contact_recovery(TEXT,TEXT),public.zar_open_contact_recovery(TEXT,BIGINT),public.zar_contact_recovery(TEXT,BIGINT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.zar_prepare_contact_recovery(TEXT,TEXT),public.zar_open_contact_recovery(TEXT,BIGINT),public.zar_contact_recovery(TEXT,BIGINT,TEXT,TEXT) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
