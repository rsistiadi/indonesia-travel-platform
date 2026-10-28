-- Indonesia Travel Platform: access rules (Phase 1)
-- Principle: nobody can read or write anything unless a rule below says so. Money-changing actions go through functions.

-- ---------- 1. close everything first ----------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------- 2. views: what a partner / financier may see (no base price, no margin, no platform share) ----------
create view public.partner_commissions with (security_barrier = true) as
select o.id as order_id, o.code, o.partner_id, o.status, o.pax, o.total, o.created_at,
       m.partner_payout as commission, m.has_placeholder_tax,
       mb.full_name as buyer_name, d.depart_date, p.name as package_name
from public.orders o
join public.order_money m on m.order_id = o.id
join public.members mb on mb.id = o.member_id
join public.departures d on d.id = o.departure_id
join public.packages p on p.id = d.package_id
where public.is_partner_admin(o.partner_id) or public.can_see_cost();

create view public.financier_orders with (security_barrier = true) as
select fa.id as application_id, fa.financier_id, fa.status as application_status, fa.tenor, fa.quote, fa.reason,
       o.id as order_id, o.code, o.pax, o.total, o.created_at, mb.full_name as buyer_name, mb.phone as buyer_phone,
       mb.member_no, pr.name as partner_name, d.depart_date, p.name as package_name
from public.financing_applications fa
join public.orders o on o.id = fa.order_id
join public.members mb on mb.id = o.member_id
join public.partners pr on pr.id = o.partner_id
join public.departures d on d.id = o.departure_id
join public.packages p on p.id = d.package_id
where fa.financier_id in (select public.my_financier_ids()) or public.can_see_cost();

create view public.agreements_for_partner with (security_barrier = true) as
select a.id, a.partner_id, a.package_id, a.departure_id, a.selling_price, a.market_ref_price, a.commission_mode,
       a.partner_share_pct, a.fixed_per_pax, a.status, a.maidaa_confirmed_at, a.partner_confirmed_at, a.live_from, a.created_at
from public.price_agreements a
where public.is_partner_admin(a.partner_id) or public.can_see_cost();

-- ---------- 3. policies ----------
-- profiles: own row; staff may read names
create policy profiles_own on public.profiles for select using (id = auth.uid() or public.can_see_cost());
create policy profiles_upd on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_ins on public.profiles for insert with check (id = auth.uid());

-- partners and catalogue (public information)
create policy partners_public on public.partners for select using (active or public.can_see_cost());
create policy partners_staff on public.partners for all using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy packages_public on public.packages for select using (status in ('published','coming_soon') or public.can_see_cost());
create policy packages_staff on public.packages for all using (public.can_see_cost()) with check (public.can_see_cost());
create policy financiers_staff on public.financiers for select using (public.can_see_cost() or id in (select public.my_financier_ids()));
create policy financiers_admin on public.financiers for all using (public.is_platform_admin()) with check (public.is_platform_admin());

-- departures and cost: Maidaa and the platform only (partners see availability through catalog_for_partner)
create policy departures_staff on public.departures for all using (public.can_see_cost()) with check (public.can_see_cost());
create policy costs_staff on public.departure_costs for all using (public.can_see_cost()) with check (public.can_see_cost());
create policy exclusions_staff on public.partner_package_exclusions for all using (public.can_see_cost()) with check (public.can_see_cost());
create policy exclusions_partner on public.partner_package_exclusions for select using (public.is_partner_admin(partner_id));

-- staff roles
create policy roles_own on public.staff_roles for select using (user_id = auth.uid() or public.is_platform_admin());
create policy roles_admin on public.staff_roles for all using (public.is_platform_admin()) with check (public.is_platform_admin());

-- price agreements: changes only through functions; read through the view or as staff
create policy agreements_staff on public.price_agreements for select using (public.can_see_cost());

-- discount codes: the partner manages its own
create policy codes_partner on public.discount_codes for all
  using (public.is_partner_admin(partner_id) or public.can_see_cost())
  with check (public.is_partner_admin(partner_id) or public.can_see_cost());

-- roster and members
create policy roster_partner on public.roster_entries for all
  using (public.is_partner_admin(partner_id) or public.is_platform_admin())
  with check (public.is_partner_admin(partner_id) or public.is_platform_admin());
create policy members_read on public.members for select
  using (user_id = auth.uid() or public.is_partner_admin(partner_id) or public.can_see_cost());

-- orders: the buyer, the partner that sold it and Maidaa; financiers go through their view
create policy orders_read on public.orders for select
  using (buyer_user_id = auth.uid() or public.is_partner_admin(partner_id) or public.can_see_cost());
create policy order_money_staff on public.order_money for select using (public.can_see_cost());
create policy payments_read on public.payments for select
  using (public.can_see_cost() or exists (select 1 from public.orders o where o.id = order_id and o.buyer_user_id = auth.uid()));
create policy fin_read on public.financing_applications for select
  using (public.can_see_cost() or financier_id in (select public.my_financier_ids())
         or exists (select 1 from public.orders o where o.id = order_id and o.buyer_user_id = auth.uid()));

-- tax rules and settings: Maidaa reads, only the platform changes
create policy tax_read on public.tax_rules for select using (public.can_see_cost());
create policy tax_admin on public.tax_rules for all using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy settings_read on public.platform_settings for select using (public.can_see_cost());
create policy settings_admin on public.platform_settings for all using (public.is_platform_admin()) with check (public.is_platform_admin());

-- ledger: Maidaa sees all; a partner sees only its own commission lines
create policy ledger_staff on public.ledger_entries for all using (public.can_see_cost()) with check (public.can_see_cost());
create policy ledger_partner on public.ledger_entries for select using (party = 'partner' and public.is_partner_admin(partner_id));

-- audit: platform only, read only
create policy audit_read on public.audit_log for select using (public.is_platform_admin());

-- tickets
create policy tickets_read on public.tickets for select
  using (opened_by = auth.uid() or public.can_see_cost() or (partner_id is not null and public.is_partner_admin(partner_id)));
create policy tickets_ins on public.tickets for insert with check (opened_by = auth.uid());
create policy tickets_staff_upd on public.tickets for update using (public.can_see_cost()) with check (public.can_see_cost());

-- ---------- 4. table grants (RLS still decides which rows) ----------
grant select on public.partners, public.packages to anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select on public.financiers, public.staff_roles, public.partner_package_exclusions, public.price_agreements,
      public.members, public.orders, public.order_money, public.payments, public.financing_applications,
      public.tax_rules, public.platform_settings, public.audit_log to authenticated;
grant select, insert, update, delete on public.departures, public.departure_costs, public.discount_codes,
      public.roster_entries, public.ledger_entries, public.tax_rules, public.platform_settings, public.staff_roles,
      public.partner_package_exclusions, public.financiers to authenticated;
grant insert, update, delete on public.partners, public.packages to authenticated;
grant select, insert, update on public.tickets to authenticated;
grant select on public.ledger_entries to authenticated;
grant select on public.partner_commissions, public.financier_orders, public.agreements_for_partner to authenticated;
grant usage on all sequences in schema public to service_role;
grant all on all tables in schema public to service_role;

-- ---------- 5. who may call which function ----------
-- public site
grant execute on function public.catalog_for_partner(uuid), public.validate_code(uuid, text, text),
      public.financing_params(), public.seats_available(uuid) to anon, authenticated;
-- signed-in users
grant execute on function public.has_role(text), public.can_see_cost(), public.is_platform_admin(), public.is_partner_admin(uuid),
      public.my_financier_ids(), public.request_membership(uuid, text, text, text, text, uuid), public.decide_member(uuid, boolean, text),
      public.propose_price_agreement(uuid, uuid, uuid, bigint, bigint, text, numeric, bigint),
      public.confirm_price_agreement(uuid), public.reject_price_agreement(uuid),
      public.submit_payment(uuid, bigint, text, text), public.verify_payment(uuid, boolean, text),
      public.decide_financing(uuid, text, text), public.advance_order(uuid, text), public.cancel_own_order(uuid) to authenticated;
-- the trusted server only (it runs the money engine first)
grant execute on all functions in schema public to service_role;
