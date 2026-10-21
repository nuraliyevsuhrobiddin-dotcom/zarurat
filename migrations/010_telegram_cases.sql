-- Apply after 009. Persistent private-chat request wizard.
BEGIN;
CREATE TABLE IF NOT EXISTS public.telegram_case_drafts (
 chat_id BIGINT PRIMARY KEY,
 user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 stage TEXT NOT NULL DEFAULT 'menu', category TEXT, description TEXT,
 last_message_id BIGINT NOT NULL DEFAULT 0,
 expires_at TIMESTAMPTZ NOT NULL DEFAULT now()+interval '30 minutes',
 result JSONB, last_response JSONB
);
ALTER TABLE public.telegram_case_drafts ADD COLUMN IF NOT EXISTS last_response JSONB;
ALTER TABLE public.telegram_case_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.telegram_case_drafts FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.telegram_case_drafts TO service_role;

CREATE OR REPLACE FUNCTION public.zar_telegram_case_action(p_chat_id BIGINT,p_message_id BIGINT,p_action TEXT,p_value TEXT DEFAULT '')
RETURNS JSONB LANGUAGE plpgsql SET search_path=public,extensions,pg_temp AS $$
DECLARE u users; d telegram_case_drafts; c cases; r JSONB; f JSONB; rating_value INTEGER; category_value TEXT; BEGIN
 IF p_chat_id IS NULL OR p_chat_id<=0 OR p_message_id IS NULL OR p_message_id<=0 THEN RETURN jsonb_build_object('state','invalid'); END IF;
 PERFORM pg_advisory_xact_lock(p_chat_id);
 SELECT * INTO u FROM users WHERE telegram_chat_id=p_chat_id AND blocked_at IS NULL AND role='client' FOR UPDATE;
 IF u.id IS NULL THEN RETURN jsonb_build_object('state','unlinked'); END IF;
 INSERT INTO telegram_case_drafts(chat_id,user_id) VALUES(p_chat_id,u.id) ON CONFLICT DO NOTHING;
 SELECT * INTO d FROM telegram_case_drafts WHERE chat_id=p_chat_id FOR UPDATE;
 IF d.user_id<>u.id THEN
  UPDATE telegram_case_drafts SET user_id=u.id,stage='menu',category=NULL,description=NULL,result=NULL,last_response=NULL,last_message_id=0 WHERE chat_id=p_chat_id;
  SELECT * INTO d FROM telegram_case_drafts WHERE chat_id=p_chat_id;
 END IF;
 -- Telegram may retry or deliver older updates after a timeout. Never advance twice.
 IF p_message_id=d.last_message_id THEN RETURN coalesce(d.last_response,jsonb_build_object('state','duplicate')); END IF;
 IF p_message_id<d.last_message_id THEN RETURN jsonb_build_object('state','duplicate'); END IF;
 UPDATE telegram_case_drafts SET last_message_id=p_message_id WHERE chat_id=p_chat_id;
 IF p_action='list' THEN
  SELECT coalesce(jsonb_agg(x),'[]') INTO r FROM (
   SELECT number,status,created_at FROM cases WHERE client_id=u.id ORDER BY id DESC LIMIT 20
  ) x;
  r:=jsonb_build_object('state','list','cases',r); UPDATE telegram_case_drafts SET last_response=r WHERE chat_id=p_chat_id; RETURN r;
 ELSIF p_action='rate' THEN
  f:=p_value::jsonb;
  IF coalesce(f->>'rating','') !~ '^[1-5]$' OR length(coalesce(f->>'comment',''))>1000 THEN r:=jsonb_build_object('state','invalid'); UPDATE telegram_case_drafts SET last_response=r WHERE chat_id=p_chat_id; RETURN r; END IF;
  rating_value:=(f->>'rating')::integer;
  SELECT * INTO c FROM cases WHERE client_id=u.id AND number=upper(f->>'number') AND status='completed' FOR UPDATE;
  IF c.id IS NULL THEN r:=jsonb_build_object('state','rating_unavailable'); UPDATE telegram_case_drafts SET last_response=r WHERE chat_id=p_chat_id; RETURN r; END IF;
  INSERT INTO feedback(case_id,rating,comment) VALUES(c.id,rating_value,coalesce(f->>'comment','')) ON CONFLICT(case_id) DO NOTHING;
  IF NOT FOUND THEN r:=jsonb_build_object('state','already_rated'); UPDATE telegram_case_drafts SET last_response=r WHERE chat_id=p_chat_id; RETURN r; END IF;
  r:=jsonb_build_object('state','rated'); UPDATE telegram_case_drafts SET last_response=r WHERE chat_id=p_chat_id; RETURN r;
 ELSIF p_action='track' THEN
  SELECT * INTO c FROM cases WHERE client_id=u.id AND number=upper(trim(p_value));
  IF c.id IS NULL THEN r:=jsonb_build_object('state','missing'); UPDATE telegram_case_drafts SET last_response=r WHERE chat_id=p_chat_id; RETURN r; END IF;
  r:=jsonb_build_object('state','case','case',jsonb_build_object('number',c.number,'status',c.status,'createdAt',c.created_at,'updatedAt',c.updated_at)); UPDATE telegram_case_drafts SET last_response=r WHERE chat_id=p_chat_id; RETURN r;
 ELSIF p_action IN ('cancel','menu') THEN
  UPDATE telegram_case_drafts SET stage='menu',description=NULL,category=NULL,result=NULL WHERE chat_id=p_chat_id;
  r:=jsonb_build_object('state','menu'); UPDATE telegram_case_drafts SET last_response=r WHERE chat_id=p_chat_id; RETURN r;
 ELSIF p_action='new' THEN
  UPDATE telegram_case_drafts SET stage='category',description=NULL,category=NULL,result=NULL,expires_at=now()+interval '30 minutes' WHERE chat_id=p_chat_id;
  r:=jsonb_build_object('state','category'); UPDATE telegram_case_drafts SET last_response=r WHERE chat_id=p_chat_id; RETURN r;
 END IF;
 IF d.expires_at<=now() THEN
  UPDATE telegram_case_drafts SET stage='menu',description=NULL,category=NULL,result=NULL WHERE chat_id=p_chat_id;
  r:=jsonb_build_object('state','expired'); UPDATE telegram_case_drafts SET last_response=r WHERE chat_id=p_chat_id; RETURN r;
 END IF;
 IF d.stage='category' THEN
  category_value:=CASE WHEN p_action LIKE 'category:%' THEN substring(p_action from 10) ELSE p_value END;
  IF category_value IS NULL OR category_value NOT IN ('legal','psychology','medical','children','elderly','women','business','bank','documents','nanny','care','cleaning','repair','other') THEN r:=jsonb_build_object('state','category'); UPDATE telegram_case_drafts SET last_response=r WHERE chat_id=p_chat_id; RETURN r; END IF;
  UPDATE telegram_case_drafts SET category=category_value,stage='description' WHERE chat_id=p_chat_id;
  r:=jsonb_build_object('state','description'); UPDATE telegram_case_drafts SET last_response=r WHERE chat_id=p_chat_id; RETURN r;
 ELSIF d.stage='description' THEN
  IF (p_action<>'text' AND p_action NOT LIKE 'category:%') OR p_value IS NULL OR length(trim(p_value)) NOT BETWEEN 10 AND 3500 THEN r:=jsonb_build_object('state','description'); UPDATE telegram_case_drafts SET last_response=r WHERE chat_id=p_chat_id; RETURN r; END IF;
  UPDATE telegram_case_drafts SET description=trim(p_value),stage='confirm' WHERE chat_id=p_chat_id;
  r:=jsonb_build_object('state','confirm','category',d.category); UPDATE telegram_case_drafts SET last_response=r WHERE chat_id=p_chat_id; RETURN r;
 ELSIF d.stage='confirm' AND p_action='submit' THEN
  IF (SELECT count(*) FROM cases WHERE client_id=u.id AND created_at>now()-interval '1 hour')>=5 THEN r:=jsonb_build_object('state','limited'); UPDATE telegram_case_drafts SET last_response=r WHERE chat_id=p_chat_id; RETURN r; END IF;
  r:=zar_create_request(jsonb_build_object('name',u.name,'phone',u.phone,'region','Qashqadaryo','category',d.category,'description',d.description,'preferred_time','Istalgan vaqt','attachments','[]'::jsonb),u.id);
  -- The bot never returns a tracking secret: access is bound to the linked account.
  r:=r->'case';
  UPDATE telegram_case_drafts SET stage='done',description=NULL,category=NULL,result=r WHERE chat_id=p_chat_id;
  r:=jsonb_build_object('state','created','case',r); UPDATE telegram_case_drafts SET last_response=r WHERE chat_id=p_chat_id; RETURN r;
 ELSIF d.stage='confirm' THEN r:=jsonb_build_object('state','confirm','category',d.category); UPDATE telegram_case_drafts SET last_response=r WHERE chat_id=p_chat_id; RETURN r;
 ELSIF d.stage='done' AND p_action='submit' THEN r:=jsonb_build_object('state','created','case',d.result); UPDATE telegram_case_drafts SET last_response=r WHERE chat_id=p_chat_id; RETURN r;
 END IF;
 r:=jsonb_build_object('state','menu'); UPDATE telegram_case_drafts SET last_response=r WHERE chat_id=p_chat_id; RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.zar_telegram_case_action(BIGINT,BIGINT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.zar_telegram_case_action(BIGINT,BIGINT,TEXT,TEXT) TO service_role;
CREATE OR REPLACE FUNCTION public.zar_clear_telegram_draft()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF OLD.telegram_chat_id IS DISTINCT FROM NEW.telegram_chat_id THEN
  DELETE FROM telegram_case_drafts WHERE user_id=OLD.id;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.zar_clear_telegram_draft() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS zar_clear_telegram_draft ON public.users;
CREATE TRIGGER zar_clear_telegram_draft AFTER UPDATE OF telegram_chat_id ON public.users
FOR EACH ROW EXECUTE FUNCTION public.zar_clear_telegram_draft();
NOTIFY pgrst,'reload schema';
COMMIT;
