import type { State, AddOnItem, CancellationRule, PkgTerms } from './types.ts';
const d = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const now = () => new Date().toISOString();

// ---------- shared templates ----------
const defaultCancellation: CancellationRule[] = [
  { minDays: 61, maxDays: null, pct: 10 },
  { minDays: 31, maxDays: 60, pct: 25 },
  { minDays: 16, maxDays: 30, pct: 50 },
  { minDays: 1, maxDays: 15, pct: 75 },
  { minDays: 0, maxDays: 0, pct: 100 },
];

const defaultTerms: PkgTerms = {
  docsId: ['Paspor berlaku minimal 8 bulan', 'KTP', 'Kartu Keluarga', 'Pas foto 4×6 (latar putih, 6 lembar)', 'Buku nikah (bagi yang menikah)', 'Surat izin mahram (wanita di bawah 45 tahun)'],
  docsEn: ['Passport valid min. 8 months', 'National ID (KTP)', 'Family card (KK)', 'Passport photos 4×6 (white background, 6 pcs)', 'Marriage certificate (if married)', 'Mahram permit (women under 45)'],
  paymentId: 'Pelunasan paling lambat 30 hari sebelum keberangkatan. Pembayaran yang sudah diterima tidak dapat dikembalikan kecuali sesuai ketentuan pembatalan.',
  paymentEn: 'Full payment due 30 days before departure. Payments received are non-refundable except per cancellation terms.',
};

const sharedAddOns: AddOnItem[] = [
  { id: 'ao-medical', nameId: 'Medical check-up pra-umrah', nameEn: 'Pre-umrah medical check-up', price: 350000, perPerson: true },
  { id: 'ao-vitamin', nameId: 'Suntik vitamin & meningitis', nameEn: 'Vitamin & meningitis injection', price: 250000, perPerson: true },
  { id: 'ao-baggage', nameId: 'Kelebihan bagasi 10 kg', nameEn: 'Extra baggage 10 kg', price: 500000, perPerson: true },
  { id: 'ao-insurance', nameId: 'Upgrade asuransi perjalanan', nameEn: 'Travel insurance upgrade', price: 200000, perPerson: true },
  { id: 'ao-zamzam', nameId: 'Air zam-zam 10 liter', nameEn: 'Zam-zam water 10 litres', price: 150000, perPerson: true },
];

const hrmExtraAddOns: AddOnItem[] = [
  { id: 'ao-lounge', nameId: 'Akses lounge bandara', nameEn: 'Airport lounge access', price: 300000, perPerson: true },
  { id: 'ao-muthawif', nameId: 'Muthawif pribadi (per rombongan)', nameEn: 'Private muthawif (per group)', price: 2000000, perPerson: false },
];

export function seedState(): State {
  const s: State = {
    seq: 1050,
    users: [
      { id: 'u-siti', name: 'dr. Siti Rahma', role: 'buyer', phone: '0811 2233 4455' },
      { id: 'u-ahmad', name: 'dr. Ahmad Fauzi', role: 'buyer', phone: '0812 3456 7890' },
      { id: 'u-budi', name: 'dr. Budi Santoso', role: 'buyer', phone: '0813 9876 5432' },
      { id: 'u-idi', name: 'Admin Primkop IDI', role: 'partner_admin', partnerId: 'p-idi' },
      { id: 'u-maidaa', name: 'Tim Maidaa', role: 'maidaa_staff' },
      { id: 'u-amitra', name: 'Analis Amitra', role: 'financier_analyst', financierId: 'f-amitra' },
      { id: 'u-platform', name: 'Admin Platform', role: 'platform_admin' },
    ],
    partners: [
      { id: 'p-idi', slug: 'idi', name: 'Primkop IDI', kind: 'organization', eligibility: 'manual', allowCodes: true, active: true, color: '#CC1B1B', roster: [] },
    ],
    packages: [
      {
        id: 'k-eco', code: 'ECO', name: 'Umrah Hemat 9 Hari', category: 'umrah', cls: 'economy', days: 9,
        summaryId: 'Umrah 9 hari, hotel bintang 4 dekat Masjidil Haram, penerbangan langsung Garuda Indonesia, pembimbing berpengalaman.',
        summaryEn: '9-day umrah, 4-star hotels near Masjidil Haram, direct Garuda Indonesia flight, experienced guide.',
        includes: ['Tiket pesawat PP (Garuda Indonesia)', 'Hotel Makkah & Madinah (★4)', 'Visa umrah', 'Muthawif berpengalaman', 'Transportasi bus AC', 'Perlengkapan umrah', 'Air zam-zam 5 liter', 'City tour Madinah'],
        excludes: ['Pengeluaran pribadi', 'Kelebihan bagasi', 'Laundry', 'Telepon dan internet', 'Tips muthawif'],
        taxClass: 'pure_umrah', status: 'published', departureCity: 'Jakarta (CGK)',
        hotels: [
          { city: 'makkah', name: 'Grand Zamzam Hotel', nameEn: 'Grand Zamzam Hotel', stars: 4, distanceM: 300, meals: 'Sarapan', mealsEn: 'Breakfast' },
          { city: 'madinah', name: 'Dallah Taibah Hotel', nameEn: 'Dallah Taibah Hotel', stars: 4, distanceM: 500, meals: 'Sarapan', mealsEn: 'Breakfast' },
        ],
        flights: [
          { airline: 'Garuda Indonesia', routeId: 'CGK → JED (langsung, ±10 jam)', routeEn: 'CGK → JED (direct, ~10 hrs)', baggage: '30 kg', baggageEn: '30 kg' },
        ],
        itinerary: [
          { day: 1, titleId: 'Keberangkatan', titleEn: 'Departure', descId: 'Berkumpul di Bandara Soekarno-Hatta. Check-in dan penerbangan menuju Jeddah.', descEn: 'Meet at Soekarno-Hatta Airport. Check-in and flight to Jeddah.' },
          { day: 2, titleId: 'Tiba di Jeddah — Makkah', titleEn: 'Arrive Jeddah — Makkah', descId: 'Tiba di Jeddah, langsung menuju Makkah. Check-in hotel. Umrah perdana (miqat, tawaf, sa\'i).', descEn: 'Arrive Jeddah, proceed to Makkah. Hotel check-in. First umrah (miqat, tawaf, sa\'i).' },
          { day: 3, titleId: 'Makkah — Ibadah', titleEn: 'Makkah — Worship', descId: 'Ibadah di Masjidil Haram. Tawaf sunnah, dzikir, doa. Waktu bebas.', descEn: 'Worship at Masjidil Haram. Sunnah tawaf, dhikr, dua. Free time.' },
          { day: 4, titleId: 'Makkah — Ziarah', titleEn: 'Makkah — Pilgrimage sites', descId: 'Ziarah ke Jabal Rahmah, Arafah, Muzdalifah, dan Mina. Ibadah malam di Masjidil Haram.', descEn: 'Visit Jabal Rahmah, Arafah, Muzdalifah, and Mina. Evening worship at Masjidil Haram.' },
          { day: 5, titleId: 'Makkah — Ibadah', titleEn: 'Makkah — Worship', descId: 'Ibadah bebas di Masjidil Haram. Tawaf dan doa. Waktu untuk belanja oleh-oleh.', descEn: 'Free worship at Masjidil Haram. Tawaf and dua. Time for souvenir shopping.' },
          { day: 6, titleId: 'Makkah → Madinah', titleEn: 'Makkah → Madinah', descId: 'Perjalanan darat Makkah ke Madinah (±6 jam). Check-in hotel. Shalat di Masjid Nabawi.', descEn: 'Overland from Makkah to Madinah (~6 hrs). Hotel check-in. Prayer at Masjid Nabawi.' },
          { day: 7, titleId: 'Madinah — Ziarah', titleEn: 'Madinah — City tour', descId: 'Ziarah Masjid Nabawi, Raudhah, Makam Baqi. City tour: Masjid Quba, Masjid Qiblatain, Uhud.', descEn: 'Visit Masjid Nabawi, Raudhah, Baqi Cemetery. City tour: Quba Mosque, Qiblatain Mosque, Uhud.' },
          { day: 8, titleId: 'Madinah — Ibadah', titleEn: 'Madinah — Worship', descId: 'Ibadah di Masjid Nabawi. Waktu bebas, belanja kurma dan oleh-oleh. Persiapan pulang.', descEn: 'Worship at Masjid Nabawi. Free time, date and souvenir shopping. Prepare for return.' },
          { day: 9, titleId: 'Pulang ke Jakarta', titleEn: 'Return to Jakarta', descId: 'Transfer ke Bandara Madinah. Penerbangan pulang ke Jakarta. Tiba di CGK.', descEn: 'Transfer to Madinah Airport. Return flight to Jakarta. Arrive at CGK.' },
        ],
        occupancy: [
          { type: 'quad', basePrice: 26200000 },
          { type: 'triple', basePrice: 27500000 },
          { type: 'double', basePrice: 29500000 },
          { type: 'single', basePrice: 35000000 },
        ],
        addOns: [...sharedAddOns],
        cancellation: defaultCancellation,
        terms: defaultTerms,
      },
      {
        id: 'k-hrm', code: 'HRM', name: 'Umrah Haramain 12 Hari', category: 'umrah', cls: 'premium', days: 12,
        summaryId: 'Umrah premium 12 hari, hotel bintang 5 menghadap Masjidil Haram, penerbangan Saudi Airlines.',
        summaryEn: 'Premium 12-day umrah, 5-star hotels facing Masjidil Haram, Saudi Airlines flight.',
        includes: ['Tiket pesawat PP (Saudi Airlines)', 'Hotel bintang 5 Makkah & Madinah', 'Visa umrah', 'Muthawif VIP', 'Transportasi bus VIP', 'Perlengkapan umrah premium', 'Air zam-zam 10 liter', 'City tour Makkah & Madinah', 'Layanan handling bandara', 'Asuransi perjalanan'],
        excludes: ['Pengeluaran pribadi', 'Kelebihan bagasi di atas 2×23 kg', 'Laundry', 'Tips muthawif'],
        taxClass: 'pure_umrah', status: 'published', departureCity: 'Jakarta (CGK)',
        hotels: [
          { city: 'makkah', name: 'Swissôtel Al Maqam Makkah', nameEn: 'Swissôtel Al Maqam Makkah', stars: 5, distanceM: 100, meals: 'Sarapan, makan siang, makan malam', mealsEn: 'Full board' },
          { city: 'madinah', name: 'The Oberoi Madina', nameEn: 'The Oberoi Madina', stars: 5, distanceM: 200, meals: 'Sarapan, makan siang, makan malam', mealsEn: 'Full board' },
        ],
        flights: [
          { airline: 'Saudi Airlines', routeId: 'CGK → MED via Riyadh (transit ±2 jam)', routeEn: 'CGK → MED via Riyadh (transit ~2 hrs)', baggage: '2×23 kg', baggageEn: '2×23 kg' },
        ],
        itinerary: [
          { day: 1, titleId: 'Keberangkatan', titleEn: 'Departure', descId: 'Berkumpul di Bandara Soekarno-Hatta. Check-in dan penerbangan menuju Madinah via Riyadh.', descEn: 'Meet at Soekarno-Hatta Airport. Check-in and flight to Madinah via Riyadh.' },
          { day: 2, titleId: 'Tiba di Madinah', titleEn: 'Arrive Madinah', descId: 'Tiba di Madinah. Check-in hotel The Oberoi. Shalat di Masjid Nabawi. Istirahat.', descEn: 'Arrive Madinah. Check-in The Oberoi hotel. Prayer at Masjid Nabawi. Rest.' },
          { day: 3, titleId: 'Madinah — Raudhah', titleEn: 'Madinah — Raudhah', descId: 'Shalat Subuh di Masjid Nabawi. Ziarah Raudhah (area mulia). Shalat dan dzikir sepanjang hari.', descEn: 'Fajr prayer at Masjid Nabawi. Visit Raudhah (noble area). Prayer and dhikr all day.' },
          { day: 4, titleId: 'Madinah — City tour', titleEn: 'Madinah — City tour', descId: 'Ziarah: Masjid Quba, Masjid Qiblatain, Jabal Uhud, Makam Baqi, kebun kurma. Makan siang di restoran lokal.', descEn: 'Visit: Quba Mosque, Qiblatain Mosque, Mount Uhud, Baqi Cemetery, date gardens. Lunch at local restaurant.' },
          { day: 5, titleId: 'Madinah → Makkah', titleEn: 'Madinah → Makkah', descId: 'Perjalanan VIP ke Makkah. Miqat di Bir Ali. Check-in Swissôtel Al Maqam. Umrah (tawaf, sa\'i).', descEn: 'VIP journey to Makkah. Miqat at Bir Ali. Check-in Swissôtel Al Maqam. Umrah (tawaf, sa\'i).' },
          { day: 6, titleId: 'Makkah — Ibadah', titleEn: 'Makkah — Worship', descId: 'Ibadah di Masjidil Haram. Tawaf sunnah, doa, dzikir. Waktu bebas.', descEn: 'Worship at Masjidil Haram. Sunnah tawaf, dua, dhikr. Free time.' },
          { day: 7, titleId: 'Makkah — Ziarah', titleEn: 'Makkah — Pilgrimage sites', descId: 'Ziarah: Jabal Rahmah, Padang Arafah, Muzdalifah, Mina, Jabal Tsur. Ibadah malam.', descEn: 'Visit: Jabal Rahmah, Arafah Plain, Muzdalifah, Mina, Jabal Tsur. Evening worship.' },
          { day: 8, titleId: 'Makkah — Ibadah', titleEn: 'Makkah — Worship', descId: 'Shalat tahajud di Masjidil Haram. Ibadah bebas. Tawaf wada bagi yang ingin.', descEn: 'Tahajjud at Masjidil Haram. Free worship. Farewell tawaf for those who wish.' },
          { day: 9, titleId: 'Makkah — Umrah kedua', titleEn: 'Makkah — Second umrah', descId: 'Umrah kedua dari Tan\'im. Tawaf dan sa\'i. Belanja di sekitar Masjidil Haram.', descEn: 'Second umrah from Tan\'im. Tawaf and sa\'i. Shopping near Masjidil Haram.' },
          { day: 10, titleId: 'Makkah — Ibadah', titleEn: 'Makkah — Worship', descId: 'Ibadah bebas. Tawaf sunnah. Waktu untuk belanja oleh-oleh dan persiapan pulang.', descEn: 'Free worship. Sunnah tawaf. Time for souvenir shopping and preparing for return.' },
          { day: 11, titleId: 'Makkah — Hari terakhir', titleEn: 'Makkah — Last day', descId: 'Tawaf wada (perpisahan). Shalat Dzuhur di Masjidil Haram. Transfer ke Jeddah. Makan malam perpisahan.', descEn: 'Farewell tawaf. Dhuhr prayer at Masjidil Haram. Transfer to Jeddah. Farewell dinner.' },
          { day: 12, titleId: 'Pulang ke Jakarta', titleEn: 'Return to Jakarta', descId: 'Penerbangan dari Jeddah ke Jakarta via Riyadh. Tiba di CGK.', descEn: 'Flight from Jeddah to Jakarta via Riyadh. Arrive at CGK.' },
        ],
        occupancy: [
          { type: 'quad', basePrice: 36000000 },
          { type: 'triple', basePrice: 38000000 },
          { type: 'double', basePrice: 42000000 },
          { type: 'single', basePrice: 52000000 },
        ],
        addOns: [...sharedAddOns, ...hrmExtraAddOns],
        cancellation: defaultCancellation,
        terms: defaultTerms,
      },
      { id: 'k-hjk', code: 'HJK', name: 'Haji Khusus', category: 'haji', cls: 'premium', days: 40, summaryId: 'Haji khusus. Segera hadir, informasi menyusul.', summaryEn: 'Special haji. Coming soon, details to follow.', includes: [], taxClass: null, status: 'coming_soon' },
      { id: 'k-tsp', code: 'TSP', name: 'Umrah dan Kunjungan Tambahan', category: 'holyland', cls: 'premium', days: 14, summaryId: 'Umrah dan kunjungan tambahan. Segera hadir.', summaryEn: 'Umrah plus side visits. Coming soon.', includes: [], taxClass: 'mixed', status: 'coming_soon' },
    ],
    departures: [
      { id: 'd-eco1', packageId: 'k-eco', date: d(45), capacity: 40, soldOutside: 5, status: 'open', hpp: 26200000 },
      { id: 'd-eco2', packageId: 'k-eco', date: d(100), capacity: 40, soldOutside: 0, status: 'open', hpp: 26200000 },
      { id: 'd-eco3', packageId: 'k-eco', date: d(-10), capacity: 40, soldOutside: 12, status: 'closed', hpp: 25800000 },
      { id: 'd-hrm1', packageId: 'k-hrm', date: d(75), capacity: 6, soldOutside: 0, status: 'open', hpp: 36000000 },
      { id: 'd-hrm2', packageId: 'k-hrm', date: d(150), capacity: 10, soldOutside: 1, status: 'open', hpp: 36000000 },
    ],
    agreements: [
      { id: 'a1', partnerId: 'p-idi', packageId: 'k-eco', price: 28900000, marketRef: 29500000, mode: 'pct_of_net', pct: 60, fixed: 0, status: 'live', maidaaAt: now(), partnerAt: now(), liveFrom: now(), createdAt: now() },
      { id: 'a2', partnerId: 'p-idi', packageId: 'k-hrm', price: 40000000, marketRef: 42000000, mode: 'pct_of_net', pct: 50, fixed: 0, status: 'live', maidaaAt: now(), partnerAt: now(), liveFrom: now(), createdAt: now() },
    ],
    codes: [
      { id: 'c1', partnerId: 'p-idi', code: 'IDI-2026', mode: 'idr', value: 500000, ownerPhone: null, allowSelf: true, active: true },
      { id: 'c2', partnerId: 'p-idi', code: 'DOKTER10', mode: 'pct', value: 2, ownerPhone: '0811 2233 4455', allowSelf: false, active: true },
    ],
    members: [], orders: [], payments: [], fin: [],
    tax: [{ id: 't1', name: 'Pajak margin (PLACEHOLDER)', taxType: 'placeholder', taxClass: null, base: 'margin', ratePct: 11, from: '2026-01-01', to: null, status: 'active', placeholder: true, note: 'Bukan tarif resmi. Ganti setelah angka dikonfirmasi.' }],
    settings: { transfer: 25000, cardPct: 2, financingPool: 500000, holdHours: 24, dpPct: 12.5, adminFee: 1000000, factor: { '12': 0.1005, '24': 0.05906, '36': 0.04583 }, ins: { '12': 4.0333, '24': 8.1, '36': 13.3 } },
    ledger: [], audit: [], tickets: [],
  };
  return s;
}
