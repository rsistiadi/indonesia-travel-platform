-- Indonesia Travel Platform: core schema (Phase 1)
-- Money is whole rupiah in bigint. Sensitive cost data lives in separate tables so row-level security can hide it.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  lang text not null default 'id' check (lang in ('id','en')),
  created_at timestamptz not null default now()
);

create table public.financiers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true
);

create table public.partners (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  kind text not null check (kind in ('organization','individual')),
  host text unique,                       -- site hostname, e.g. idi.example.com
  theme jsonb not null default '{}',      -- logo, colours, copy
  eligibility_mode text not null default 'manual' check (eligibility_mode in ('manual','roster','none')),
  allow_discount_codes boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.staff_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('platform_admin','maidaa_staff','partner_admin','financier_analyst')),
  partner_id uuid references public.partners(id) on delete cascade,
  financier_id uuid references public.financiers(id) on delete cascade,
  check ((role = 'partner_admin') = (partner_id is not null)),
  check ((role = 'financier_analyst') = (financier_id is not null))
);
create unique index staff_roles_uniq on public.staff_roles
  (user_id, role, coalesce(partner_id, '00000000-0000-0000-0000-000000000000'), coalesce(financier_id, '00000000-0000-0000-0000-000000000000'));

-- ---------- catalogue (one shared inventory for every channel) ----------
create table public.packages (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  category text not null check (category in ('umrah','holyland','haji')),
  class text not null,
  days int not null check (days > 0),
  summary jsonb not null default '{}',     -- {"id": "...", "en": "..."}
  includes jsonb not null default '[]',
  tax_class text,                          -- selects tax rules, e.g. 'pure_umrah' or 'mixed'
  status text not null default 'draft' check (status in ('draft','published','coming_soon')),
  created_at timestamptz not null default now()
);

create table public.departures (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.packages(id) on delete cascade,
  depart_date date not null,
  capacity int not null check (capacity > 0),
  sold_outside int not null default 0 check (sold_outside >= 0),   -- seats Maidaa sold through other channels
  status text not null default 'open' check (status in ('open','closed','cancelled')),
  created_at timestamptz not null default now()
);

create table public.departure_costs (       -- HPP: visible to Maidaa and the platform only
  departure_id uuid primary key references public.departures(id) on delete cascade,
  hpp_per_pax bigint not null check (hpp_per_pax >= 0)
);

create table public.partner_package_exclusions (   -- default is "sell everything"; exceptions only
  partner_id uuid not null references public.partners(id) on delete cascade,
  package_id uuid not null references public.packages(id) on delete cascade,
  primary key (partner_id, package_id)
);

-- ---------- agreed prices (versioned: a change is a new row) ----------
create table public.price_agreements (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  package_id uuid not null references public.packages(id) on delete cascade,
  departure_id uuid references public.departures(id) on delete cascade,  -- null = all departures of the package
  selling_price bigint not null check (selling_price > 0),
  market_ref_price bigint check (market_ref_price > 0),
  commission_mode text not null check (commission_mode in ('pct_of_net','fixed_per_pax')),
  partner_share_pct numeric(5,2) check (partner_share_pct between 0 and 100),
  fixed_per_pax bigint check (fixed_per_pax >= 0),
  status text not null default 'proposed' check (status in ('proposed','live','superseded','rejected')),
  proposed_by uuid references auth.users(id),
  maidaa_confirmed_by uuid references auth.users(id),
  maidaa_confirmed_at timestamptz,
  partner_confirmed_by uuid references auth.users(id),
  partner_confirmed_at timestamptz,
  live_from timestamptz,
  created_at timestamptz not null default now(),
  check ((commission_mode = 'pct_of_net' and partner_share_pct is not null)
      or (commission_mode = 'fixed_per_pax' and fixed_per_pax is not null))
);
create index price_agreements_lookup on public.price_agreements (partner_id, package_id, status);

create table public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  code text not null unique check (code = upper(code)),
  mode text not null check (mode in ('idr','pct')),
  value numeric(12,2) not null check (value >= 0),
  owner_phone text,                         -- individual resellers: used to detect buying with your own code
  allow_self boolean not null default false,
  active boolean not null default true
);

-- ---------- members and eligibility ----------
create table public.roster_entries (        -- the partner's member list (loaded when available)
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  member_no text not null,
  full_name text,
  phone text,
  email text,
  active boolean not null default true,
  unique (partner_id, member_no)
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  member_no text,
  full_name text not null,
  phone text,
  relation text not null default 'member' check (relation in ('member','family')),
  sponsor_member_id uuid references public.members(id),
  status text not null default 'pending' check (status in ('pending','approved','rejected','blocked')),
  decided_by uuid references auth.users(id),
  decided_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  unique (partner_id, user_id)
);

-- ---------- orders ----------
create sequence public.order_seq start 1050;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('M-' || nextval('public.order_seq')),
  partner_id uuid not null references public.partners(id),
  member_id uuid not null references public.members(id),
  buyer_user_id uuid not null references auth.users(id),
  departure_id uuid not null references public.departures(id),
  agreement_id uuid not null references public.price_agreements(id),
  pax int not null check (pax between 1 and 20),
  method text not null check (method in ('transfer','card','financing')),
  status text not null default 'held' check (status in
    ('held','awaiting_payment','payment_review','financing_review','paid','fulfilling','ready','cancelled','expired')),
  hold_expires_at timestamptz,
  discount_code_id uuid references public.discount_codes(id),
  unit_price bigint not null check (unit_price > 0),
  discount_per_pax bigint not null default 0 check (discount_per_pax >= 0),
  add_ons jsonb not null default '{}',
  total bigint not null check (total > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_departure_status on public.orders (departure_id, status);
create index orders_partner on public.orders (partner_id, created_at desc);

create table public.order_money (            -- the margin split snapshot: Maidaa and platform only
  order_id uuid primary key references public.orders(id) on delete cascade,
  hpp_total bigint not null,
  fee bigint not null,
  gross bigint not null,
  tax_total bigint not null,
  net bigint not null,
  partner_share bigint not null,
  platform_share bigint not null,
  partner_payout bigint not null,
  tax_lines jsonb not null default '[]',
  commission_snapshot jsonb not null default '{}',
  has_placeholder_tax boolean not null default true,
  engine_version text not null,
  computed_at timestamptz not null default now(),
  check (partner_share + platform_share = net)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  amount bigint not null check (amount > 0),
  kind text not null check (kind in ('dp','balance','full')),
  proof_path text,
  status text not null default 'pending' check (status in ('pending','verified','rejected')),
  submitted_at timestamptz not null default now(),
  verified_by uuid references auth.users(id),
  verified_at timestamptz,
  note text
);

create table public.financing_applications (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  financier_id uuid not null references public.financiers(id),
  tenor int not null check (tenor > 0),
  quote jsonb not null default '{}',        -- snapshot of the instalment figures shown to the buyer
  status text not null default 'submitted' check (status in ('submitted','docs_requested','approved','rejected','disbursed')),
  decided_by uuid references auth.users(id),
  decided_at timestamptz,
  reason text,
  created_at timestamptz not null default now()
);

-- ---------- tax and settings: rules are data ----------
create table public.tax_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tax_type text not null,
  tax_class text,                           -- null = applies to every package
  liable text not null check (liable in ('maidaa','partner','platform')),
  base text not null check (base in ('billed_amount','margin','commission')),
  rate_pct numeric(7,3) not null check (rate_pct >= 0),
  effective_from date not null,
  effective_to date,
  status text not null default 'draft' check (status in ('draft','active','retired')),
  placeholder boolean not null default true,
  source_note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from)
);

create table public.platform_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

-- ---------- money ledger, audit, escalations ----------
create table public.ledger_entries (
  id bigserial primary key,
  order_id uuid not null references public.orders(id),
  party text not null check (party in ('maidaa','partner','platform','tax','financier')),
  partner_id uuid references public.partners(id),
  kind text not null,
  amount bigint not null,
  status text not null default 'pending' check (status in ('pending','approved','paid')),
  created_at timestamptz not null default now(),
  approved_by uuid references auth.users(id),
  paid_at timestamptz
);

create table public.audit_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor_id uuid,
  actor_role text,
  action text not null,
  entity text not null,
  entity_id text,
  detail jsonb not null default '{}'
);

create table public.tickets (               -- Maiya escalations and support requests
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id),
  partner_id uuid references public.partners(id),
  opened_by uuid references auth.users(id),
  kind text not null default 'support' check (kind in ('support','emergency')),
  body text not null,
  status text not null default 'open' check (status in ('open','done')),
  created_at timestamptz not null default now()
);
