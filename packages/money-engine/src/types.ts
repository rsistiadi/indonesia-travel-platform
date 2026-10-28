/** All money is whole rupiah (integers). Rates are percentages (11 means 11%). */

export type Method = 'transfer' | 'card' | 'financing';
export type TaxBase = 'billed_amount' | 'margin' | 'commission';

/** One tax rule, already filtered to the ones active for this product category and date.
 *  Rules are DATA (table `tax_rules`), never hard-coded, so a change by the government is a new row. */
export interface TaxRule {
  id: string;
  name: string;
  taxType: string; // e.g. 'PPN', 'PPh'
  base: TaxBase;
  ratePct: number;
  /** true while the rate is a stand-in that nobody has confirmed. Shown in the UI. */
  placeholder: boolean;
}

export interface FeeSettings {
  transferFlat: number;
  cardPct: number;
  financingPoolFlat: number;
}

export type Discount = { mode: 'idr' | 'pct'; value: number } | null;

export type Commission =
  | { mode: 'pct_of_net'; partnerPct: number }
  | { mode: 'fixed_per_pax'; fixedPerPax: number };

export interface QuoteInput {
  /** Agreed selling price per person (from the live price agreement). */
  sellingPricePerPax: number;
  /** Maidaa base price per person (HPP). Never exposed to partners or buyers. */
  hppPerPax: number;
  pax: number;
  method: Method;
  /** Optional add-ons such as the health service, with their own cost. */
  addOnPerPax?: { price: number; hpp: number };
  discount?: Discount;
  /** Buyer used their own referral code: discount applies, commission does not. */
  selfPurchase?: boolean;
  commission: Commission;
  fees: FeeSettings;
  taxRules: TaxRule[];
}

export interface TaxLine { ruleId: string; name: string; taxType: string; base: TaxBase; amount: number; placeholder: boolean }

export interface Quote {
  pax: number;
  method: Method;
  listPerPax: number;
  discountPerPax: number;
  /** The discount was reduced so the price does not fall below the base price. */
  floorHit: boolean;
  payPerPax: number;
  total: number;
  hppTotal: number;
  fee: number;
  gross: number;
  /** Taxes borne by the margin pool before the split. */
  taxLines: TaxLine[];
  taxTotal: number;
  net: number;
  partnerShare: number;
  platformShare: number;
  /** The partner share was reduced to the net margin that was actually available. */
  commissionCapped: boolean;
  /** Withholding taxes on the partner's commission (base = 'commission'). Not part of the pool. */
  withholdingLines: TaxLine[];
  partnerPayout: number;
  /** True when any applied tax rule is still a placeholder. */
  hasPlaceholderTax: boolean;
  /** Price below cost, or negative net margin. The order must not be accepted. */
  invalid: boolean;
}

export interface FinancingParams {
  dpPct: number;
  adminFee: number;
  /** monthly factor by tenor in months, applied to (price - dp) */
  factor: Record<number, number>;
  /** insurance per Rp 1 million of price, in thousands of rupiah, by tenor */
  insurance: Record<number, number>;
}

export interface FinancingQuote {
  tenor: number;
  dp: number;
  admin: number;
  insurance: number;
  firstPayment: number;
  instalment: number;
  totalCost: number;
  /** Extra cost compared with paying cash. Always shown to the buyer. */
  extra: number;
}
