export type Role = 'buyer' | 'partner_admin' | 'maidaa_staff' | 'financier_analyst' | 'platform_admin';
export interface User { id: string; name: string; role: Role; partnerId?: string; financierId?: string; phone?: string }
export interface Partner { id: string; slug: string; name: string; kind: 'organization' | 'individual'; eligibility: 'manual' | 'roster' | 'none'; allowCodes: boolean; active: boolean; color: string; roster: string[] }
export interface Pkg { id: string; code: string; name: string; category: 'umrah' | 'holyland' | 'haji'; cls: string; days: number; summaryId: string; summaryEn: string; includes: string[]; taxClass: string | null; status: 'draft' | 'published' | 'coming_soon' }
export interface Departure { id: string; packageId: string; date: string; capacity: number; soldOutside: number; status: 'open' | 'closed' | 'cancelled'; hpp: number }
export interface Agreement { id: string; partnerId: string; packageId: string; price: number; marketRef: number | null; mode: 'pct_of_net' | 'fixed_per_pax'; pct: number; fixed: number; status: 'proposed' | 'live' | 'superseded' | 'rejected'; maidaaAt: string | null; partnerAt: string | null; liveFrom: string | null; createdAt: string }
export interface Code { id: string; partnerId: string; code: string; mode: 'idr' | 'pct'; value: number; ownerPhone: string | null; allowSelf: boolean; active: boolean }
export interface Member { id: string; partnerId: string; userId: string; memberNo: string; name: string; phone: string; relation: 'member' | 'family'; status: 'pending' | 'approved' | 'rejected' | 'blocked'; note?: string; at: string }
export type OrderStatus = 'held' | 'awaiting_payment' | 'payment_review' | 'financing_review' | 'paid' | 'fulfilling' | 'ready' | 'cancelled' | 'expired';
export interface Money { hppTotal: number; fee: number; gross: number; taxTotal: number; net: number; partnerShare: number; platformShare: number; partnerPayout: number; placeholder: boolean; taxLines: { name: string; amount: number }[] }
export interface Order { id: string; code: string; partnerId: string; memberId: string; buyerId: string; departureId: string; packageId: string; pax: number; method: 'transfer' | 'card' | 'financing'; status: OrderStatus; holdExpires: string | null; codeId: string | null; unit: number; discountPerPax: number; total: number; createdAt: string; money: Money; tenor?: number }
export interface Payment { id: string; orderId: string; amount: number; kind: 'dp' | 'balance' | 'full'; proof: string; status: 'pending' | 'verified' | 'rejected'; at: string; note?: string }
export interface FinApp { id: string; orderId: string; financierId: string; tenor: number; quote: { instalment: number; dp: number; firstPayment: number; totalCost: number; extra: number }; status: 'submitted' | 'docs_requested' | 'approved' | 'rejected' | 'disbursed'; reason?: string; at: string }
export interface TaxRuleRow { id: string; name: string; taxType: string; taxClass: string | null; base: 'billed_amount' | 'margin' | 'commission'; ratePct: number; from: string; to: string | null; status: 'draft' | 'active' | 'retired'; placeholder: boolean; note: string }
export interface Settings { transfer: number; cardPct: number; financingPool: number; holdHours: number; dpPct: number; adminFee: number; factor: Record<string, number>; ins: Record<string, number> }
export interface LedgerRow { id: string; orderId: string; party: 'partner' | 'platform'; partnerId?: string; amount: number; status: 'pending' | 'paid'; at: string }
export interface AuditRow { id: string; at: string; actor: string; action: string; detail: string }
export interface Ticket { id: string; orderId: string | null; partnerId: string | null; by: string; kind: 'support' | 'emergency'; body: string; status: 'open' | 'done'; at: string }
export interface State {
  users: User[]; partners: Partner[]; packages: Pkg[]; departures: Departure[]; agreements: Agreement[]; codes: Code[]; members: Member[];
  orders: Order[]; payments: Payment[]; fin: FinApp[]; tax: TaxRuleRow[]; settings: Settings; ledger: LedgerRow[]; audit: AuditRow[]; tickets: Ticket[]; seq: number;
}
