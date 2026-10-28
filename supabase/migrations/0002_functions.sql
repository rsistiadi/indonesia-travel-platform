-- Indonesia Travel Platform: helpers, business rules and audit triggers (Phase 1)
-- Every function that touches protected data is SECURITY DEFINER with a fixed search_path and checks the caller itself.

-- ---------- who is calling ----------
create or replace function public.has_role(p_role text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff_roles where user_id = auth.uid() and role = p_role)
$$;

create or replace function public.can_see_cost() returns boolean      -- Maidaa staff and the platform
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff_roles where user_id = auth.uid() and role in ('platform_admin','maidaa_staff'))
$$;

create or replace function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role('platform_admin')
$$;

create or replace function public.is_partner_admin(p_partner uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff_roles where user_id = auth.uid() and role = 'partner_admin' and partner_id = p_partner)
$$;

create or replace function public.my_financier_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select financier_id from public.staff_roles where user_id = auth.uid() and role = 'financier_analyst'
$$;

-- ---------- audit ----------
create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_role text; v_row jsonb; v_detail jsonb;
begin
  select string_agg(role, ',') into v_role from public.staff_roles where user_id = auth.uid();
  if tg_op = 'DELETE' then v_row := to_jsonb(old); v_detail := v_row;
  elsif tg_op = 'UPDATE' then v_row := to_jsonb(new); v_detail := jsonb_build_object('old', to_jsonb(old), 'new', v_row);
  else v_row := to_jsonb(new); v_detail := v_row; end if;
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail)
  values (auth.uid(), coalesce(v_role, 'user'), tg_op, tg_table_name,
          coalesce(v_row ->> 'id', v_row ->> 'key', v_row ->> 'order_id'), v_detail);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

create or replace function public.audit_log_immutable() returns trigger
language plpgsql as $$ begin raise exception 'audit_log is append-only'; end $$;
create trigger audit_log_no_update before update or delete on public.audit_log
  for each row execute function public.audit_log_immutable();

do $$
declare t text;
begin
  foreach t in array array['partners','price_agreements','discount_codes','members','orders','order_money','payments',
                            'financing_applications','tax_rules','platform_settings','departure_costs','staff_roles','roster_entries']
  loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_row()', 'audit_' || t, t);
  end loop;
end $$;

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger orders_touch before update on public.orders for each row execute function public.touch_updated_at();

-- ---------- shared inventory ----------
-- A seat is taken by: paid/active orders, orders under review, and unexpired holds.
create or replace function public.seats_taken(p_dep uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(sum(pax), 0)::int from public.orders
  where departure_id = p_dep and (
    status in ('paid','fulfilling','ready','financing_review','payment_review')
    or (status in ('held','awaiting_payment') and hold_expires_at > now()))
$$;

create or replace function public.seats_available(p_dep uuid) returns int
language sql stable security definer set search_path = public as $$
  select greatest(0, d.capacity - d.sold_outside - public.seats_taken(d.id)) from public.departures d where d.id = p_dep
$$;

-- ---------- agreed prices ----------
create or replace function public.live_agreement(p_partner uuid, p_departure uuid) returns public.price_agreements
language sql stable security definer set search_path = public as $$
  select pa.* from public.price_agreements pa
  join public.departures d on d.id = p_departure
  where pa.partner_id = p_partner and pa.package_id = d.package_id and pa.status = 'live'
    and (pa.departure_id = p_departure or pa.departure_id is null)
  order by (pa.departure_id is not null) desc, pa.live_from desc
  limit 1
$$;

-- the lowest selling price allowed = the highest base price among the departures the agreement covers
create or replace function public.min_allowed_price(p_package uuid, p_departure uuid) returns bigint
language sql stable security definer set search_path = public as $$
  select coalesce(max(c.hpp_per_pax), 0) from public.departures d
  join public.departure_costs c on c.departure_id = d.id
  where d.package_id = p_package and d.status <> 'cancelled' and (p_departure is null or d.id = p_departure)
$$;

create or replace function public.propose_price_agreement(
  p_partner uuid, p_package uuid, p_departure uuid, p_price bigint, p_market bigint,
  p_mode text, p_pct numeric, p_fixed bigint) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_maidaa boolean := public.can_see_cost(); v_partner boolean := public.is_partner_admin(p_partner);
begin
  if not (v_maidaa or v_partner) then raise exception 'NOT_ALLOWED' using errcode = '42501'; end if;
  -- the message never reveals the base price: partners must not learn the HPP from an error
  if p_price < public.min_allowed_price(p_package, p_departure) then raise exception 'PRICE_BELOW_MINIMUM' using errcode = '23514'; end if;
  update public.price_agreements set status = 'superseded'
   where partner_id = p_partner and package_id = p_package and departure_id is not distinct from p_departure and status = 'proposed';
  insert into public.price_agreements (partner_id, package_id, departure_id, selling_price, market_ref_price, commission_mode,
      partner_share_pct, fixed_per_pax, proposed_by,
      maidaa_confirmed_by, maidaa_confirmed_at, partner_confirmed_by, partner_confirmed_at)
  values (p_partner, p_package, p_departure, p_price, p_market, p_mode, p_pct, p_fixed, auth.uid(),
      case when v_maidaa then auth.uid() end, case when v_maidaa then now() end,
      case when v_partner and not v_maidaa then auth.uid() end, case when v_partner and not v_maidaa then now() end)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.confirm_price_agreement(p_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare a public.price_agreements; v_maidaa boolean := public.can_see_cost();
begin
  select * into a from public.price_agreements where id = p_id for update;
  if a.id is null then raise exception 'NOT_FOUND'; end if;
  if a.status <> 'proposed' then raise exception 'NOT_PROPOSED'; end if;
  if v_maidaa then
    update public.price_agreements set maidaa_confirmed_by = auth.uid(), maidaa_confirmed_at = now() where id = p_id;
  elsif public.is_partner_admin(a.partner_id) then
    update public.price_agreements set partner_confirmed_by = auth.uid(), partner_confirmed_at = now() where id = p_id;
  else raise exception 'NOT_ALLOWED' using errcode = '42501'; end if;
  select * into a from public.price_agreements where id = p_id;
  if a.maidaa_confirmed_at is not null and a.partner_confirmed_at is not null then
    if a.selling_price < public.min_allowed_price(a.package_id, a.departure_id) then raise exception 'PRICE_BELOW_MINIMUM' using errcode = '23514'; end if;
    update public.price_agreements set status = 'superseded'
     where partner_id = a.partner_id and package_id = a.package_id and departure_id is not distinct from a.departure_id and status = 'live';
    update public.price_agreements set status = 'live', live_from = now() where id = p_id;
    return 'live';
  end if;
  return 'proposed';
end $$;

create or replace function public.reject_price_agreement(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare a public.price_agreements;
begin
  select * into a from public.price_agreements where id = p_id for update;
  if a.id is null or a.status <> 'proposed' then raise exception 'NOT_PROPOSED'; end if;
  if not (public.can_see_cost() or public.is_partner_admin(a.partner_id)) then raise exception 'NOT_ALLOWED' using errcode = '42501'; end if;
  update public.price_agreements set status = 'rejected' where id = p_id;
end $$;

-- ---------- the catalogue a partner site shows (no cost data, ever) ----------
create or replace function public.catalog_for_partner(p_partner uuid)
returns table (departure_id uuid, package_id uuid, package_code text, name text, category text, class text, days int,
               summary jsonb, includes jsonb, depart_date date, availability text, seats_left int, selling_price bigint)
language sql stable security definer set search_path = public as $$
  select d.id, p.id, p.code, p.name, p.category, p.class, p.days, p.summary, p.includes, d.depart_date,
    case
      when p.status = 'coming_soon' or d.id is null then 'coming_soon'
      when (public.live_agreement(pr.id, d.id)).id is null then 'coming_soon'
      when public.seats_available(d.id) = 0 then 'sold_out'
      else 'available' end,
    case when p.status = 'published' and d.id is not null then public.seats_available(d.id) end,
    case when p.status = 'published' and d.id is not null then (public.live_agreement(pr.id, d.id)).selling_price end
  from public.partners pr
  join public.packages p on p.status in ('published','coming_soon')
  left join public.departures d on d.package_id = p.id and p.status = 'published' and d.status = 'open' and d.depart_date >= current_date
  where pr.id = p_partner and pr.active
    and not exists (select 1 from public.partner_package_exclusions x where x.partner_id = pr.id and x.package_id = p.id)
    and (p.status = 'coming_soon' or d.id is not null)
  order by d.depart_date nulls last, p.name
$$;

-- ---------- members and eligibility ----------
create or replace function public.request_membership(
  p_partner uuid, p_member_no text, p_name text, p_phone text default null,
  p_relation text default 'member', p_sponsor uuid default null) returns public.members
language plpgsql security definer set search_path = public as $$
declare v_mode text; v_status text := 'pending'; m public.members;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  select eligibility_mode into v_mode from public.partners where id = p_partner and active;
  if v_mode is null then raise exception 'UNKNOWN_PARTNER'; end if;
  if v_mode = 'none' then v_status := 'approved';
  elsif v_mode = 'roster' and p_relation = 'member' and exists
    (select 1 from public.roster_entries where partner_id = p_partner and member_no = p_member_no and active) then v_status := 'approved';
  end if;
  insert into public.members (partner_id, user_id, member_no, full_name, phone, relation, sponsor_member_id, status, decided_at, note)
  values (p_partner, auth.uid(), p_member_no, p_name, p_phone, p_relation, p_sponsor, v_status,
          case when v_status = 'approved' then now() end, case when v_status = 'approved' then 'automatic' end)
  on conflict (partner_id, user_id) do update
    set member_no = excluded.member_no, full_name = excluded.full_name, phone = excluded.phone, relation = excluded.relation,
        sponsor_member_id = excluded.sponsor_member_id,
        status = case when public.members.status = 'blocked' then 'blocked' else excluded.status end,
        decided_at = case when public.members.status = 'blocked' then public.members.decided_at else excluded.decided_at end
  returning * into m;
  return m;
end $$;

create or replace function public.decide_member(p_member uuid, p_approve boolean, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare m public.members;
begin
  select * into m from public.members where id = p_member for update;
  if m.id is null then raise exception 'NOT_FOUND'; end if;
  if not (public.is_partner_admin(m.partner_id) or public.is_platform_admin()) then raise exception 'NOT_ALLOWED' using errcode = '42501'; end if;
  update public.members set status = case when p_approve then 'approved' else 'rejected' end,
         decided_by = auth.uid(), decided_at = now(), note = p_note where id = p_member;
end $$;

-- Indonesian phone numbers: +62 812..., 62812... and 0812... are the same number
create or replace function public.norm_phone(p text) returns text language sql immutable as $$
  select case when d like '62%' then '0' || substr(d, 3) when d like '8%' then '0' || d else d end
  from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as d) x
$$;

-- ---------- codes (a code works only on its own partner site; wrong and unknown look the same) ----------
create or replace function public.validate_code(p_partner uuid, p_code text, p_phone text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c public.discount_codes; v_self boolean;
begin
  select * into c from public.discount_codes where code = upper(trim(coalesce(p_code, ''))) and partner_id = p_partner and active;
  if c.id is null or not exists (select 1 from public.partners where id = p_partner and active and allow_discount_codes)
    then return jsonb_build_object('ok', false, 'reason', 'invalid_here'); end if;
  v_self := c.owner_phone is not null and p_phone is not null
            and public.norm_phone(c.owner_phone) = public.norm_phone(p_phone);
  if v_self and not c.allow_self then return jsonb_build_object('ok', false, 'reason', 'self_not_allowed'); end if;
  return jsonb_build_object('ok', true, 'mode', c.mode, 'value', c.value, 'self', v_self, 'code_id', c.id);
end $$;

-- ---------- settings the public site may read ----------
create or replace function public.financing_params() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((select value from public.platform_settings where key = 'financing'), '{}'::jsonb)
$$;

create or replace function public.active_tax_rules(p_class text, p_on date default current_date) returns setof public.tax_rules
language sql stable security definer set search_path = public as $$
  select * from public.tax_rules
  where status = 'active' and effective_from <= p_on and (effective_to is null or effective_to >= p_on)
    and (tax_class is null or tax_class = p_class)
$$;

-- ---------- placing an order (called by the trusted server after the money engine ran) ----------
create or replace function public.create_order_record(
  p_partner uuid, p_member uuid, p_departure uuid, p_pax int, p_method text, p_code_id uuid,
  p_unit_price bigint, p_discount_per_pax bigint, p_add_ons jsonb, p_total bigint, p_money jsonb,
  p_financier uuid default null, p_tenor int default null, p_fin_quote jsonb default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  m public.members; d public.departures; pk public.packages; ag public.price_agreements; v_hpp bigint;
  c public.discount_codes; v_rule numeric; v_hold int; o public.orders; v_status text;
begin
  select * into m from public.members where id = p_member;
  if m.id is null or m.partner_id <> p_partner or m.status <> 'approved' then raise exception 'MEMBER_NOT_ELIGIBLE' using errcode = '42501'; end if;

  select * into d from public.departures where id = p_departure for update;     -- serialises sales of the same departure
  if d.id is null or d.status <> 'open' or d.depart_date < current_date then raise exception 'DEPARTURE_NOT_AVAILABLE'; end if;
  select * into pk from public.packages where id = d.package_id;
  if pk.status <> 'published' then raise exception 'DEPARTURE_NOT_AVAILABLE'; end if;
  if exists (select 1 from public.partner_package_exclusions where partner_id = p_partner and package_id = pk.id)
    then raise exception 'NOT_SOLD_HERE'; end if;
  if public.seats_available(p_departure) < p_pax then raise exception 'SEATS_UNAVAILABLE'; end if;

  ag := public.live_agreement(p_partner, p_departure);
  if ag.id is null or ag.selling_price <> p_unit_price then raise exception 'PRICE_MISMATCH'; end if;
  select hpp_per_pax into v_hpp from public.departure_costs where departure_id = p_departure;
  if v_hpp is null or p_unit_price - p_discount_per_pax < v_hpp then raise exception 'BELOW_COST'; end if;
  if (p_money ->> 'hpp_total')::bigint < v_hpp * p_pax then raise exception 'MONEY_SNAPSHOT_INVALID'; end if;
  if p_total < (p_unit_price - p_discount_per_pax) * p_pax then raise exception 'MONEY_SNAPSHOT_INVALID'; end if;

  if p_code_id is not null then
    select * into c from public.discount_codes where id = p_code_id and active;
    if c.id is null or c.partner_id <> p_partner then raise exception 'CODE_NOT_VALID_HERE'; end if;
    v_rule := case c.mode when 'idr' then c.value else p_unit_price * c.value / 100 end;
    if p_discount_per_pax > ceil(v_rule) then raise exception 'DISCOUNT_TOO_HIGH'; end if;
  elsif p_discount_per_pax <> 0 then raise exception 'DISCOUNT_TOO_HIGH';
  end if;

  select coalesce((value ->> 'hold_hours_direct')::int, 24) into v_hold from public.platform_settings where key = 'holds';
  v_hold := coalesce(v_hold, 24);
  if p_method = 'financing' then
    if p_financier is null or p_tenor is null then raise exception 'FINANCING_DETAILS_REQUIRED'; end if;
    v_status := 'financing_review';
  else v_status := 'awaiting_payment'; end if;

  insert into public.orders (partner_id, member_id, buyer_user_id, departure_id, agreement_id, pax, method, status, hold_expires_at,
                             discount_code_id, unit_price, discount_per_pax, add_ons, total)
  values (p_partner, p_member, m.user_id, p_departure, ag.id, p_pax, p_method, v_status,
          case when v_status = 'awaiting_payment' then now() + make_interval(hours => v_hold) end,
          p_code_id, p_unit_price, p_discount_per_pax, coalesce(p_add_ons, '{}'), p_total)
  returning * into o;

  insert into public.order_money (order_id, hpp_total, fee, gross, tax_total, net, partner_share, platform_share, partner_payout,
                                  tax_lines, commission_snapshot, has_placeholder_tax, engine_version)
  values (o.id, (p_money ->> 'hpp_total')::bigint, (p_money ->> 'fee')::bigint, (p_money ->> 'gross')::bigint,
          (p_money ->> 'tax_total')::bigint, (p_money ->> 'net')::bigint, (p_money ->> 'partner_share')::bigint,
          (p_money ->> 'platform_share')::bigint, (p_money ->> 'partner_payout')::bigint,
          coalesce(p_money -> 'tax_lines', '[]'), coalesce(p_money -> 'commission_snapshot', '{}'),
          coalesce((p_money ->> 'has_placeholder_tax')::boolean, true), coalesce(p_money ->> 'engine_version', 'unknown'));

  if p_method = 'financing' then
    insert into public.financing_applications (order_id, financier_id, tenor, quote) values (o.id, p_financier, p_tenor, coalesce(p_fin_quote, '{}'));
  end if;
  return jsonb_build_object('order_id', o.id, 'code', o.code, 'status', o.status, 'hold_expires_at', o.hold_expires_at);
end $$;

-- ---------- payments ----------
create or replace function public.submit_payment(p_order uuid, p_amount bigint, p_kind text, p_proof text) returns uuid
language plpgsql security definer set search_path = public as $$
declare o public.orders; v_paid bigint; v_pending bigint; v_id uuid;
begin
  select * into o from public.orders where id = p_order for update;
  if o.id is null or o.buyer_user_id <> auth.uid() then raise exception 'NOT_ALLOWED' using errcode = '42501'; end if;
  if o.method = 'financing' or o.status not in ('awaiting_payment','payment_review') then raise exception 'ORDER_NOT_PAYABLE'; end if;
  select coalesce(sum(amount) filter (where status = 'verified'), 0), coalesce(sum(amount) filter (where status = 'pending'), 0)
    into v_paid, v_pending from public.payments where order_id = o.id;
  if p_amount <= 0 or p_amount > o.total - v_paid - v_pending then raise exception 'AMOUNT_INVALID'; end if;
  insert into public.payments (order_id, amount, kind, proof_path) values (o.id, p_amount, p_kind, p_proof) returning id into v_id;
  update public.orders set status = 'payment_review' where id = o.id;
  return v_id;
end $$;

create or replace function public.verify_payment(p_payment uuid, p_ok boolean, p_note text default null) returns text
language plpgsql security definer set search_path = public as $$
declare pay public.payments; o public.orders; v_paid bigint; v_hold int;
begin
  if not public.can_see_cost() then raise exception 'NOT_ALLOWED' using errcode = '42501'; end if;
  select * into pay from public.payments where id = p_payment for update;
  if pay.id is null or pay.status <> 'pending' then raise exception 'NOT_PENDING'; end if;
  select * into o from public.orders where id = pay.order_id for update;
  update public.payments set status = case when p_ok then 'verified' else 'rejected' end,
         verified_by = auth.uid(), verified_at = now(), note = p_note where id = pay.id;
  select coalesce(sum(amount), 0) into v_paid from public.payments where order_id = o.id and status = 'verified';
  if p_ok and v_paid >= o.total then
    update public.orders set status = 'paid', hold_expires_at = null where id = o.id; return 'paid';
  end if;
  if not exists (select 1 from public.payments where order_id = o.id and status = 'pending') then
    select coalesce((value ->> 'hold_hours_direct')::int, 24) into v_hold from public.platform_settings where key = 'holds';
    update public.orders set status = 'awaiting_payment', hold_expires_at = now() + make_interval(hours => coalesce(v_hold, 24)) where id = o.id;
  end if;
  return 'awaiting_payment';
end $$;

-- ---------- financing decisions ----------
create or replace function public.decide_financing(p_app uuid, p_status text, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare a public.financing_applications;
begin
  select * into a from public.financing_applications where id = p_app for update;
  if a.id is null then raise exception 'NOT_FOUND'; end if;
  if not (public.can_see_cost() or a.financier_id in (select public.my_financier_ids())) then raise exception 'NOT_ALLOWED' using errcode = '42501'; end if;
  if p_status not in ('docs_requested','approved','rejected','disbursed') then raise exception 'INVALID_STATUS'; end if;
  if p_status in ('docs_requested','rejected') and coalesce(trim(p_reason), '') = '' then raise exception 'REASON_REQUIRED'; end if;
  if (a.status, p_status) not in (('submitted','docs_requested'),('submitted','approved'),('submitted','rejected'),
        ('docs_requested','approved'),('docs_requested','rejected'),('approved','disbursed')) then raise exception 'INVALID_TRANSITION'; end if;
  update public.financing_applications set status = p_status, decided_by = auth.uid(), decided_at = now(), reason = p_reason where id = a.id;
  if p_status = 'disbursed' then update public.orders set status = 'paid' where id = a.order_id;
  elsif p_status = 'rejected' then update public.orders set status = 'cancelled' where id = a.order_id;
  end if;
end $$;

-- ---------- fulfilment and housekeeping ----------
create or replace function public.advance_order(p_order uuid, p_to text) returns void
language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  if not public.can_see_cost() then raise exception 'NOT_ALLOWED' using errcode = '42501'; end if;
  select * into o from public.orders where id = p_order for update;
  if o.id is null then raise exception 'NOT_FOUND'; end if;
  if (o.status, p_to) not in (('paid','fulfilling'),('fulfilling','ready'),('held','cancelled'),('awaiting_payment','cancelled'),
                              ('payment_review','cancelled'),('financing_review','cancelled'),('paid','cancelled'),('fulfilling','cancelled'))
    then raise exception 'INVALID_TRANSITION'; end if;
  update public.orders set status = p_to where id = p_order;
end $$;

create or replace function public.cancel_own_order(p_order uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  select * into o from public.orders where id = p_order for update;
  if o.id is null or o.buyer_user_id <> auth.uid() then raise exception 'NOT_ALLOWED' using errcode = '42501'; end if;
  if o.status not in ('held','awaiting_payment') then raise exception 'INVALID_TRANSITION'; end if;
  update public.orders set status = 'cancelled' where id = o.id;
end $$;

create or replace function public.expire_holds() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.orders set status = 'expired' where status in ('held','awaiting_payment') and hold_expires_at <= now();
  get diagnostics n = row_count; return n;
end $$;
