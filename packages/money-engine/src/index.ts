import type { FinancingParams, FinancingQuote, Quote, QuoteInput, TaxLine } from './types.ts';
export type * from './types.ts';

const r = (n: number): number => Math.round(n);

/**
 * One calculation used by every screen and by the server.
 * Order of operations (agreed in the blueprint):
 *   selling price - discount (never below base price) = price paid
 *   gross margin = price paid - base price
 *   net margin   = gross - payment fee - taxes borne by the pool
 *   net margin is split platform / partner
 *   taxes on the partner's commission are withheld from the partner's share only
 */
export function quote(i: QuoteInput): Quote {
  const pax = Math.max(1, Math.floor(i.pax || 1));
  const list = i.sellingPricePerPax;
  const rawDisc = i.discount ? (i.discount.mode === 'idr' ? i.discount.value : (list * i.discount.value) / 100) : 0;
  const maxDisc = Math.max(0, list - i.hppPerPax);
  const disc = r(Math.max(0, Math.min(rawDisc, maxDisc)));
  const payPer = list - disc;
  const addPrice = i.addOnPerPax?.price ?? 0;
  const addHpp = i.addOnPerPax?.hpp ?? 0;
  const total = (payPer + addPrice) * pax;
  const hppTotal = (i.hppPerPax + addHpp) * pax;

  const fee = r(i.method === 'card' ? (total * i.fees.cardPct) / 100 : i.method === 'financing' ? i.fees.financingPoolFlat : i.fees.transferFlat);
  const gross = total - hppTotal;

  const taxLines: TaxLine[] = [];
  const withholdingLines: TaxLine[] = [];
  for (const t of i.taxRules) {
    if (t.base === 'commission') continue;
    const base = t.base === 'billed_amount' ? total : Math.max(0, gross);
    taxLines.push({ ruleId: t.id, name: t.name, taxType: t.taxType, base: t.base, amount: r((base * t.ratePct) / 100), placeholder: t.placeholder });
  }
  const taxTotal = taxLines.reduce((s, l) => s + l.amount, 0);
  const net = gross - fee - taxTotal;

  const rawShare = i.selfPurchase
    ? 0
    : i.commission.mode === 'pct_of_net'
      ? (net * i.commission.partnerPct) / 100
      : i.commission.fixedPerPax * pax;
  const available = Math.max(net, 0);
  const partnerShare = r(Math.max(0, Math.min(rawShare, available)));
  const commissionCapped = !i.selfPurchase && r(rawShare) > partnerShare && net > 0;
  const platformShare = net - partnerShare;

  for (const t of i.taxRules) {
    if (t.base !== 'commission') continue;
    withholdingLines.push({ ruleId: t.id, name: t.name, taxType: t.taxType, base: t.base, amount: r((partnerShare * t.ratePct) / 100), placeholder: t.placeholder });
  }
  const withheld = withholdingLines.reduce((s, l) => s + l.amount, 0);

  return {
    pax, method: i.method, listPerPax: list, discountPerPax: disc, floorHit: rawDisc > maxDisc, payPerPax: payPer,
    total, hppTotal, fee, gross, taxLines, taxTotal, net, partnerShare, platformShare, commissionCapped,
    withholdingLines, partnerPayout: partnerShare - withheld,
    hasPlaceholderTax: [...taxLines, ...withholdingLines].some((l) => l.placeholder),
    invalid: total < hppTotal || net < 0,
  };
}

/** Financing (Amitra) instalment maths. Parameters are settings, not constants. */
export function financing(price: number, tenor: number, p: FinancingParams): FinancingQuote {
  const factor = p.factor[tenor];
  const ins = p.insurance[tenor];
  if (factor == null || ins == null) throw new Error(`Unsupported tenor: ${tenor}`);
  const dp = r((price * p.dpPct) / 100);
  const instalment = r((price - dp) * factor);
  const insurance = r(ins * 1000 * (price / 1e6));
  const firstPayment = dp + p.adminFee + insurance;
  const totalCost = firstPayment + instalment * tenor;
  return { tenor, dp, admin: p.adminFee, insurance, firstPayment, instalment, totalCost, extra: totalCost - price };
}
