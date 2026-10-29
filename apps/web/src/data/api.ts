// Demo backend. It follows the same rules as supabase/migrations (0002_functions.sql, 0003_rls_grants.sql):
// partners and buyers never receive base price or margin, orders are only created through placeOrder(),
// and money-changing actions check the caller's role. Swapping this file for Supabase calls keeps the screens unchanged.
import { quote, financing } from '@itp/money-engine';
import type { Quote, TaxRule } from '@itp/money-engine';
import type * as T from './types.ts';
import { seedState } from './seed.ts';

const KEY = 'itp.demo.v2', SESSION = 'itp.demo.user';
const uid = (p: string) => p + Math.random().toString(36).slice(2, 9);
const now = () => new Date().toISOString();
const digits = (p?: string | null) => { const d = (p || '').replace(/\D/g, ''); return d.startsWith('62') ? '0' + d.slice(2) : d.startsWith('8') ? '0' + d : d; };
const err = (c: string): never => { throw new Error(c); };
const SEAT_STATUSES: T.OrderStatus[] = ['paid', 'fulfilling', 'ready', 'financing_review', 'payment_review'];

export class Api {
  private s: T.State;
  private subs = new Set<() => void>();
  private userId: string | null = null;
  private system = false;

  constructor() {
    let loaded: T.State | null = null;
    try { const raw = localStorage.getItem(KEY); if (raw) loaded = JSON.parse(raw); } catch { /* ignore */ }
    this.s = loaded ?? this.fresh();
    try { this.userId = localStorage.getItem(SESSION); } catch { /* ignore */ }
    window.addEventListener('storage', (e) => { if (e.key === KEY && e.newValue) { this.s = JSON.parse(e.newValue); this.emit(false); } });
  }

  // ---------- plumbing ----------
  subscribe(f: () => void) { this.subs.add(f); return () => { this.subs.delete(f); }; }
  private emit(save = true) {
    if (save) { try { localStorage.setItem(KEY, JSON.stringify(this.s)); } catch { /* ignore */ } }
    this.subs.forEach((f) => f());
  }
  private log(action: string, detail: string) {
    const u = this.me();
    this.s.audit.unshift({ id: uid('au'), at: now(), actor: this.system ? 'sistem' : u ? `${u.name} (${u.role})` : 'anon', action, detail });
    this.s.audit = this.s.audit.slice(0, 500);
  }
  private fresh(): T.State {
    const prev = this.s; const st = seedState(); this.s = st; this.system = true;
    // sample members and orders so every console has something to review
    const mk = (id: string, pid: string, name: string, no: string, st2: T.Member['status']): T.Member => ({ id, partnerId: pid, userId: id === 'm-siti' ? 'u-siti' : 'x-' + id, memberNo: no, name, phone: '0811', relation: 'member', status: st2, at: now() });
    st.members.push(mk('m-siti', 'p-idi', 'dr. Siti Rahma', 'IDI-0412', 'approved'), mk('m-ahmad', 'p-idi', 'dr. Ahmad Fauzi', 'IDI-0990', 'pending'), mk('m-lina', 'p-idi', 'dr. Lina Marlina', 'IDI-1180', 'approved'));
    const mkOrder = (m: string, dep: string, pax: number, method: 'transfer' | 'financing', code: string | null, finish?: 'payment_review' | 'paid') => {
      const o = this._place({ memberId: m, departureId: dep, pax, method, codeText: code, tenor: method === 'financing' ? 24 : undefined });
      if (finish === 'payment_review' || finish === 'paid') {
        const p = this._pay(o.id, o.total, 'full', 'bukti-transfer.jpg');
        if (finish === 'paid') this._verify(p.id, true);
      }
      return o;
    };
    mkOrder('m-lina', 'd-eco1', 2, 'transfer', 'IDI-2026', 'paid');
    mkOrder('m-lina', 'd-hrm1', 1, 'transfer', null, 'payment_review');
    mkOrder('m-siti', 'd-eco2', 1, 'financing', null);
    this.system = false; this.s = prev ?? st; return st;
  }
  reset() { this.s = this.fresh(); this.emit(); }
  get state() { this.expire(); return this.s; }

  // ---------- who am I ----------
  me(): T.User | null { return this.s.users.find((u) => u.id === this.userId) ?? null; }
  users() { return this.s.users; }
  signIn(id: string | null) { this.userId = id; try { id ? localStorage.setItem(SESSION, id) : localStorage.removeItem(SESSION); } catch { /* ignore */ } this.emit(false); }
  private need(...roles: T.Role[]) { const u = this.me(); if (!u || !roles.includes(u.role)) err('NOT_ALLOWED'); return u!; }
  private staff() { return this.need('maidaa_staff', 'platform_admin'); }
  private canAdmin(pid: string) { const u = this.me(); return !!u && (u.role === 'partner_admin' && u.partnerId === pid); }

  // ---------- inventory ----------
  private expire() {
    let n = 0; const t = Date.now();
    for (const o of this.s.orders) if ((o.status === 'held' || o.status === 'awaiting_payment') && o.holdExpires && Date.parse(o.holdExpires) <= t) { o.status = 'expired'; n++; }
    if (n) { this.log('expire_holds', String(n)); try { localStorage.setItem(KEY, JSON.stringify(this.s)); } catch { /* ignore */ } }
  }
  seatsTaken(depId: string) {
    const t = Date.now();
    return this.s.orders.filter((o) => o.departureId === depId && (SEAT_STATUSES.includes(o.status) || ((o.status === 'held' || o.status === 'awaiting_payment') && o.holdExpires && Date.parse(o.holdExpires) > t))).reduce((a, o) => a + o.pax, 0);
  }
  seatsLeft(depId: string) { const d = this.s.departures.find((x) => x.id === depId); return d ? Math.max(0, d.capacity - d.soldOutside - this.seatsTaken(depId)) : 0; }
  private live(pid: string, pkg: string) { return this.s.agreements.filter((a) => a.partnerId === pid && a.packageId === pkg && a.status === 'live').sort((a, b) => (b.liveFrom ?? '').localeCompare(a.liveFrom ?? ''))[0]; }
  private minPrice(pkg: string) { return Math.max(0, ...this.s.departures.filter((d) => d.packageId === pkg && d.status !== 'cancelled').map((d) => d.hpp)); }

  // ---------- public site ----------
  partnerBySlug(slug: string) { return this.s.partners.find((p) => p.slug === slug && p.active) ?? null; }
  partners() { return this.s.partners; }
  catalog(pid: string) {
    this.expire();
    const out: { depId: string | null; pkg: T.Pkg; date: string | null; left: number | null; price: number | null; availability: 'available' | 'sold_out' | 'coming_soon' }[] = [];
    for (const p of this.s.packages) {
      if (p.status === 'draft') continue;
      if (p.status === 'coming_soon') { out.push({ depId: null, pkg: p, date: null, left: null, price: null, availability: 'coming_soon' }); continue; }
      const ag = this.live(pid, p.id);
      for (const d of this.s.departures.filter((x) => x.packageId === p.id && x.status === 'open' && x.date >= now().slice(0, 10)).sort((a, b) => a.date.localeCompare(b.date))) {
        const left = this.seatsLeft(d.id);
        out.push({ depId: d.id, pkg: p, date: d.date, left, price: ag?.price ?? null, availability: !ag ? 'coming_soon' : left === 0 ? 'sold_out' : 'available' });
      }
    }
    return out;
  }
  validateCode(pid: string, text: string, phone?: string) {
    const c = this.s.codes.find((x) => x.code === text.trim().toUpperCase() && x.partnerId === pid && x.active);
    const p = this.s.partners.find((x) => x.id === pid);
    if (!c || !p?.allowCodes) return { ok: false as const, reason: 'invalid_here' };
    const self = !!c.ownerPhone && !!phone && digits(c.ownerPhone) === digits(phone);
    if (self && !c.allowSelf) return { ok: false as const, reason: 'self_not_allowed' };
    return { ok: true as const, code: c, self };
  }
  financingQuote(price: number, tenor: number) {
    const st = this.s.settings;
    return financing(price, tenor, { dpPct: st.dpPct, adminFee: st.adminFee, factor: { 12: st.factor['12'], 24: st.factor['24'], 36: st.factor['36'] }, insurance: { 12: st.ins['12'], 24: st.ins['24'], 36: st.ins['36'] } });
  }

  // ---------- members ----------
  myMember(pid: string) { const u = this.me(); return u ? this.s.members.find((m) => m.partnerId === pid && m.userId === u.id) ?? null : null; }
  requestMembership(pid: string, memberNo: string, name: string, phone: string, relation: 'member' | 'family' = 'member') {
    const u = this.need('buyer'); const p = this.s.partners.find((x) => x.id === pid && x.active); if (!p) err('UNKNOWN_PARTNER');
    let status: T.Member['status'] = 'pending';
    if (p!.eligibility === 'none') status = 'approved';
    else if (p!.eligibility === 'roster' && relation === 'member' && p!.roster.includes(memberNo)) status = 'approved';
    const ex = this.s.members.find((m) => m.partnerId === pid && m.userId === u.id);
    if (ex) { if (ex.status !== 'blocked') { Object.assign(ex, { memberNo, name, phone, relation, status }); } this.log('member_update', ex.name); this.emit(); return ex; }
    const m: T.Member = { id: uid('m-'), partnerId: pid, userId: u.id, memberNo, name, phone, relation, status, at: now() };
    this.s.members.push(m); this.log('member_request', name); this.emit(); return m;
  }
  members(pid: string) { if (!this.canAdmin(pid)) this.staff(); return this.s.members.filter((m) => m.partnerId === pid); }
  decideMember(id: string, approve: boolean, note?: string) {
    const m = this.s.members.find((x) => x.id === id); if (!m) return err('NOT_FOUND');
    const u = this.me(); if (!(this.canAdmin(m.partnerId) || u?.role === 'platform_admin')) err('NOT_ALLOWED');
    m.status = approve ? 'approved' : 'rejected'; m.note = note; this.log('member_decision', `${m.name}: ${m.status}`); this.emit();
  }

  // ---------- pricing ----------
  private rules(cls: string | null): TaxRule[] {
    const today = now().slice(0, 10);
    return this.s.tax.filter((t) => t.status === 'active' && t.from <= today && (!t.to || t.to >= today) && (!t.taxClass || t.taxClass === cls))
      .map((t) => ({ id: t.id, name: t.name, taxType: t.taxType, base: t.base, ratePct: t.ratePct, placeholder: t.placeholder }));
  }
  /** What the buyer may see before ordering: prices only, never margin or base price. */
  buyerQuote(pid: string, depId: string, pax: number, codeText: string, method: 'transfer' | 'card' | 'financing', phone?: string) {
    const dep = this.s.departures.find((d) => d.id === depId); if (!dep) return err('DEPARTURE_NOT_AVAILABLE');
    const ag = this.live(pid, dep.packageId); if (!ag) return err('PRICE_MISMATCH');
    let code: T.Code | null = null; let self = false;
    if (codeText.trim()) { const v = this.validateCode(pid, codeText, phone); if (v.ok) { code = v.code; self = v.self; } }
    const q = this.fullQuote(pid, dep, ag, pax, code, method, self);
    return { unit: ag.price, discountPerPax: q.discountPerPax, total: q.total, floorHit: q.floorHit, codeOk: codeText.trim() ? !!code : null, self, invalid: q.invalid, code };
  }
  private fullQuote(pid: string, dep: T.Departure, ag: T.Agreement, pax: number, code: T.Code | null, method: 'transfer' | 'card' | 'financing', self: boolean): Quote {
    const pk = this.s.packages.find((p) => p.id === dep.packageId)!; const st = this.s.settings;
    return quote({
      sellingPricePerPax: ag.price, hppPerPax: dep.hpp, pax, method, selfPurchase: self,
      discount: code ? { mode: code.mode, value: code.value } : null,
      commission: ag.mode === 'pct_of_net' ? { mode: 'pct_of_net', partnerPct: ag.pct } : { mode: 'fixed_per_pax', fixedPerPax: ag.fixed },
      fees: { transferFlat: st.transfer, cardPct: st.cardPct, financingPoolFlat: st.financingPool }, taxRules: this.rules(pk.taxClass),
    });
  }
  /** Staff only: what a proposed price would earn per person on the most expensive departure. */
  previewMargin(pkg: string, price: number, mode: 'pct_of_net' | 'fixed_per_pax', pct: number, fixed: number) {
    this.staff(); const pk = this.s.packages.find((p) => p.id === pkg); if (!pk) return null;
    const hpp = this.minPrice(pkg); if (!hpp || !price) return null; const st = this.s.settings;
    return quote({ sellingPricePerPax: price, hppPerPax: hpp, pax: 1, method: 'transfer', commission: mode === 'pct_of_net' ? { mode, partnerPct: pct } : { mode, fixedPerPax: fixed },
      fees: { transferFlat: st.transfer, cardPct: st.cardPct, financingPoolFlat: st.financingPool }, taxRules: this.rules(pk.taxClass) });
  }
  agreements(pid?: string) {
    if (pid && this.canAdmin(pid)) return this.s.agreements.filter((a) => a.partnerId === pid);
    this.staff(); return pid ? this.s.agreements.filter((a) => a.partnerId === pid) : this.s.agreements;
  }
  /** Lowest price allowed for a package. Partners get only a yes/no, never the number. */
  minPriceFor(pkg: string) { this.staff(); return this.minPrice(pkg); }
  proposeAgreement(pid: string, pkg: string, price: number, marketRef: number | null, mode: 'pct_of_net' | 'fixed_per_pax', pct: number, fixed: number) {
    const u = this.me(); const maidaa = u?.role === 'maidaa_staff' || u?.role === 'platform_admin';
    if (!maidaa && !this.canAdmin(pid)) err('NOT_ALLOWED');
    if (price < this.minPrice(pkg)) err('PRICE_BELOW_MINIMUM');
    this.s.agreements.filter((a) => a.partnerId === pid && a.packageId === pkg && a.status === 'proposed').forEach((a) => (a.status = 'superseded'));
    const a: T.Agreement = { id: uid('a'), partnerId: pid, packageId: pkg, price, marketRef, mode, pct, fixed, status: 'proposed', maidaaAt: maidaa ? now() : null, partnerAt: maidaa ? null : now(), liveFrom: null, createdAt: now() };
    this.s.agreements.unshift(a); this.log('agreement_proposed', `${pkg} ${price}`); this.emit(); return a;
  }
  confirmAgreement(id: string) {
    const a = this.s.agreements.find((x) => x.id === id); if (!a) return err('NOT_FOUND'); if (a.status !== 'proposed') err('NOT_PROPOSED');
    const u = this.me(); const maidaa = u?.role === 'maidaa_staff' || u?.role === 'platform_admin';
    if (maidaa) a.maidaaAt = now(); else if (this.canAdmin(a.partnerId)) a.partnerAt = now(); else err('NOT_ALLOWED');
    if (a.maidaaAt && a.partnerAt) {
      if (a.price < this.minPrice(a.packageId)) err('PRICE_BELOW_MINIMUM');
      this.s.agreements.filter((x) => x.partnerId === a.partnerId && x.packageId === a.packageId && x.status === 'live').forEach((x) => (x.status = 'superseded'));
      a.status = 'live'; a.liveFrom = now();
    }
    this.log('agreement_confirmed', `${a.packageId} ${a.status}`); this.emit(); return a.status;
  }
  rejectAgreement(id: string) {
    const a = this.s.agreements.find((x) => x.id === id); if (!a || a.status !== 'proposed') return err('NOT_PROPOSED');
    const u = this.me(); if (!(u?.role === 'maidaa_staff' || u?.role === 'platform_admin' || this.canAdmin(a.partnerId))) err('NOT_ALLOWED');
    a.status = 'rejected'; this.log('agreement_rejected', a.id); this.emit();
  }

  // ---------- orders ----------
  /** Single entry for creating orders; mirrors create_order_record(). */
  placeOrder(a: { partnerId: string; departureId: string; pax: number; method: 'transfer' | 'card' | 'financing'; codeText: string; tenor?: number }) {
    const u = this.need('buyer');
    const m = this.s.members.find((x) => x.partnerId === a.partnerId && x.userId === u.id);
    if (!m || m.status !== 'approved') err('MEMBER_NOT_ELIGIBLE');
    return this._place({ memberId: m!.id, departureId: a.departureId, pax: a.pax, method: a.method, codeText: a.codeText, tenor: a.tenor });
  }
  private _place(a: { memberId: string; departureId: string; pax: number; method: 'transfer' | 'card' | 'financing'; codeText: string | null; tenor?: number }): T.Order {
    const m = this.s.members.find((x) => x.id === a.memberId)!;
    const dep = this.s.departures.find((d) => d.id === a.departureId);
    if (!dep || dep.status !== 'open') return err('DEPARTURE_NOT_AVAILABLE');
    const pk = this.s.packages.find((p) => p.id === dep.packageId)!; if (pk.status !== 'published') err('DEPARTURE_NOT_AVAILABLE');
    if (a.pax < 1 || a.pax > 20) err('PAX_INVALID');
    if (this.seatsLeft(dep.id) < a.pax) err('SEATS_UNAVAILABLE');
    const ag = this.live(m.partnerId, dep.packageId); if (!ag) return err('PRICE_MISMATCH');
    let code: T.Code | null = null; let self = false;
    if (a.codeText && a.codeText.trim()) { const v = this.validateCode(m.partnerId, a.codeText, m.phone); if (!v.ok) err('CODE_NOT_VALID_HERE'); else { code = v.code; self = v.self; } }
    const q = this.fullQuote(m.partnerId, dep, ag, a.pax, code, a.method, self);
    if (q.invalid) err('BELOW_COST');
    const hours = this.s.settings.holdHours; const fin = a.method === 'financing';
    if (fin && !a.tenor) err('FINANCING_DETAILS_REQUIRED');
    const o: T.Order = {
      id: uid('o'), code: 'M-' + this.s.seq++, partnerId: m.partnerId, memberId: m.id, buyerId: m.userId, departureId: dep.id, packageId: dep.packageId, pax: a.pax,
      method: a.method, status: fin ? 'financing_review' : 'awaiting_payment', holdExpires: fin ? null : new Date(Date.now() + hours * 36e5).toISOString(),
      codeId: code?.id ?? null, unit: ag.price, discountPerPax: q.discountPerPax, total: q.total, createdAt: now(), tenor: a.tenor,
      money: { hppTotal: q.hppTotal, fee: q.fee, gross: q.gross, taxTotal: q.taxTotal, net: q.net, partnerShare: q.partnerShare, platformShare: q.platformShare, partnerPayout: q.partnerPayout, placeholder: q.hasPlaceholderTax, taxLines: [...q.taxLines, ...q.withholdingLines].map((l) => ({ name: l.name, amount: l.amount })) },
    };
    this.s.orders.unshift(o);
    if (fin) { const fq = this.financingQuote(q.total, a.tenor!); this.s.fin.unshift({ id: uid('f'), orderId: o.id, financierId: 'f-amitra', tenor: a.tenor!, quote: { instalment: fq.instalment, dp: fq.dp, firstPayment: fq.firstPayment, totalCost: fq.totalCost, extra: fq.extra }, status: 'submitted', at: now() }); }
    this.log('order_created', `${o.code} ${o.total}`); this.emit(); return o;
  }
  myOrders(pid?: string) { const u = this.need('buyer'); this.expire(); return this.s.orders.filter((o) => o.buyerId === u.id && (!pid || o.partnerId === pid)); }
  /** Order as the buyer sees it: no cost, no margin. */
  buyerOrder(id: string) { const o = this.myOrders().find((x) => x.id === id); if (!o) return null; const { money: _m, ...rest } = o; void _m; return { ...rest, paid: this.s.payments.filter((p) => p.orderId === id && p.status === 'verified').reduce((a, p) => a + p.amount, 0), payments: this.s.payments.filter((p) => p.orderId === id), fin: this.s.fin.find((f) => f.orderId === id) ?? null }; }
  submitPayment(orderId: string, amount: number, kind: 'dp' | 'balance' | 'full', proof: string) {
    const u = this.need('buyer'); const o = this.s.orders.find((x) => x.id === orderId);
    if (!o || o.buyerId !== u.id) return err('NOT_ALLOWED');
    return this._pay(orderId, amount, kind, proof);
  }
  private _pay(orderId: string, amount: number, kind: 'dp' | 'balance' | 'full', proof: string) {
    const o = this.s.orders.find((x) => x.id === orderId)!;
    if (o.method === 'financing' || !['awaiting_payment', 'payment_review'].includes(o.status)) err('ORDER_NOT_PAYABLE');
    const sum = (st: string) => this.s.payments.filter((p) => p.orderId === orderId && p.status === st).reduce((a, p) => a + p.amount, 0);
    if (amount <= 0 || amount > o.total - sum('verified') - sum('pending')) err('AMOUNT_INVALID');
    const p: T.Payment = { id: uid('pay'), orderId, amount, kind, proof, status: 'pending', at: now() };
    this.s.payments.unshift(p); o.status = 'payment_review'; this.log('payment_submitted', `${o.code} ${amount}`); this.emit(); return p;
  }
  verifyPayment(id: string, ok: boolean, note?: string) { this.staff(); return this._verify(id, ok, note); }
  private _verify(id: string, ok: boolean, note?: string) {
    const p = this.s.payments.find((x) => x.id === id); if (!p || p.status !== 'pending') return err('NOT_PENDING');
    const o = this.s.orders.find((x) => x.id === p.orderId)!;
    p.status = ok ? 'verified' : 'rejected'; p.note = note;
    const paid = this.s.payments.filter((x) => x.orderId === o.id && x.status === 'verified').reduce((a, x) => a + x.amount, 0);
    if (ok && paid >= o.total) { o.status = 'paid'; o.holdExpires = null; this.settle(o); }
    else if (!this.s.payments.some((x) => x.orderId === o.id && x.status === 'pending')) { o.status = 'awaiting_payment'; o.holdExpires = new Date(Date.now() + this.s.settings.holdHours * 36e5).toISOString(); }
    this.log('payment_verified', `${o.code} ${p.status}`); this.emit(); return o.status;
  }
  /** Once Maidaa holds the full payment, the split is recorded for Maidaa to distribute. */
  private settle(o: T.Order) {
    if (this.s.ledger.some((l) => l.orderId === o.id)) return;
    this.s.ledger.unshift({ id: uid('l'), orderId: o.id, party: 'partner', partnerId: o.partnerId, amount: o.money.partnerPayout, status: 'pending', at: now() },
      { id: uid('l'), orderId: o.id, party: 'platform', amount: o.money.platformShare, status: 'pending', at: now() });
  }
  advanceOrder(id: string, to: T.OrderStatus) {
    this.staff(); const o = this.s.orders.find((x) => x.id === id); if (!o) return err('NOT_FOUND');
    const ok = [['paid', 'fulfilling'], ['fulfilling', 'ready'], ['held', 'cancelled'], ['awaiting_payment', 'cancelled'], ['payment_review', 'cancelled'], ['financing_review', 'cancelled'], ['paid', 'cancelled'], ['fulfilling', 'cancelled']];
    if (!ok.some(([f, t]) => f === o.status && t === to)) err('INVALID_TRANSITION');
    o.status = to; this.log('order_status', `${o.code} → ${to}`); this.emit();
  }
  cancelOwn(id: string) { const u = this.need('buyer'); const o = this.s.orders.find((x) => x.id === id); if (!o || o.buyerId !== u.id) return err('NOT_ALLOWED'); if (!['held', 'awaiting_payment'].includes(o.status)) err('INVALID_TRANSITION'); o.status = 'cancelled'; this.log('order_cancelled', o.code); this.emit(); }
  payLedger(id: string) { this.staff(); const l = this.s.ledger.find((x) => x.id === id); if (!l) return err('NOT_FOUND'); l.status = 'paid'; this.log('ledger_paid', `${l.party} ${l.amount}`); this.emit(); }

  // ---------- views per role ----------
  /** Partner view: own orders with commission only. No base price, margin or platform share. */
  commissions(pid: string) {
    if (!this.canAdmin(pid)) this.staff(); this.expire();
    return this.s.orders.filter((o) => o.partnerId === pid).map((o) => ({
      id: o.id, code: o.code, status: o.status, pax: o.pax, total: o.total, commission: o.money.partnerPayout, placeholder: o.money.placeholder,
      buyer: this.s.members.find((m) => m.id === o.memberId)?.name ?? '', date: this.s.departures.find((d) => d.id === o.departureId)?.date ?? '',
      pkg: this.s.packages.find((p) => p.id === o.packageId)?.name ?? '', paidOut: this.s.ledger.some((l) => l.orderId === o.id && l.party === 'partner' && l.status === 'paid'),
    }));
  }
  partnerLedger(pid: string) { if (!this.canAdmin(pid)) this.staff(); return this.s.ledger.filter((l) => l.party === 'partner' && l.partnerId === pid); }
  codes(pid: string) { if (!this.canAdmin(pid)) this.staff(); return this.s.codes.filter((c) => c.partnerId === pid); }
  saveCode(pid: string, c: Omit<T.Code, 'id' | 'partnerId'> & { id?: string }) {
    if (!this.canAdmin(pid)) this.staff();
    const code = c.code.trim().toUpperCase(); if (!code) err('CODE_REQUIRED');
    if (this.s.codes.some((x) => x.code === code && x.id !== c.id)) err('CODE_EXISTS');
    const ex = this.s.codes.find((x) => x.id === c.id);
    if (ex) Object.assign(ex, c, { code }); else this.s.codes.push({ ...c, code, id: uid('c'), partnerId: pid });
    this.log('code_saved', code); this.emit();
  }
  setEligibility(pid: string, mode: T.Partner['eligibility'], roster?: string[]) {
    if (!this.canAdmin(pid)) this.need('platform_admin');
    const p = this.s.partners.find((x) => x.id === pid)!; p.eligibility = mode; if (roster) p.roster = roster; this.log('eligibility', `${p.name}: ${mode}`); this.emit();
  }
  /** Maidaa console: every order with the full money picture. */
  pipeline() { this.staff(); this.expire(); return this.s.orders.map((o) => ({ ...o, partnerName: this.s.partners.find((p) => p.id === o.partnerId)?.name ?? '', buyer: this.s.members.find((m) => m.id === o.memberId)?.name ?? '', pkgName: this.s.packages.find((p) => p.id === o.packageId)?.name ?? '', date: this.s.departures.find((d) => d.id === o.departureId)?.date ?? '' })); }
  paymentsAll() { this.staff(); return this.s.payments.map((p) => ({ ...p, order: this.s.orders.find((o) => o.id === p.orderId)! })); }
  ledgerAll() { this.staff(); return this.s.ledger.map((l) => ({ ...l, order: this.s.orders.find((o) => o.id === l.orderId)!, partnerName: this.s.partners.find((p) => p.id === l.partnerId)?.name ?? 'Platform' })); }
  departuresAll() { this.staff(); this.expire(); return this.s.departures.map((d) => ({ ...d, pkg: this.s.packages.find((p) => p.id === d.packageId)!, taken: this.seatsTaken(d.id), left: this.seatsLeft(d.id) })); }
  saveDeparture(id: string, patch: Partial<Pick<T.Departure, 'capacity' | 'soldOutside' | 'status' | 'hpp'>>) {
    this.staff(); const d = this.s.departures.find((x) => x.id === id); if (!d) return err('NOT_FOUND');
    const next = { ...d, ...patch };
    if (next.capacity < 1 || next.soldOutside < 0 || next.hpp < 0) err('INVALID');
    if (next.capacity - next.soldOutside < this.seatsTaken(id)) err('BELOW_SEATS_SOLD');
    Object.assign(d, patch); this.log('departure_saved', `${id} ${JSON.stringify(patch)}`); this.emit();
  }
  addDeparture(packageId: string, date: string, capacity: number, hpp: number) {
    this.staff(); if (!date || capacity < 1 || hpp < 0) err('INVALID');
    this.s.departures.push({ id: uid('d'), packageId, date, capacity, soldOutside: 0, status: 'open', hpp }); this.log('departure_added', `${packageId} ${date}`); this.emit();
  }
  packages() { return this.s.packages; }
  finApps() {
    const u = this.need('financier_analyst', 'maidaa_staff', 'platform_admin'); this.expire();
    return this.s.fin.filter((f) => u.role !== 'financier_analyst' || f.financierId === u.financierId).map((f) => {
      const o = this.s.orders.find((x) => x.id === f.orderId)!; const m = this.s.members.find((x) => x.id === o.memberId)!;
      return { ...f, code: o.code, total: o.total, pax: o.pax, buyer: m.name, phone: m.phone, memberNo: m.memberNo, partner: this.s.partners.find((p) => p.id === o.partnerId)?.name ?? '', pkg: this.s.packages.find((p) => p.id === o.packageId)?.name ?? '', date: this.s.departures.find((d) => d.id === o.departureId)?.date ?? '' };
    });
  }
  decideFinancing(id: string, status: T.FinApp['status'], reason?: string) {
    const u = this.need('financier_analyst', 'maidaa_staff', 'platform_admin'); const f = this.s.fin.find((x) => x.id === id); if (!f) return err('NOT_FOUND');
    if (u.role === 'financier_analyst' && u.financierId !== f.financierId) err('NOT_ALLOWED');
    if (['docs_requested', 'rejected'].includes(status) && !(reason || '').trim()) err('REASON_REQUIRED');
    const okT = [['submitted', 'docs_requested'], ['submitted', 'approved'], ['submitted', 'rejected'], ['docs_requested', 'approved'], ['docs_requested', 'rejected'], ['approved', 'disbursed']];
    if (!okT.some(([a, b]) => a === f.status && b === status)) err('INVALID_TRANSITION');
    f.status = status; f.reason = reason;
    const o = this.s.orders.find((x) => x.id === f.orderId)!;
    if (status === 'disbursed') { o.status = 'paid'; this.settle(o); } else if (status === 'rejected') o.status = 'cancelled';
    this.log('financing_decision', `${o.code} ${status}`); this.emit();
  }
  // platform
  taxRules() { this.need('platform_admin', 'maidaa_staff'); return this.s.tax; }
  saveTax(r: Omit<T.TaxRuleRow, 'id'> & { id?: string }) {
    this.need('platform_admin'); if (r.ratePct < 0 || !r.name.trim() || !r.from) err('INVALID');
    const ex = this.s.tax.find((x) => x.id === r.id);
    if (ex) Object.assign(ex, r); else this.s.tax.push({ ...r, id: uid('t') });
    this.log('tax_saved', r.name); this.emit();
  }
  settings() { this.need('platform_admin', 'maidaa_staff'); return this.s.settings; }
  saveSettings(p: Partial<T.Settings>) { this.need('platform_admin'); Object.assign(this.s.settings, p); this.log('settings_saved', Object.keys(p).join(',')); this.emit(); }
  addPartner(name: string, slug: string, kind: T.Partner['kind']) {
    this.need('platform_admin'); if (!name.trim() || !/^[a-z0-9-]+$/.test(slug)) err('INVALID'); if (this.s.partners.some((p) => p.slug === slug)) err('SLUG_EXISTS');
    this.s.partners.push({ id: uid('p-'), slug, name: name.trim(), kind, eligibility: 'manual', allowCodes: true, active: true, color: '#1d4e89', roster: [] }); this.log('partner_added', name); this.emit();
  }
  setPartnerActive(id: string, active: boolean) { this.need('platform_admin'); const p = this.s.partners.find((x) => x.id === id); if (p) { p.active = active; this.log('partner_active', `${p.name} ${active}`); this.emit(); } }
  auditLog() { this.need('platform_admin'); return this.s.audit; }
  openTicket(kind: 'support' | 'emergency', body: string, orderId: string | null, partnerId: string | null) { const u = this.need('buyer'); if (!body.trim()) err('INVALID'); this.s.tickets.unshift({ id: uid('t'), orderId, partnerId, by: u.name, kind, body, status: 'open', at: now() }); this.log('ticket', kind); this.emit(); }
  tickets() { this.staff(); return this.s.tickets; }
  closeTicket(id: string) { this.staff(); const t = this.s.tickets.find((x) => x.id === id); if (t) { t.status = 'done'; this.emit(); } }
}

export const api = new Api();
