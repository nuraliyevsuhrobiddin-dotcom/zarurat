-- Payme sandbox: account-state errors must be in -31050..-31099.
BEGIN;
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

COMMIT;
