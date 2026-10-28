-- Permission and business-rule tests. Each check raises an exception on failure.
create schema t;
create function t.as_(u uuid, r text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(u::text, ''), false);
  execute 'reset role'; execute 'set role ' || r;
end $$;
create function t.su() returns void language plpgsql as $$ begin execute 'reset role'; perform set_config('request.jwt.claim.sub','',false); end $$;
-- run a statement and require that it FAILS (optionally with given text in the message)
create function t.fails(sql text, must text default null) returns void language plpgsql as $$
begin
  begin execute sql; exception when others then
    if must is not null and position(must in sqlerrm) = 0 then raise exception 'wrong error for [%]: %', sql, sqlerrm; end if;
    return;
  end;
  raise exception 'EXPECTED FAILURE but succeeded: %', sql;
end $$;
create function t.eq(label text, got anyelement, want anyelement) returns void language plpgsql as $$
begin if got is distinct from want then raise exception 'FAIL %: got %, want %', label, got, want; end if; raise notice 'ok  %', label; end $$;
grant usage on schema t to anon, authenticated, service_role;
grant execute on all functions in schema t to anon, authenticated, service_role;

insert into auth.users (id, email) values
 ('10000000-0000-0000-0000-000000000001','buyer@x'),('10000000-0000-0000-0000-000000000002','buyer2@x'),
 ('10000000-0000-0000-0000-000000000003','idiadmin@x'),('10000000-0000-0000-0000-000000000004','budiadmin@x'),
 ('10000000-0000-0000-0000-000000000005','maidaa@x'),('10000000-0000-0000-0000-000000000006','platform@x'),
 ('10000000-0000-0000-0000-000000000007','amitra@x');
insert into public.staff_roles (user_id, role, partner_id, financier_id) values
 ('10000000-0000-0000-0000-000000000003','partner_admin','a0000000-0000-0000-0000-000000000001',null),
 ('10000000-0000-0000-0000-000000000004','partner_admin','a0000000-0000-0000-0000-000000000002',null),
 ('10000000-0000-0000-0000-000000000005','maidaa_staff',null,null),
 ('10000000-0000-0000-0000-000000000006','platform_admin',null,null),
 ('10000000-0000-0000-0000-000000000007','financier_analyst',null,'f0000000-0000-0000-0000-000000000001');

do $$
declare
  buyer uuid := '10000000-0000-0000-0000-000000000001'; buyer2 uuid := '10000000-0000-0000-0000-000000000002';
  idiadm uuid := '10000000-0000-0000-0000-000000000003'; budiadm uuid := '10000000-0000-0000-0000-000000000004';
  maidaa uuid := '10000000-0000-0000-0000-000000000005'; plat uuid := '10000000-0000-0000-0000-000000000006';
  amitra uuid := '10000000-0000-0000-0000-000000000007';
  idi uuid := 'a0000000-0000-0000-0000-000000000001'; budi uuid := 'a0000000-0000-0000-0000-000000000002';
  eco uuid := 'b0000000-0000-0000-0000-000000000001'; hrm uuid := 'b0000000-0000-0000-0000-000000000002';
  dep1 uuid := 'c0000000-0000-0000-0000-000000000001'; dep2 uuid := 'c0000000-0000-0000-0000-000000000002';
  fin uuid := 'f0000000-0000-0000-0000-000000000001';
  ag uuid; ag2 uuid; mem public.members; r jsonb; ord uuid; pay uuid; app uuid; n int; code_idi uuid; code_budi uuid;
  money jsonb := '{"hpp_total":26200000,"fee":25000,"gross":2700000,"tax_total":364500,"net":2310500,"partner_share":1386300,"platform_share":924200,"partner_payout":1386300}';
begin
  select id into code_idi from public.discount_codes where code = 'IDI-2026';
  select id into code_budi from public.discount_codes where code = 'BUDI-A7';

  -- ===== price agreements: both sides must confirm, never below base price =====
  perform t.as_(idiadm, 'authenticated');
  perform t.fails($q$select public.propose_price_agreement('a0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001',null,26000000,null,'pct_of_net',60,null)$q$, 'PRICE_BELOW_MINIMUM');
  perform t.fails($q$select public.propose_price_agreement('a0000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-000000000001',null,28000000,null,'pct_of_net',60,null)$q$, 'NOT_ALLOWED');
  ag := public.propose_price_agreement(idi, eco, null, 28900000, 29500000, 'pct_of_net', 60, null);
  perform t.eq('partner proposal is not live', (select status from public.agreements_for_partner where id = ag), 'proposed');
  perform t.eq('no live price yet -> package shows coming soon', (select availability from public.catalog_for_partner(idi) where package_code = 'ECO'), 'coming_soon');
  perform t.as_(maidaa, 'authenticated');
  perform t.eq('Maidaa confirmation makes it live', public.confirm_price_agreement(ag), 'live');
  perform t.as_(maidaa, 'authenticated');
  ag2 := public.propose_price_agreement(budi, eco, null, 29500000, null, 'fixed_per_pax', null, 1000000);
  perform public.confirm_price_agreement(ag2);   -- Maidaa side only
  perform t.eq('one-sided stays proposed', (select status from public.price_agreements where id = ag2), 'proposed');
  perform t.as_(idiadm, 'authenticated');
  perform t.fails(format('select public.confirm_price_agreement(%L)', ag2), 'NOT_ALLOWED');
  perform t.as_(budiadm, 'authenticated');
  perform t.eq('Budi confirms -> live', public.confirm_price_agreement(ag2), 'live');
  -- HRM for IDI (cap 3 seats)
  perform t.as_(maidaa, 'authenticated');
  ag2 := public.propose_price_agreement(idi, hrm, null, 40000000, null, 'pct_of_net', 50, null);
  perform t.as_(idiadm, 'authenticated');
  perform t.eq('HRM live after both confirm', public.confirm_price_agreement(ag2), 'live');
  -- a new version supersedes the old one
  perform t.as_(idiadm, 'authenticated');
  perform t.as_(maidaa, 'authenticated');
  perform public.confirm_price_agreement(public.propose_price_agreement(idi, eco, null, 28900000, 29500000, 'pct_of_net', 60, null));
  perform t.su();
  perform t.eq('old agreement still live while new one is proposed', (select count(*) from public.price_agreements where partner_id = idi and package_id = eco and status = 'live')::int, 1);

  -- ===== membership and eligibility =====
  perform t.as_(buyer, 'authenticated');
  mem := public.request_membership(idi, 'IDI-123', 'dr. Siti', '0811');
  perform t.eq('manual eligibility starts pending', mem.status, 'pending');
  perform t.su();
  perform t.fails(format('select public.create_order_record(%L,%L,%L,1,%L,null,28900000,0,null,28900000,%L)', idi, mem.id, dep1, 'transfer', money), 'MEMBER_NOT_ELIGIBLE');
  perform t.as_(buyer, 'authenticated');
  perform t.fails(format('select public.decide_member(%L, true)', mem.id), 'NOT_ALLOWED');
  perform t.as_(budiadm, 'authenticated');
  perform t.fails(format('select public.decide_member(%L, true)', mem.id), 'NOT_ALLOWED');
  perform t.as_(idiadm, 'authenticated');
  perform public.decide_member(mem.id, true);

  -- ===== trusted order creation: only the server can call it =====
  perform t.as_(buyer, 'authenticated');
  perform t.fails(format('select public.create_order_record(%L,%L,%L,1,%L,null,28900000,0,null,28900000,%L)', idi, mem.id, dep1, 'transfer', money), 'permission denied');
  perform t.as_(null, 'anon');
  perform t.fails(format('select public.create_order_record(%L,%L,%L,1,%L,null,28900000,0,null,28900000,%L)', idi, mem.id, dep1, 'transfer', money), 'permission denied');
  perform t.as_(null, 'service_role');
  perform t.fails(format('select public.create_order_record(%L,%L,%L,1,%L,null,27000000,0,null,27000000,%L)', idi, mem.id, dep1, 'transfer', money), 'PRICE_MISMATCH');
  perform t.fails(format('select public.create_order_record(%L,%L,%L,1,%L,null,28900000,100000,null,28800000,%L)', idi, mem.id, dep1, 'transfer', money), 'DISCOUNT_TOO_HIGH');
  perform t.fails(format('select public.create_order_record(%L,%L,%L,1,%L,%L,28900000,500000,null,28400000,%L)', idi, mem.id, dep1, 'transfer', code_budi, money), 'CODE_NOT_VALID_HERE');
  perform t.fails(format('select public.create_order_record(%L,%L,%L,1,%L,%L,28900000,600000,null,28300000,%L)', idi, mem.id, dep1, 'transfer', code_idi, money), 'DISCOUNT_TOO_HIGH');
  perform t.fails(format('select public.create_order_record(%L,%L,%L,5,%L,null,40000000,0,null,200000000,%L)', idi, mem.id, dep2, 'transfer', money), 'SEATS_UNAVAILABLE');
  r := public.create_order_record(idi, mem.id, dep1, 2, 'transfer', null, 28900000, 0, null, 57800000,
         '{"hpp_total":52400000,"fee":25000,"gross":5400000,"tax_total":729000,"net":4621000,"partner_share":2772600,"platform_share":1848400,"partner_payout":2772600}');
  ord := (r ->> 'order_id')::uuid;
  perform t.eq('order is awaiting payment with a hold', r ->> 'status', 'awaiting_payment');
  perform t.eq('seats counted: 40 - 5 outside - 2 held', public.seats_available(dep1), 33);
  perform t.fails(format('select public.create_order_record(%L,%L,%L,1,%L,null,29500000,0,null,29500000,%L)', budi, mem.id, dep1, 'transfer', money), 'MEMBER_NOT_ELIGIBLE');

  -- ===== who can read what =====
  perform t.as_(buyer, 'authenticated');
  perform t.eq('buyer sees own order', (select count(*) from public.orders)::int, 1);
  perform t.eq('buyer sees no money rows', (select count(*) from public.order_money)::int, 0);
  perform t.eq('buyer sees no cost rows', (select count(*) from public.departure_costs)::int, 0);
  perform t.as_(buyer2, 'authenticated');
  perform t.eq('another buyer sees no orders', (select count(*) from public.orders)::int, 0);
  perform t.as_(idiadm, 'authenticated');
  perform t.eq('IDI admin sees its order', (select count(*) from public.partner_commissions)::int, 1);
  perform t.eq('IDI commission amount', (select commission from public.partner_commissions), 2772600::bigint);
  perform t.eq('partner cannot read cost rows', (select count(*) from public.departure_costs)::int, 0);
  perform t.eq('partner cannot read money rows', (select count(*) from public.order_money)::int, 0);
  perform t.eq('partner cannot read departures', (select count(*) from public.departures)::int, 0);
  perform t.fails('select hpp_total from public.partner_commissions', 'does not exist');
  perform t.fails('update public.orders set total = 1', 'permission denied');
  perform t.fails('insert into public.price_agreements (partner_id, package_id, selling_price, commission_mode, partner_share_pct, status) values (''a0000000-0000-0000-0000-000000000001'', ''b0000000-0000-0000-0000-000000000001'', 1000, ''pct_of_net'', 99, ''live'')', 'permission denied');
  perform t.as_(budiadm, 'authenticated');
  perform t.eq('other partner sees none of IDI orders', (select count(*) from public.partner_commissions)::int, 0);
  perform t.as_(maidaa, 'authenticated');
  perform t.eq('Maidaa sees cost', (select hpp_per_pax from public.departure_costs where departure_id = dep1), 26200000::bigint);
  perform t.as_(null, 'anon');
  perform t.eq('public catalogue shows ECO available', (select availability from public.catalog_for_partner(idi) where package_code = 'ECO' limit 1), 'available');
  perform t.eq('public catalogue shows price', (select selling_price from public.catalog_for_partner(idi) where package_code = 'ECO' limit 1), 28900000::bigint);
  perform t.eq('Haji is coming soon', (select availability from public.catalog_for_partner(idi) where package_code = 'HJK'), 'coming_soon');
  perform t.fails('select * from public.orders', 'permission denied');
  perform t.fails('select * from public.departures', 'permission denied');
  perform t.fails('select * from public.departure_costs', 'permission denied');
  perform t.eq('code from another site is rejected', (public.validate_code(idi, 'BUDI-A7') ->> 'ok')::boolean, false);
  perform t.eq('IDI code works on IDI site', (public.validate_code(idi, 'idi-2026') ->> 'ok')::boolean, true);
  perform t.eq('own code blocked by phone', public.validate_code(budi, 'BUDI-A7', '+62 812-3456-7890') ->> 'reason', 'self_not_allowed');
  perform t.as_(amitra, 'authenticated');
  perform t.eq('financier sees no orders directly', (select count(*) from public.orders)::int, 0);
  perform t.as_(plat, 'authenticated');
  perform t.eq('platform reads audit log', (select count(*) > 0 from public.audit_log), true);
  perform t.as_(maidaa, 'authenticated');
  perform t.eq('Maidaa cannot read audit log', (select count(*) from public.audit_log)::int, 0);
  perform t.fails('update public.audit_log set action = ''x''', 'permission denied');
  perform t.su();
  perform t.fails('update public.audit_log set action = ''x''', 'append-only');
  perform t.fails('delete from public.audit_log', 'append-only');

  -- ===== payments =====
  perform t.as_(buyer2, 'authenticated');
  perform t.fails(format('select public.submit_payment(%L, 1000, %L, %L)', ord, 'full', 'p.jpg'), 'NOT_ALLOWED');
  perform t.as_(buyer, 'authenticated');
  perform t.fails(format('select public.submit_payment(%L, 99999999999, %L, %L)', ord, 'full', 'p.jpg'), 'AMOUNT_INVALID');
  pay := public.submit_payment(ord, 57800000, 'full', 'proof.jpg');
  perform t.eq('order goes to payment review', (select status from public.orders where id = ord), 'payment_review');
  perform t.fails(format('select public.verify_payment(%L, true)', pay), 'NOT_ALLOWED');
  perform t.as_(idiadm, 'authenticated');
  perform t.fails(format('select public.verify_payment(%L, true)', pay), 'NOT_ALLOWED');
  perform t.as_(maidaa, 'authenticated');
  perform t.eq('Maidaa verifies -> paid', public.verify_payment(pay, true), 'paid');
  perform t.fails(format('select public.verify_payment(%L, true)', pay), 'NOT_PENDING');
  perform public.advance_order(ord, 'fulfilling');
  perform t.fails(format('select public.advance_order(%L, %L)', ord, 'paid'), 'INVALID_TRANSITION');

  -- ===== holds expire and free seats =====
  perform t.as_(null, 'service_role');
  r := public.create_order_record(idi, mem.id, dep2, 3, 'transfer', null, 40000000, 0, null, 120000000,
        '{"hpp_total":108000000,"fee":25000,"gross":12000000,"tax_total":1620000,"net":10355000,"partner_share":5177500,"platform_share":5177500,"partner_payout":5177500}');
  perform t.eq('last seats held', public.seats_available(dep2), 0);
  perform t.eq('sold out shows', (select availability from public.catalog_for_partner(idi) where package_code = 'HRM'), 'sold_out');
  perform t.su();
  update public.orders set hold_expires_at = now() - interval '1 minute' where id = (r ->> 'order_id')::uuid;
  perform t.eq('expired hold frees seats at once', public.seats_available(dep2), 3);
  perform t.eq('housekeeping marks it expired', public.expire_holds(), 1);

  -- ===== financing =====
  perform t.as_(null, 'service_role');
  r := public.create_order_record(idi, mem.id, dep1, 1, 'financing', null, 28900000, 0, null, 28900000, money, fin, 24, '{"installment":1524486}');
  perform t.eq('financed order waits for the financier', r ->> 'status', 'financing_review');
  perform t.su();
  app := (select id from public.financing_applications where order_id = (r ->> 'order_id')::uuid);
  perform t.as_(buyer, 'authenticated');
  perform t.fails(format('select public.decide_financing(%L, %L)', app, 'approved'), 'NOT_ALLOWED');
  perform t.as_(idiadm, 'authenticated');
  perform t.fails(format('select public.decide_financing(%L, %L)', app, 'approved'), 'NOT_ALLOWED');
  perform t.as_(amitra, 'authenticated');
  perform t.eq('financier sees its application via view', (select count(*) from public.financier_orders)::int, 1);
  perform t.fails(format('select public.decide_financing(%L, %L)', app, 'rejected'), 'REASON_REQUIRED');
  perform t.fails(format('select public.decide_financing(%L, %L)', app, 'disbursed'), 'INVALID_TRANSITION');
  perform public.decide_financing(app, 'approved');
  perform public.decide_financing(app, 'disbursed');
  perform t.su();
  perform t.eq('disbursement marks order paid', (select status from public.orders where id = (r ->> 'order_id')::uuid), 'paid');
end $$;
