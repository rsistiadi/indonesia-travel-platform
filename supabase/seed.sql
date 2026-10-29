-- Sample data for local testing. Not production data. All tax rows are placeholders.
insert into public.financiers (id, name) values ('f0000000-0000-0000-0000-000000000001', 'Amitra');

insert into public.partners (id, slug, name, kind, eligibility_mode) values
 ('a0000000-0000-0000-0000-000000000001', 'idi',  'Primkop IDI', 'organization', 'manual'),
 ('a0000000-0000-0000-0000-000000000002', 'budi', 'dr. Budi',    'individual',   'none');

insert into public.packages (id, code, name, category, class, days, summary, tax_class, status) values
 ('b0000000-0000-0000-0000-000000000001', 'ECO', 'Umrah Economy',  'umrah', 'economy', 9,  '{"id":"Umrah hemat","en":"Economy umrah"}', 'pure_umrah', 'published'),
 ('b0000000-0000-0000-0000-000000000002', 'HRM', 'Umrah Haramain', 'umrah', 'premium', 12, '{"id":"Umrah premium","en":"Premium umrah"}', 'pure_umrah', 'published'),
 ('b0000000-0000-0000-0000-000000000003', 'HJK', 'Haji Khusus',    'haji',  'premium', 40, '{"id":"Segera hadir","en":"Coming soon"}', null, 'coming_soon');

insert into public.departures (id, package_id, depart_date, capacity, sold_outside) values
 ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', current_date + 60, 40, 5),
 ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', current_date + 90, 3, 0);
insert into public.departure_costs values
 ('c0000000-0000-0000-0000-000000000001', 26200000),
 ('c0000000-0000-0000-0000-000000000002', 36000000);

insert into public.discount_codes (partner_id, code, mode, value, owner_phone, allow_self) values
 ('a0000000-0000-0000-0000-000000000001', 'IDI-2026', 'idr', 500000, null, true),
 ('a0000000-0000-0000-0000-000000000002', 'BUDI-A7',  'idr', 300000, '081234567890', false);

insert into public.tax_rules (name, tax_type, tax_class, liable, base, rate_pct, effective_from, status, placeholder, source_note) values
 ('PLACEHOLDER margin tax', 'placeholder', null, 'platform', 'margin', 11, '2026-01-01', 'active', true, 'Not a real rate. Replace when confirmed.');

insert into public.platform_settings (key, value) values
 ('fees',      '{"transfer":25000,"card_pct":2,"financing_pool":500000}'),
 ('financing', '{"dp_pct":12.5,"admin":1000000,"factor":{"12":0.1005,"24":0.05906,"36":0.04583},"ins":{"12":4.0333,"24":8.1,"36":13.3}}'),
 ('holds',     '{"hold_hours_direct":24}');
