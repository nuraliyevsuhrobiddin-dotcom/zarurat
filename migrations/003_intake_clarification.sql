BEGIN;
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

REVOKE ALL ON FUNCTION public.zar_capabilities() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.zar_capabilities() TO service_role;
REVOKE ALL ON FUNCTION public.zar_update_case(BIGINT,JSONB,BIGINT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.zar_update_case(BIGINT,JSONB,BIGINT) TO service_role;

CREATE OR REPLACE FUNCTION public.zar_client_counts() RETURNS JSONB LANGUAGE sql SET search_path=public,pg_temp AS $$
SELECT coalesce(jsonb_object_agg(client_id::text,total),'{}'::jsonb) FROM (SELECT client_id,count(*) AS total FROM cases WHERE client_id IS NOT NULL GROUP BY client_id) counts
$$;

REVOKE ALL ON FUNCTION public.zar_client_counts() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.zar_client_counts() TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
