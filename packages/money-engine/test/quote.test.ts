import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quote, financing } from '../src/index.ts';
import type { FeeSettings, TaxRule, QuoteInput } from '../src/index.ts';

const fees: FeeSettings = { transferFlat: 25000, cardPct: 2, financingPoolFlat: 500000 };
/** Placeholder rules that reproduce the prototype: PPN 11% + second tax 2.5% on gross margin. */
const placeholderTax: TaxRule[] = [
  { id: 'ppn-ph', name: 'PPN (placeholder)', taxType: 'PPN', base: 'margin', ratePct: 11, placeholder: true },
  { id: 'pph-ph', name: 'PPh (placeholder)', taxType: 'PPh', base: 'margin', ratePct: 2.5, placeholder: true },
];
const base = (o: Partial<QuoteInput> = {}): QuoteInput => ({
  sellingPricePerPax: 28_900_000, hppPerPax: 26_200_000, pax: 1, method: 'transfer',
  commission: { mode: 'pct_of_net', partnerPct: 60 }, fees, taxRules: placeholderTax, ...o,
});

test('agreed worked example: Economy at IDI price 28.9M, transfer, no code', () => {
  const q = quote(base());
  assert.equal(q.total, 28_900_000);
  assert.equal(q.hppTotal, 26_200_000);
  assert.equal(q.gross, 2_700_000);
  assert.equal(q.fee, 25_000);
  assert.equal(q.taxTotal, 364_500);
  assert.equal(q.net, 2_310_500);
  assert.equal(q.partnerShare, 1_386_300);
  assert.equal(q.platformShare, 924_200);
  assert.equal(q.partnerShare + q.platformShare, q.net);
  assert.equal(q.hasPlaceholderTax, true);
  assert.equal(q.invalid, false);
});

test('agreed worked example: with a Rp 500,000 discount code the margin shrinks', () => {
  const q = quote(base({ discount: { mode: 'idr', value: 500_000 } }));
  assert.equal(q.payPerPax, 28_400_000);
  assert.equal(q.gross, 2_200_000);
  assert.equal(q.taxTotal, 297_000);
  assert.equal(q.net, 1_878_000);
  assert.equal(q.partnerShare, 1_126_800);
  assert.equal(q.platformShare, 751_200);
});

test('discount can never push the price below the base price', () => {
  const q = quote(base({ discount: { mode: 'idr', value: 5_000_000 } }));
  assert.equal(q.floorHit, true);
  assert.equal(q.discountPerPax, 2_700_000);
  assert.equal(q.payPerPax, 26_200_000);
  assert.equal(q.gross, 0);
  assert.equal(q.partnerShare, 0); // nothing to share
  assert.equal(q.invalid, true); // fee makes net negative, order must not be accepted
});

test('percentage discount is taken from the selling price', () => {
  const q = quote(base({ discount: { mode: 'pct', value: 1 } }));
  assert.equal(q.discountPerPax, 289_000);
});

test('selling price below base price is invalid', () => {
  const q = quote(base({ sellingPricePerPax: 26_000_000 }));
  assert.equal(q.invalid, true);
});

test('fixed commission per person, capped to the net margin available', () => {
  const ok = quote(base({ pax: 2, commission: { mode: 'fixed_per_pax', fixedPerPax: 1_000_000 } }));
  assert.equal(ok.partnerShare, 2_000_000);
  assert.equal(ok.commissionCapped, false);
  const capped = quote(base({ pax: 1, commission: { mode: 'fixed_per_pax', fixedPerPax: 5_000_000 } }));
  assert.equal(capped.partnerShare, capped.net);
  assert.equal(capped.platformShare, 0);
  assert.equal(capped.commissionCapped, true);
});

test('buying with your own code: discount applies, no commission', () => {
  const q = quote(base({ selfPurchase: true, discount: { mode: 'idr', value: 500_000 } }));
  assert.equal(q.partnerShare, 0);
  assert.equal(q.platformShare, q.net);
});

test('payment fee depends on method', () => {
  assert.equal(quote(base({ method: 'transfer' })).fee, 25_000);
  assert.equal(quote(base({ method: 'card' })).fee, 578_000); // 2% of 28.9M
  assert.equal(quote(base({ method: 'financing' })).fee, 500_000);
});

test('add-on (health service) is sold and costed per person', () => {
  const q = quote(base({ pax: 2, addOnPerPax: { price: 350_000, hpp: 300_000 } }));
  assert.equal(q.total, (28_900_000 + 350_000) * 2);
  assert.equal(q.hppTotal, (26_200_000 + 300_000) * 2);
  assert.equal(q.gross, 2 * (2_700_000 + 50_000));
});

test('tax rules are data: a pure-umrah package with no PPN rule carries no PPN', () => {
  const q = quote(base({ taxRules: [] }));
  assert.equal(q.taxTotal, 0);
  assert.equal(q.net, 2_700_000 - 25_000);
  assert.equal(q.hasPlaceholderTax, false);
});

test('tax on the billed amount (not the margin) is supported, e.g. 1.1% effective on mixed packages', () => {
  const rule: TaxRule = { id: 'x', name: 'PPN effective', taxType: 'PPN', base: 'billed_amount', ratePct: 1.1, placeholder: false };
  const q = quote(base({ taxRules: [rule] }));
  assert.equal(q.taxLines[0].amount, 317_900); // 1.1% of 28.9M
  assert.equal(q.hasPlaceholderTax, false);
});

test('tax on the partner commission is withheld from the partner only, not from the pool', () => {
  const rule: TaxRule = { id: 'w', name: 'Withholding on commission', taxType: 'PPh', base: 'commission', ratePct: 2, placeholder: true };
  const q = quote(base({ taxRules: [rule] }));
  assert.equal(q.taxTotal, 0);
  assert.equal(q.net, 2_700_000 - 25_000);
  assert.equal(q.partnerShare, Math.round(((2_700_000 - 25_000) * 60) / 100));
  assert.equal(q.partnerPayout, q.partnerShare - Math.round((q.partnerShare * 2) / 100));
  assert.equal(q.hasPlaceholderTax, true);
});

test('shares always add up to the net margin exactly (no rounding drift)', () => {
  for (const price of [28_912_345, 29_999_999, 27_000_001]) {
    for (const pct of [33, 55, 60, 66.6]) {
      const q = quote(base({ sellingPricePerPax: price, commission: { mode: 'pct_of_net', partnerPct: pct }, pax: 3 }));
      assert.equal(q.partnerShare + q.platformShare, q.net);
      assert.ok(Number.isInteger(q.net) && Number.isInteger(q.partnerShare));
    }
  }
});

const amitra = { dpPct: 12.5, adminFee: 1_000_000, factor: { 12: 0.1005, 24: 0.05906, 36: 0.04583 }, insurance: { 12: 4.0333, 24: 8.1, 36: 13.3 } };
test('financing maths matches the prototype figures', () => {
  assert.deepEqual(financing(58_000_000, 12, amitra), { tenor: 12, dp: 7_250_000, admin: 1_000_000, insurance: 233_931, firstPayment: 8_483_931, instalment: 5_100_375, totalCost: 69_688_431, extra: 11_688_431 });
  assert.deepEqual(financing(58_000_000, 24, amitra), { tenor: 24, dp: 7_250_000, admin: 1_000_000, insurance: 469_800, firstPayment: 8_719_800, instalment: 2_997_295, totalCost: 80_654_880, extra: 22_654_880 });
  assert.equal(financing(58_000_000, 36, amitra).totalCost, 92_752_828);
  assert.equal(financing(29_500_000, 24, amitra).instalment, 1_524_486);
  assert.throws(() => financing(1, 18, amitra));
});
