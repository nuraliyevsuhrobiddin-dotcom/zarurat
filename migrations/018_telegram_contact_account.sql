-- Anyone in Telegram can leave a request, as on the website. Sharing their own
-- Telegram contact proves the phone number once; it links the existing client
-- account with that number or opens a new one. Apply after 015 (needs 002, 010).
-- Safe to run again.
BEGIN;
CREATE OR REPLACE FUNCTION public.zar_telegram_contact_account(p_chat_id BIGINT,p_phone TEXT,p_name TEXT)
RETURNS JSONB LANGUAGE plpgsql SET search_path=public,extensions,pg_temp AS $$
DECLARE u users; mobile TEXT:=regexp_replace(coalesce(p_phone,''),'[^0-9]','','g'); matches INT; display TEXT;
BEGIN
 IF p_chat_id IS NULL OR p_chat_id<=0 THEN RETURN jsonb_build_object('state','invalid'); END IF;
 IF length(mobile)=9 THEN mobile:='998'||mobile; END IF;
 IF mobile !~ '^998[0-9]{9}$' THEN RETURN jsonb_build_object('state','foreign_phone'); END IF;
 -- Same chat lock as the request flow; the account lock serialises both chats of one number.
 PERFORM pg_advisory_xact_lock(p_chat_id);
 PERFORM pg_advisory_xact_lock(hashtextextended('telegram-account:'||mobile,0));
 SELECT * INTO u FROM users WHERE telegram_chat_id=p_chat_id;
 IF u.id IS NOT NULL THEN
  IF u.role='client' AND u.blocked_at IS NULL THEN RETURN jsonb_build_object('state','linked'); END IF;
  RETURN jsonb_build_object('state','unavailable');
 END IF;
 SELECT count(*) INTO matches FROM users WHERE regexp_replace(phone,'[^0-9]','','g') IN (mobile,substring(mobile from 4)) OR login IN ('+'||mobile,mobile);
 IF matches>1 THEN RETURN jsonb_build_object('state','unavailable'); END IF;
 SELECT * INTO u FROM users WHERE regexp_replace(phone,'[^0-9]','','g') IN (mobile,substring(mobile from 4)) OR login IN ('+'||mobile,mobile) FOR UPDATE;
 IF u.id IS NOT NULL THEN
  IF u.role<>'client' THEN RETURN jsonb_build_object('state','staff'); END IF;
  IF u.blocked_at IS NOT NULL THEN RETURN jsonb_build_object('state','unavailable'); END IF;
  IF u.telegram_chat_id IS NOT NULL THEN RETURN jsonb_build_object('state','other_chat'); END IF;
  UPDATE users SET telegram_chat_id=p_chat_id,phone_verified_at=coalesce(phone_verified_at,now()) WHERE id=u.id;
  RETURN jsonb_build_object('state','linked');
 END IF;
 display:=left(trim(regexp_replace(coalesce(p_name,''),'[[:space:]]+',' ','g')),100);
 IF length(display)<2 THEN display:='Telegram mijoz'; END IF;
 -- The random password is never shown; the client can set one with site recovery via this bot.
 INSERT INTO users(login,name,phone,password_hash,role,telegram_chat_id,phone_verified_at)
 VALUES('+'||mobile,display,'+'||mobile,extensions.crypt(encode(extensions.gen_random_bytes(24),'hex'),extensions.gen_salt('bf',10)),'client',p_chat_id,now());
 RETURN jsonb_build_object('state','created');
END $$;

-- The confirmation step now repeats the request text, name and phone before sending.
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
  r:=jsonb_build_object('state','confirm','category',d.category,'description',left(trim(p_value),400),'name',u.name,'phone',u.phone); UPDATE telegram_case_drafts SET last_response=r WHERE chat_id=p_chat_id; RETURN r;
 ELSIF d.stage='confirm' AND p_action='submit' THEN
  IF (SELECT count(*) FROM cases WHERE client_id=u.id AND created_at>now()-interval '1 hour')>=5 THEN r:=jsonb_build_object('state','limited'); UPDATE telegram_case_drafts SET last_response=r WHERE chat_id=p_chat_id; RETURN r; END IF;
  r:=zar_submit_request(jsonb_build_object('name',u.name,'phone',u.phone,'region','Qashqadaryo','category',d.category,'description',d.description,'preferred_time','Istalgan vaqt','attachments','[]'::jsonb),u.id);
  IF r->>'subscriptionRequired'='true' THEN
   r:=jsonb_build_object('state','subscription_required'); UPDATE telegram_case_drafts SET last_response=r WHERE chat_id=p_chat_id; RETURN r;
  END IF;
  -- The bot never returns a tracking secret: access is bound to the linked account.
  r:=r->'case';
  UPDATE telegram_case_drafts SET stage='done',description=NULL,category=NULL,result=r WHERE chat_id=p_chat_id;
  r:=jsonb_build_object('state','created','case',r); UPDATE telegram_case_drafts SET last_response=r WHERE chat_id=p_chat_id; RETURN r;
 ELSIF d.stage='confirm' THEN r:=jsonb_build_object('state','confirm','category',d.category,'description',left(d.description,400),'name',u.name,'phone',u.phone); UPDATE telegram_case_drafts SET last_response=r WHERE chat_id=p_chat_id; RETURN r;
 ELSIF d.stage='done' AND p_action='submit' THEN r:=jsonb_build_object('state','created','case',d.result); UPDATE telegram_case_drafts SET last_response=r WHERE chat_id=p_chat_id; RETURN r;
 END IF;
 r:=jsonb_build_object('state','menu'); UPDATE telegram_case_drafts SET last_response=r WHERE chat_id=p_chat_id; RETURN r;
END $$;

REVOKE ALL ON FUNCTION public.zar_telegram_contact_account(BIGINT,TEXT,TEXT),public.zar_telegram_case_action(BIGINT,BIGINT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.zar_telegram_contact_account(BIGINT,TEXT,TEXT),public.zar_telegram_case_action(BIGINT,BIGINT,TEXT,TEXT) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
