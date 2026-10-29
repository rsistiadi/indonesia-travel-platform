import type { State } from './types.ts';
const d = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const now = () => new Date().toISOString();

export function seedState(): State {
  const s: State = {
    seq: 1050,
    users: [
      { id: 'u-siti', name: 'dr. Siti Rahma', role: 'buyer', phone: '0811 2233 4455' },
      { id: 'u-idi', name: 'Admin Primkop IDI', role: 'partner_admin', partnerId: 'p-idi' },
      { id: 'u-maidaa', name: 'Tim Maidaa', role: 'maidaa_staff' },
      { id: 'u-amitra', name: 'Analis Amitra', role: 'financier_analyst', financierId: 'f-amitra' },
      { id: 'u-platform', name: 'Admin Platform', role: 'platform_admin' },
    ],
    partners: [
      { id: 'p-idi', slug: 'idi', name: 'Primkop IDI', kind: 'organization', eligibility: 'manual', allowCodes: true, active: true, color: '#CC1B1B', roster: [] },
    ],
    packages: [
      { id: 'k-eco', code: 'ECO', name: 'Umrah Hemat 9 Hari', category: 'umrah', cls: 'economy', days: 9, summaryId: 'Umrah 9 hari, hotel bintang 4 dekat Masjidil Haram, pembimbing berpengalaman.', summaryEn: '9-day umrah, 4-star hotels near Masjidil Haram, experienced guide.', includes: ['Tiket pesawat', 'Hotel Makkah & Madinah', 'Visa', 'Muthawif', 'Perlengkapan'], taxClass: 'pure_umrah', status: 'published' },
      { id: 'k-hrm', code: 'HRM', name: 'Umrah Haramain 12 Hari', category: 'umrah', cls: 'premium', days: 12, summaryId: 'Umrah premium 12 hari, hotel bintang 5 menghadap Masjidil Haram.', summaryEn: 'Premium 12-day umrah, 5-star hotels facing Masjidil Haram.', includes: ['Tiket pesawat', 'Hotel bintang 5', 'Visa', 'Muthawif', 'Layanan kesehatan'], taxClass: 'pure_umrah', status: 'published' },
      { id: 'k-hjk', code: 'HJK', name: 'Haji Khusus', category: 'haji', cls: 'premium', days: 40, summaryId: 'Haji khusus. Segera hadir, informasi menyusul.', summaryEn: 'Special haji. Coming soon, details to follow.', includes: [], taxClass: null, status: 'coming_soon' },
      { id: 'k-tsp', code: 'TSP', name: 'Umrah dan Kunjungan Tambahan', category: 'holyland', cls: 'premium', days: 14, summaryId: 'Umrah dan kunjungan tambahan. Segera hadir.', summaryEn: 'Umrah plus side visits. Coming soon.', includes: [], taxClass: 'mixed', status: 'coming_soon' },
    ],
    departures: [
      { id: 'd-eco1', packageId: 'k-eco', date: d(45), capacity: 40, soldOutside: 5, status: 'open', hpp: 26200000 },
      { id: 'd-eco2', packageId: 'k-eco', date: d(100), capacity: 40, soldOutside: 0, status: 'open', hpp: 26200000 },
      { id: 'd-hrm1', packageId: 'k-hrm', date: d(75), capacity: 6, soldOutside: 0, status: 'open', hpp: 36000000 },
    ],
    agreements: [
      { id: 'a1', partnerId: 'p-idi', packageId: 'k-eco', price: 28900000, marketRef: 29500000, mode: 'pct_of_net', pct: 60, fixed: 0, status: 'live', maidaaAt: now(), partnerAt: now(), liveFrom: now(), createdAt: now() },
      { id: 'a2', partnerId: 'p-idi', packageId: 'k-hrm', price: 40000000, marketRef: 42000000, mode: 'pct_of_net', pct: 50, fixed: 0, status: 'live', maidaaAt: now(), partnerAt: now(), liveFrom: now(), createdAt: now() },
    ],
    codes: [
      { id: 'c1', partnerId: 'p-idi', code: 'IDI-2026', mode: 'idr', value: 500000, ownerPhone: null, allowSelf: true, active: true },
    ],
    members: [], orders: [], payments: [], fin: [],
    tax: [{ id: 't1', name: 'Pajak margin (PLACEHOLDER)', taxType: 'placeholder', taxClass: null, base: 'margin', ratePct: 11, from: '2026-01-01', to: null, status: 'active', placeholder: true, note: 'Bukan tarif resmi. Ganti setelah angka dikonfirmasi.' }],
    settings: { transfer: 25000, cardPct: 2, financingPool: 500000, holdHours: 24, dpPct: 12.5, adminFee: 1000000, factor: { '12': 0.1005, '24': 0.05906, '36': 0.04583 }, ins: { '12': 4.0333, '24': 8.1, '36': 13.3 } },
    ledger: [], audit: [], tickets: [],
  };
  return s;
}
