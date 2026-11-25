-- Clients who cannot pay through Payme pay the company (MChJ) bank account from
-- Click, Uzum or a bank app, in cash or by card terminal. Staff check the money
-- and activate the same monthly subscription that a Payme payment creates.
-- Apply after migrations 004 and 016. Safe to run again.
BEGIN;
ALTER TABLE public.payment_orders ADD COLUMN IF NOT EXISTS method TEXT NOT NULL DEFAULT 'payme';
ALTER TABLE public.payment_orders ADD COLUMN IF NOT EXISTS reference TEXT;
ALTER TABLE public.payment_orders ADD COLUMN IF NOT EXISTS confirmed_by BIGINT REFERENCES public.users(id);
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='payment_orders_method_check') THEN
  ALTER TABLE public.payment_orders ADD CONSTRAINT payment_orders_method_check CHECK(method IN ('payme','bank','cash','terminal'));
 END IF;
END $$;

CREATE OR REPLACE FUNCTION public.zar_activate_manual_subscription(p_client_id BIGINT,p_tier TEXT,p_members JSONB,p_method TEXT,p_reference TEXT,p_actor_id BIGINT)
RETURNS JSONB LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE actor users; o payment_orders; s family_subscriptions; price BIGINT; max_members INT; details JSONB; started TIMESTAMPTZ:=clock_timestamp();
BEGIN
 SELECT * INTO actor FROM users u WHERE id=p_actor_id AND role IN ('operator','director') AND to_jsonb(u)->>'blocked_at' IS NULL;
 IF actor.id IS NULL THEN RAISE EXCEPTION 'Ruxsat yo‘q.'; END IF;
 IF p_method IS NULL OR p_method NOT IN ('bank','cash','terminal') THEN RAISE EXCEPTION 'To‘lov usuli noto‘g‘ri.'; END IF;
 IF length(trim(coalesce(p_reference,''))) NOT BETWEEN 2 AND 100 THEN RAISE EXCEPTION 'To‘lov hujjati yoki chek raqamini yozing.'; END IF;
 -- The same client lock as Payme order creation and settlement prevents a double subscription.
 PERFORM 1 FROM users u WHERE id=p_client_id AND role='client' AND to_jsonb(u)->>'blocked_at' IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Mijoz topilmadi.'; END IF;
 CASE p_tier
 WHEN 'STANDARD' THEN price:=9900000; max_members:=4; details:='{"legalConsultations":1,"psychologicalConsultations":1,"businessConsultations":0,"familyMembers":4}'::jsonb;
 WHEN 'COMFORT' THEN price:=19900000; max_members:=5; details:='{"legalConsultations":2,"psychologicalConsultations":1,"businessConsultations":1,"familyMembers":5}'::jsonb;
 WHEN 'PREMIUM' THEN price:=39900000; max_members:=6; details:='{"legalConsultations":4,"psychologicalConsultations":2,"businessConsultations":2,"familyMembers":6}'::jsonb;
 ELSE RAISE EXCEPTION 'Tarif noto‘g‘ri.';
 END CASE;
 IF p_members IS NULL OR jsonb_typeof(p_members)<>'array' OR jsonb_array_length(p_members)<1 OR jsonb_array_length(p_members)>max_members OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_members) m WHERE jsonb_typeof(m)<>'string' OR length(trim(m #>> '{}')) NOT BETWEEN 2 AND 100) THEN RAISE EXCEPTION 'Oila a’zolari soni yoki ismlari noto‘g‘ri.'; END IF;
 IF EXISTS(SELECT 1 FROM family_subscriptions WHERE client_id=p_client_id AND mode='live' AND status='active' AND expires_at>now()) THEN RAISE EXCEPTION 'Mijozda amaldagi obuna bor. Muddati tugagach yangisini yoqing.'; END IF;
 IF EXISTS(SELECT 1 FROM payme_transactions pt JOIN payment_orders po ON po.id=pt.order_id WHERE po.client_id=p_client_id AND pt.mode='live' AND pt.state=1) THEN RAISE EXCEPTION 'Mijozning Payme to‘lovi tasdiqlanishi kutilmoqda. Bir necha daqiqadan keyin qayta tekshiring.'; END IF;
 INSERT INTO payment_orders(client_id,tier,amount,members,terms,mode,status,paid_at,starts_at,expires_at,method,reference,confirmed_by)
 VALUES(p_client_id,p_tier,price,p_members,details,'live','paid',started,started,started+interval '1 month',p_method,trim(p_reference),actor.id) RETURNING * INTO o;
 INSERT INTO family_subscriptions(order_id,client_id,tier,mode,members,terms,starts_at,expires_at)
 VALUES(o.id,p_client_id,o.tier,'live',o.members,o.terms,o.starts_at,o.expires_at) RETURNING * INTO s;
 RETURN to_jsonb(s);
END $$;

-- Only the director may undo a mistaken manual activation, and only before it is used.
CREATE OR REPLACE FUNCTION public.zar_cancel_manual_subscription(p_order_id UUID,p_actor_id BIGINT)
RETURNS JSONB LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE actor users; o payment_orders;
BEGIN
 SELECT * INTO actor FROM users u WHERE id=p_actor_id AND role='director' AND to_jsonb(u)->>'blocked_at' IS NULL;
 IF actor.id IS NULL THEN RAISE EXCEPTION 'Ruxsat yo‘q.'; END IF;
 SELECT * INTO o FROM payment_orders WHERE id=p_order_id;
 IF o.id IS NULL OR o.method='payme' THEN RAISE EXCEPTION 'Qo‘lda yoqilgan obuna topilmadi.'; END IF;
 PERFORM 1 FROM users WHERE id=o.client_id FOR UPDATE;
 SELECT * INTO o FROM payment_orders WHERE id=p_order_id FOR UPDATE;
 IF o.status<>'paid' THEN RAISE EXCEPTION 'Bu obuna allaqachon bekor qilingan.'; END IF;
 IF EXISTS(SELECT 1 FROM subscription_usage u JOIN family_subscriptions s ON s.id=u.subscription_id WHERE s.order_id=o.id) THEN RAISE EXCEPTION 'Obunadan foydalanilgan. Bekor qilib bo‘lmaydi.'; END IF;
 UPDATE family_subscriptions SET status='cancelled' WHERE order_id=o.id;
 UPDATE payment_orders SET status='cancelled' WHERE id=o.id RETURNING * INTO o;
 RETURN to_jsonb(o);
END $$;

CREATE OR REPLACE FUNCTION public.zar_manual_payment_ready() RETURNS BOOLEAN LANGUAGE sql SET search_path=public,pg_temp AS $$ SELECT true $$;

REVOKE ALL ON FUNCTION public.zar_activate_manual_subscription(BIGINT,TEXT,JSONB,TEXT,TEXT,BIGINT),public.zar_cancel_manual_subscription(UUID,BIGINT),public.zar_manual_payment_ready() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.zar_activate_manual_subscription(BIGINT,TEXT,JSONB,TEXT,TEXT,BIGINT),public.zar_cancel_manual_subscription(UUID,BIGINT),public.zar_manual_payment_ready() TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
