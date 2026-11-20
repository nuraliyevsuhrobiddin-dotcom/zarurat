-- Deny orphan/blocked partner accounts; preserve assignments and service progression.
BEGIN;
CREATE OR REPLACE FUNCTION public.zar_update_service(p_id BIGINT,p_status TEXT,p_partner_id BIGINT,p_change_partner BOOLEAN,p_actor_id BIGINT)
RETURNS BIGINT LANGUAGE plpgsql SET search_path=public,extensions,pg_temp AS $$
DECLARE s services; c cases; actor users; BEGIN
  SELECT * INTO actor FROM users WHERE id=p_actor_id;
  SELECT * INTO s FROM services WHERE id=p_id;
  IF s.id IS NULL THEN RAISE EXCEPTION 'Xizmat topilmadi.'; END IF;
  -- Always lock the parent before the service, consistent with case completion.
  SELECT * INTO c FROM cases WHERE id=s.case_id FOR UPDATE;
  SELECT * INTO s FROM services WHERE id=p_id FOR UPDATE;
  IF actor.id IS NULL OR actor.role NOT IN ('operator','director','partner') OR to_jsonb(actor)->>'blocked_at' IS NOT NULL THEN RAISE EXCEPTION 'Ruxsat yo‘q.'; END IF;
  IF c.status IN ('completed','cancelled') OR s.status IN ('completed','cancelled') THEN RAISE EXCEPTION 'Yakunlangan xizmat o‘zgartirilmaydi.'; END IF;
  IF actor.role='partner' THEN
    IF actor.partner_id IS NULL OR s.partner_id IS NULL OR actor.partner_id IS DISTINCT FROM s.partner_id OR p_change_partner THEN RAISE EXCEPTION 'Ruxsat yo‘q.'; END IF;
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
COMMIT;
