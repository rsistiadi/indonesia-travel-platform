import { useEffect, useState } from 'react';
import { api } from '../data/api.ts';
import { Badge, Button, Card, Empty, Field, MoneyInput, OrderBadge, go, run, useApi } from '../core.tsx';
import { dyn, fdate, fdt, rp, t, useLang } from '../i18n.ts';
import { Maiya } from './Maiya.tsx';
import { KaabaIllustration, MinaretIllustration } from '../illustrations.tsx';
import type { Partner } from '../data/types.ts';
import type * as T from '../data/types.ts';

export function PartnerSite({ slug, sub }: { slug: string; sub: string[] }) {
  useApi();
  const p = api.partnerBySlug(slug);
  if (!p) return <div className="wrap"><Card title={t('Situs tidak ditemukan')}><p>{t('Alamat mitra ini tidak aktif.')}</p></Card></div>;
  return (
    <div className="buyer">
      <div className="top"><div className="wrap">
        <a className="brand" href={`#/p/${slug}`}>{slug === 'idi' ? <img src="idi-logo.png" alt="" width={40} height={40} /> : <span className="dot" />}{p.name}</a>
        <span className="mut sm hide-sm">{t('dengan Maidaa Umrah Services')}</span>
        <span className="grow" />
        <a href={`#/p/${slug}`}>{t('Paket')}</a>
        <a href={`#/p/${slug}/orders`}>{t('Pesanan saya')}</a>
      </div></div>
      <main className="wrap">
        <Body p={p} sub={sub} />
      </main>
      <Maiya pid={p.id} partnerName={p.name} />
    </div>
  );
}

function Body({ p, sub }: { p: Partner; sub: string[] }) {
  const me = api.me();
  if (!me || me.role !== 'buyer') return <SignInPrompt p={p} staffNote={!!me} />;
  const m = api.myMember(p.id);
  if (!m || m.status === 'rejected') return <Join p={p} rejected={m?.status === 'rejected'} />;
  if (m.status === 'pending') return <Card title={t('Menunggu persetujuan')} tone="warn"><p>{t('Permintaan Anda sedang diperiksa oleh admin {0}. Anda bisa memesan setelah disetujui.', p.name)}</p></Card>;
  if (m.status === 'blocked') return <Card title={t('Akses ditutup')}><p>{t('Hubungi admin mitra.')}</p></Card>;
  if (sub[0] === 'pkg' && sub[1]) return <PackageDetail p={p} depId={sub[1]} />;
  if (sub[0] === 'order' && sub[1]) return <Checkout p={p} depId={sub[1]} />;
  if (sub[0] === 'o' && sub[1]) return <OrderPage p={p} id={sub[1]} />;
  if (sub[0] === 'orders') return <Orders p={p} />;
  return <Catalog p={p} />;
}

function SignInPrompt({ p, staffNote }: { p: Partner; staffNote: boolean }) {
  return (
    <>
      <div className="hero hero-illustrated">
        <div className="hero-text"><h1>{t('Umrah bersama {0}', p.name)}</h1><p>{t('Paket resmi dari Maidaa Umrah Services, dijual melalui {0}. Masuk untuk melihat harga dan memesan.', p.name)}</p></div>
        <KaabaIllustration size={180} className="hero-illus" />
      </div>
      <Card title={t('Masuk')}>
        {staffNote && <p className="mut">{t('Akun yang aktif bukan akun pembeli.')}</p>}
        <p>{t('Mode contoh: pilih akun pembeli.')}</p>
        <div className="row">
          <Button onClick={() => { api.signIn('u-siti'); go('/p/idi'); }}>dr. Siti Rahma</Button>
        </div>
      </Card>
      <PublicList p={p} />
    </>
  );
}

function PublicList({ p }: { p: Partner }) {
  const items = api.catalog(p.id);
  return <>{<h2 style={{ margin: '8px 0 12px' }}>{t('Paket tersedia')}</h2>}<div className="grid g3">{items.map((c) => <PackageCard key={(c.depId ?? c.pkg.id)} c={c} onOrder={null} />)}</div></>;
}

type CatItem = ReturnType<typeof api.catalog>[number];
function PackageCard({ c, onOrder }: { c: CatItem; onOrder: null | (() => void) }) {
  const { pkg } = c;
  return (
    <Card>
      <div className="pk">
        <div className="row"><Badge tone={pkg.category === 'haji' ? 'blue' : 'green'}>{t(pkg.category === 'umrah' ? 'Umrah' : pkg.category === 'haji' ? 'Haji' : 'Tanah suci')}</Badge>
          {c.availability === 'sold_out' && <Badge tone="red">{t('Penuh')}</Badge>}
          {c.availability === 'available' && (c.left ?? 99) <= 5 && <Badge tone="amber">{t('Sisa {0} kursi', c.left ?? 0)}</Badge>}</div>
        <h3>{t(pkg.name)}</h3>
        <p className="mut sm">{dyn(pkg.summaryId, pkg.summaryEn)}</p>
        {c.date && <p className="sm">{t('Berangkat')}: <b>{fdate(c.date)}</b> · {t('{0} hari', pkg.days)}</p>}
        {pkg.includes.length > 0 && <p className="sm mut">{pkg.includes.map((i) => t(i)).join(' · ')}</p>}
        {c.availability === 'coming_soon' ? <div className="price mut">{t('Segera hadir')}</div> : <div className="price">{c.price ? rp(c.price) : '—'} <span className="mut sm">/ {t('orang')}</span></div>}
        {onOrder && <Button onClick={onOrder} kind={c.availability === 'available' ? 'primary' : 'ghost'}>{t('Lihat detail')}</Button>}
        {!onOrder && c.availability === 'coming_soon' && <Button disabled>{t('Segera hadir')}</Button>}
      </div>
    </Card>
  );
}

function Catalog({ p }: { p: Partner }) {
  const [f, setF] = useState<'all' | 'umrah' | 'haji'>('all');
  const items = api.catalog(p.id).filter((c) => f === 'all' || c.pkg.category === f);
  return (
    <>
      <div className="hero hero-illustrated">
        <div className="hero-text"><h1>{t('Pilih paket Anda')}</h1><p>{t('Harga sudah final dan disepakati antara {0} dan Maidaa. Kursi dipakai bersama semua saluran, jadi sisa kursi selalu terkini.', p.name)}</p></div>
        <MinaretIllustration size={160} className="hero-illus" />
      </div>
      <div className="row" style={{ marginBottom: 14 }}>{(['all', 'umrah', 'haji'] as const).map((k) => <Button key={k} small kind={f === k ? 'primary' : 'ghost'} onClick={() => setF(k)}>{t(k === 'all' ? 'Semua' : k === 'umrah' ? 'Umrah' : 'Haji')}</Button>)}</div>
      {items.length === 0 ? <Empty>{t('Belum ada paket.')}</Empty> : <div className="grid g3">{items.map((c) => <PackageCard key={c.depId ?? c.pkg.id} c={c} onOrder={c.depId ? () => go(`/p/${p.slug}/pkg/${c.depId}`) : null} />)}</div>}
    </>
  );
}

/* ---------- occupancy labels ---------- */
const OCC_LABEL: Record<string, [string, string]> = {
  quad: ['Quad (4 orang/kamar)', 'Quad (4 per room)'],
  triple: ['Triple (3 orang/kamar)', 'Triple (3 per room)'],
  double: ['Double (2 orang/kamar)', 'Double (2 per room)'],
  single: ['Single (1 orang/kamar)', 'Single (1 per room)'],
};

function PackageDetail({ p, depId }: { p: Partner; depId: string }) {
  const lang = useLang();
  const detail = api.packageDetail(p.id, depId);
  const [tenor, setTenor] = useState(24);
  const [activeNav, setActiveNav] = useState('summary');

  if (!detail) return <Card title={t('Paket tidak ditemukan')}><p>{t('Keberangkatan ini tidak tersedia atau belum dijual.')}</p><Button kind="ghost" onClick={() => go(`/p/${p.slug}`)}>{t('Kembali')}</Button></Card>;

  const { pkg, date, left, availability, occupancyPrices, addOns, cancellation, terms } = detail;
  const lowestPrice = occupancyPrices.length ? Math.min(...occupancyPrices.map((o) => o.price)) : detail.startingPrice;
  const fq = lowestPrice ? api.financingQuote(lowestPrice, tenor) : null;
  const nights = pkg.days > 1 ? pkg.days - 1 : pkg.days;

  const sections: [string, string, string, boolean][] = [
    ['summary', 'Ringkasan', 'Summary', true],
    ['itinerary', 'Itinerary', 'Itinerary', !!(pkg.itinerary?.length)],
    ['hotels', 'Hotel', 'Hotels', !!(pkg.hotels?.length)],
    ['flights', 'Penerbangan', 'Flights', !!(pkg.flights?.length)],
    ['facilities', 'Fasilitas', 'Facilities', pkg.includes.length > 0],
    ['pricing', 'Harga', 'Prices', occupancyPrices.length > 0],
    ['financing', 'Cicilan', 'Financing', !!lowestPrice],
    ['terms', 'Syarat', 'Terms', !!terms || cancellation.length > 0],
  ];
  const scrollTo = (id: string) => { setActiveNav(id); document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  return (
    <div className="pkg-detail">
      <div className="pkg-main">
        {/* Hero */}
        <section id="sec-summary" className={`pkg-hero ${pkg.cls === 'premium' ? 'premium' : 'economy'}`}>
          <MinaretIllustration size={220} className="pkg-hero-illus" />
          <Badge tone={pkg.category === 'haji' ? 'blue' : 'green'}>{t(pkg.category === 'umrah' ? 'Umrah' : pkg.category === 'haji' ? 'Haji' : 'Tanah suci')}</Badge>
          <h1>{t(pkg.name)}</h1>
          <p className="hero-sub">{dyn(pkg.summaryId, pkg.summaryEn)}</p>
          <div className="hero-meta">
            <span>📅 {fdate(date)}</span>
            <span>🕌 {t('{0} hari {1} malam', pkg.days, nights)}</span>
            {left !== null && left > 0 && <span>💺 {t('Sisa {0} kursi', left)}</span>}
            {left === 0 && <Badge tone="red">{t('Penuh')}</Badge>}
            {pkg.departureCity && <span>✈️ {pkg.departureCity}</span>}
          </div>
          {lowestPrice != null && <div className="hero-price"><span className="label">{t('Mulai dari')}</span> <span className="amount">{rp(lowestPrice)}</span> <span className="per">/ {t('orang')}</span></div>}
        </section>

        {/* Sticky nav */}
        <nav className="pkg-nav">{sections.filter(([,,,show]) => show).map(([id, labelId, labelEn]) => (
          <button key={id} className={activeNav === id ? 'on' : ''} onClick={() => scrollTo(id)}>{dyn(labelId, labelEn)}</button>
        ))}</nav>

        {/* Itinerary */}
        {pkg.itinerary?.length ? (
          <section id="sec-itinerary"><h2>{t('Itinerary')}</h2>
            <div className="itin-list">{pkg.itinerary.map((dy) => (
              <div key={dy.day} className="itin-day">
                <div className="itin-badge">{t('Hari {0}', dy.day)}</div>
                <div className="itin-body"><h3>{dyn(dy.titleId, dy.titleEn)}</h3><p className="mut sm">{dyn(dy.descId, dy.descEn)}</p></div>
              </div>
            ))}</div>
          </section>
        ) : null}

        {/* Hotels */}
        {pkg.hotels?.length ? (
          <section id="sec-hotels"><h2>{t('Hotel')}</h2>
            <div className="grid g2">{pkg.hotels.map((h, i) => (
              <Card key={i}>
                <div className="hotel-card">
                  <Badge tone={h.city === 'makkah' ? 'green' : 'blue'}>{h.city === 'makkah' ? 'Makkah' : 'Madinah'}</Badge>
                  <h3>{dyn(h.name, h.nameEn)}</h3>
                  <div className="hotel-stars">{'★'.repeat(h.stars)}</div>
                  <p className="sm mut">📍 {h.distanceM < 1000 ? t('{0} m dari Masjid', h.distanceM) : t('{0} km dari Masjid', (h.distanceM / 1000).toFixed(1))}</p>
                  <p className="sm mut">🍽️ {dyn(h.meals, h.mealsEn)}</p>
                </div>
              </Card>
            ))}</div>
          </section>
        ) : null}

        {/* Flights */}
        {pkg.flights?.length ? (
          <section id="sec-flights"><h2>{t('Penerbangan')}</h2>
            {pkg.flights.map((f, i) => (
              <Card key={i}>
                <h3>✈️ {f.airline}</h3>
                <p>{dyn(f.routeId, f.routeEn)}</p>
                <p className="mut sm">🧳 {t('Bagasi')}: {dyn(f.baggage, f.baggageEn)}</p>
              </Card>
            ))}
          </section>
        ) : null}

        {/* Facilities: included / excluded */}
        {(pkg.includes.length > 0 || (pkg.excludes?.length ?? 0) > 0) && (
          <section id="sec-facilities"><h2>{t('Fasilitas')}</h2>
            {pkg.includes.length > 0 && <Card title={t('Termasuk')}><ul className="fac-list inc">{pkg.includes.map((item, i) => <li key={i}>{t(item)}</li>)}</ul></Card>}
            {pkg.excludes?.length ? <Card title={t('Tidak termasuk')}><ul className="fac-list exc">{pkg.excludes.map((item, i) => <li key={i}>{t(item)}</li>)}</ul></Card> : null}
          </section>
        )}

        {/* Pricing by occupancy */}
        {occupancyPrices.length > 0 && (
          <section id="sec-pricing"><h2>{t('Harga per tipe kamar')}</h2>
            <div className="occ-grid">{occupancyPrices.map((o) => {
              const [lId, lEn] = OCC_LABEL[o.type] ?? [o.type, o.type];
              return (
                <div key={o.type} className={`occ-card${o.type === 'quad' ? ' best' : ''}`}>
                  {o.type === 'quad' && <span className="occ-best">{t('Harga terbaik')}</span>}
                  <div className="occ-type">{dyn(lId, lEn)}</div>
                  <div className="occ-price">{rp(o.price)}</div>
                  <div className="occ-per">/ {t('orang')}</div>
                </div>);
            })}</div>
          </section>
        )}

        {/* Add-ons */}
        {addOns.length > 0 && (
          <section id="sec-addons"><h2>{t('Tambahan opsional')}</h2>
            <Card>{addOns.map((a) => (
              <div key={a.id} className="addon-row">
                <span />
                <span className="addon-name">{dyn(a.nameId, a.nameEn)}</span>
                <span className="addon-price">{rp(a.price)} {a.perPerson ? `/ ${t('orang')}` : `/ ${t('rombongan')}`}</span>
              </div>
            ))}</Card>
          </section>
        )}

        {/* Financing simulation */}
        {lowestPrice != null && (
          <section id="sec-financing"><h2>{t('Simulasi cicilan')}</h2>
            <Card title={t('Pembiayaan Amitra')}>
              <p className="mut sm">{t('Simulasi berdasarkan harga Quad ({0}) per orang.', rp(lowestPrice))}</p>
              <Field label={t('Tenor cicilan')}><select value={tenor} onChange={(e) => setTenor(+e.target.value)}>{[12, 24, 36].map((n) => <option key={n} value={n}>{t('{0} bulan', n)}</option>)}</select></Field>
              {fq && <div className="sum">
                <span>{t('Uang muka')}</span><span>{rp(fq.dp)}</span>
                <span>{t('Biaya admin')}</span><span>{rp(fq.admin)}</span>
                <span>{t('Asuransi')}</span><span>{rp(fq.insurance)}</span>
                <span className="t">{t('Pembayaran pertama')}</span><span className="t">{rp(fq.firstPayment)}</span>
                <span>{t('Cicilan per bulan')}</span><span>{rp(fq.instalment)} × {tenor}</span>
                <span>{t('Total biaya pembiayaan')}</span><span>{rp(fq.totalCost)}</span>
                <span>{t('Lebih mahal dari tunai')}</span><span>{rp(fq.extra)}</span>
              </div>}
            </Card>
          </section>
        )}

        {/* Terms & cancellation */}
        {(terms || cancellation.length > 0) && (
          <section id="sec-terms"><h2>{t('Syarat dan ketentuan')}</h2>
            {terms && <>
              <Card title={t('Dokumen yang diperlukan')}><ul className="fac-list">{(lang === 'en' ? terms.docsEn : terms.docsId).map((d, i) => <li key={i}>{d}</li>)}</ul></Card>
              <Card title={t('Ketentuan pembayaran')}><p className="sm">{dyn(terms.paymentId, terms.paymentEn)}</p></Card>
            </>}
            {cancellation.length > 0 && (
              <Card title={t('Kebijakan pembatalan')}>
                <div className="tbl"><table>
                  <thead><tr><th>{t('Waktu sebelum berangkat')}</th><th className="num">{t('Penalti')}</th></tr></thead>
                  <tbody>{cancellation.map((r, i) => (
                    <tr key={i}>
                      <td data-l={t('Waktu')}>{r.maxDays === null ? t('> {0} hari', r.minDays) : r.minDays === 0 && r.maxDays === 0 ? t('Hari H / no-show') : t('{0}–{1} hari', r.minDays, r.maxDays)}</td>
                      <td className="num" data-l={t('Penalti')}>{r.pct}%</td>
                    </tr>
                  ))}</tbody>
                </table></div>
              </Card>
            )}
          </section>
        )}
      </div>

      {/* Booking sidebar (desktop) */}
      <aside className="pkg-sidebar"><div className="pkg-book-card">
        <h3>{t(pkg.name)}</h3>
        <p className="sm mut">{fdate(date)} · {t('{0} hari', pkg.days)}</p>
        {lowestPrice != null ? <>
          <div className="book-price">{t('Mulai dari')}<br /><b>{rp(lowestPrice)}</b> / {t('orang')}</div>
          {fq && <p className="sm mut">{t('atau cicilan {0}/bln', rp(fq.instalment))}</p>}
        </> : <p className="mut">{t('Harga belum tersedia.')}</p>}
        <Button disabled={availability !== 'available'} onClick={() => go(`/p/${p.slug}/order/${depId}`)}>
          {availability === 'sold_out' ? t('Penuh') : availability === 'coming_soon' ? t('Segera hadir') : t('Pesan sekarang')}
        </Button>
        {left !== null && left > 0 && left <= 10 && <p className="sm" style={{ textAlign: 'center', color: 'var(--acc)' }}>{t('Sisa {0} kursi', left)}</p>}
      </div></aside>

      {/* Booking bottom bar (mobile) */}
      <div className="pkg-bottom-bar"><div className="wrap">
        <div>{lowestPrice != null ? <><span className="sm">{t('Mulai dari')}</span><br /><b>{rp(lowestPrice)}</b><span className="sm mut"> / {t('orang')}</span></> : <span className="mut">{t('Harga belum tersedia.')}</span>}</div>
        <Button disabled={availability !== 'available'} onClick={() => go(`/p/${p.slug}/order/${depId}`)}>
          {availability === 'sold_out' ? t('Penuh') : t('Pesan sekarang')}
        </Button>
      </div></div>
    </div>
  );
}

function Join({ p, rejected }: { p: Partner; rejected: boolean }) {
  const me = api.me()!;
  const [no, setNo] = useState(''); const [name, setName] = useState(me.name); const [phone, setPhone] = useState(me.phone ?? ''); const [rel, setRel] = useState<'member' | 'family'>('member');
  return (
    <div className="grid g2">
      <Card title={t('Daftar sebagai pembeli {0}', p.name)}>
        {rejected && <p className="mut">{t('Permintaan sebelumnya tidak disetujui. Perbarui data lalu kirim ulang.')}</p>}
        <p className="mut sm">{p.eligibility === 'none' ? t('Anda langsung bisa memesan setelah mendaftar.') : t('Admin {0} akan memeriksa data Anda sebelum Anda bisa memesan.', p.name)}</p>
        <Field label={t('Hubungan')}><select value={rel} onChange={(e) => setRel(e.target.value as 'member' | 'family')}><option value="member">{t('Anggota')}</option><option value="family">{t('Keluarga anggota')}</option></select></Field>
        {p.kind === 'organization' && <Field label={t('Nomor anggota')}><input value={no} onChange={(e) => setNo(e.target.value)} placeholder="IDI-0000" /></Field>}
        <Field label={t('Nama lengkap')}><input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label={t('Nomor WhatsApp')}><input value={phone} inputMode="tel" onChange={(e) => setPhone(e.target.value)} /></Field>
        <Button disabled={!name.trim() || !phone.trim() || (p.kind === 'organization' && !no.trim())} onClick={() => run(() => api.requestMembership(p.id, no.trim(), name.trim(), phone.trim(), rel), 'Terkirim.')}>{t('Kirim')}</Button>
      </Card>
      <PublicList p={p} />
    </div>
  );
}

function Checkout({ p, depId }: { p: Partner; depId: string }) {
  const lang = useLang();
  const c = api.catalog(p.id).find((x) => x.depId === depId);
  const me = api.myMember(p.id)!;
  const detail = api.packageDetail(p.id, depId);
  const [pax, setPax] = useState(1);
  const [codeText, setCode] = useState('');
  const [method, setMethod] = useState<'transfer' | 'card' | 'financing'>('transfer');
  const [tenor, setTenor] = useState(24);
  const [occ, setOcc] = useState<T.OccupancyType | null>(null);
  const [checkedAddOns, setCheckedAddOns] = useState<Set<string>>(new Set());
  if (!c || !c.price) return <Card title={t('Keberangkatan tidak tersedia')}><Button onClick={() => go(`/p/${p.slug}`)}>{t('Kembali')}</Button></Card>;
  let q; try { q = api.buyerQuote(p.id, depId, pax, codeText, method, me.phone, occ ?? undefined); } catch { q = null; }
  const fq = q && method === 'financing' ? api.financingQuote(q.total, tenor) : null;
  const left = c.left ?? 0;
  const occPrices = detail?.occupancyPrices ?? [];
  const addOns = detail?.addOns ?? [];
  const lowestOccPrice = occPrices.length ? Math.min(...occPrices.map((o) => o.price)) : null;
  const addOnTotal = addOns.filter((a) => checkedAddOns.has(a.id)).reduce((s, a) => s + (a.perPerson ? a.price * pax : a.price), 0);
  const toggleAddOn = (id: string) => setCheckedAddOns((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  return (
    <div className="grid split">
      <div>
        <Card title={t(c.pkg.name)} right={<span className="mut sm">{fdate(c.date)}</span>}>
          <div className="grid g2">
            <Field label={t('Jumlah peserta')} hint={t('Sisa {0} kursi', left)}><input type="number" min={1} max={Math.min(20, left)} value={pax} onChange={(e) => setPax(Math.max(1, Math.min(Math.min(20, left) || 1, +e.target.value || 1)))} /></Field>
            {p.allowCodes && <Field label={t('Kode diskon (opsional)')} hint={q?.codeOk === false ? t('Kode tidak berlaku di situs ini.') : q?.codeOk ? (q.self ? t('Kode Anda sendiri: diskon berlaku, komisi tidak.') : t('Kode dipakai.')) : undefined}><input value={codeText} onChange={(e) => setCode(e.target.value)} placeholder="IDI-2026" /></Field>}
          </div>
          {occPrices.length > 0 && (
            <Field label={t('Tipe kamar')}>
              <div className="occ-grid" style={{ marginTop: 6 }}>
                {occPrices.map((op) => (
                  <button key={op.type} className={'occ-card' + (occ === op.type ? ' selected' : '')} onClick={() => setOcc(op.type as T.OccupancyType)} style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}>
                    {lowestOccPrice !== null && op.price === lowestOccPrice && <div className="occ-best">{t('Terbaik')}</div>}
                    <div className="occ-type">{OCC_LABEL[op.type]?.[lang === 'en' ? 1 : 0] ?? op.type}</div>
                    <div className="occ-price">{rp(op.price)}</div>
                    <div className="mut sm">{t('per orang')}</div>
                  </button>
                ))}
              </div>
              {!occ && <p className="sm" style={{ color: '#CC1B1B', marginTop: 6 }}>{t('Pilih tipe kamar untuk melanjutkan.')}</p>}
            </Field>
          )}
          <Field label={t('Cara pembayaran')}>
            <select value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
              <option value="transfer">{t('Transfer bank (diperiksa Maidaa)')}</option><option value="card">{t('Kartu kredit')}</option><option value="financing">{t('Pembiayaan Amitra (cicilan)')}</option>
            </select>
          </Field>
          {method === 'financing' && <Field label={t('Tenor cicilan')}><select value={tenor} onChange={(e) => setTenor(+e.target.value)}>{[12, 24, 36].map((n) => <option key={n} value={n}>{t('{0} bulan', n)}</option>)}</select></Field>}
          <Card tone="warn"><p className="sm">{t('Kursi ditahan {0} jam setelah Anda memesan. Tanpa pembayaran, kursi dilepas kembali.', api.state.settings.holdHours)}</p></Card>
        </Card>
        {addOns.length > 0 && (
          <Card title={t('Layanan tambahan (opsional)')} style={{ marginTop: 12 }}>
            <p className="sm mut" style={{ marginBottom: 8 }}>{t('Layanan di bawah bisa dipesan terpisah setelah pemesanan diproses.')}</p>
            {addOns.map((a) => (
              <label key={a.id} className="addon-row" style={{ cursor: 'pointer' }}>
                <input type="checkbox" checked={checkedAddOns.has(a.id)} onChange={() => toggleAddOn(a.id)} />
                <span className="addon-name">{dyn(a.nameId, a.nameEn)}</span>
                <span className="addon-price">+ {rp(a.price)}{a.perPerson && <span className="sm mut"> /orang</span>}</span>
              </label>
            ))}
          </Card>
        )}
      </div>
      <Card title={t('Ringkasan')}>
        {q ? <>
          <div className="sum">
            <span>{t('Tipe kamar')}</span><span>{occ ? (OCC_LABEL[occ]?.[lang === 'en' ? 1 : 0] ?? occ) : <span className="mut">—</span>}</span>
            <span>{t('Harga per orang')}</span><span>{rp(q.unit)}</span>
            {q.discountPerPax > 0 && <><span>{t('Diskon per orang')}</span><span>− {rp(q.discountPerPax)}</span></>}
            <span>{t('Peserta')}</span><span>× {pax}</span>
            <span className="t">{t('Total paket')}</span><span className="t">{rp(q.total)}</span>
            {addOnTotal > 0 && <><span>{t('Layanan tambahan')}</span><span>+ {rp(addOnTotal)}</span><span className="sm mut">{t('(dibayar terpisah)')}</span><span className="sm mut"></span></>}
          </div>
          {q.floorHit && <p className="sm mut">{t('Diskon dibatasi agar harga tidak di bawah batas minimum.')}</p>}
          {fq && <div className="sum" style={{ marginTop: 12 }}>
            <span>{t('Uang muka')}</span><span>{rp(fq.dp)}</span><span>{t('Biaya admin')}</span><span>{rp(fq.admin)}</span><span>{t('Asuransi')}</span><span>{rp(fq.insurance)}</span>
            <span className="t">{t('Pembayaran pertama')}</span><span className="t">{rp(fq.firstPayment)}</span>
            <span>{t('Cicilan per bulan')}</span><span>{rp(fq.instalment)} × {tenor}</span>
            <span>{t('Total biaya pembiayaan')}</span><span>{rp(fq.totalCost)}</span><span>{t('Lebih mahal dari tunai')}</span><span>{rp(fq.extra)}</span></div>}
          <div style={{ marginTop: 14 }}><Button disabled={!occ || q.invalid || left < pax} onClick={() => { let id = ''; if (run(() => { id = api.placeOrder({ partnerId: p.id, departureId: depId, pax, method, codeText, tenor: method === 'financing' ? tenor : undefined, occupancyType: occ! }).id; }, 'Pesanan dibuat.')) { try { sessionStorage.setItem('itp.justCreated', id); } catch {} go(`/p/${p.slug}/o/${id}`); } }}>{t('Buat pesanan')}</Button></div>
          {!occ && <p className="sm mut" style={{ marginTop: 6 }}>{t('Pilih tipe kamar untuk mengaktifkan tombol.')}</p>}
        </> : <Empty>{t('Harga belum tersedia.')}</Empty>}
      </Card>
    </div>
  );
}

function Countdown({ to }: { to: string }) {
  const [, tick] = useState(0);
  useEffect(() => { const i = setInterval(() => tick((x) => x + 1), 30000); return () => clearInterval(i); }, []);
  const ms = Date.parse(to) - Date.now(); if (ms <= 0) return <b>{t('habis')}</b>;
  const h = Math.floor(ms / 36e5), m = Math.floor((ms % 36e5) / 6e4);
  return <b>{t('{0} jam {1} menit', h, m)}</b>;
}

function OrderPage({ p, id }: { p: Partner; id: string }) {
  const o = api.buyerOrder(id);
  const [amount, setAmount] = useState(0); const [proof, setProof] = useState(''); const [note, setNote] = useState('');
  const [justCreated] = useState(() => {
    try {
      if (sessionStorage.getItem('itp.justCreated') === id) { sessionStorage.removeItem('itp.justCreated'); return true; }
    } catch {}
    return false;
  });
  if (!o) return <Card title={t('Pesanan tidak ditemukan')}><Button onClick={() => go(`/p/${p.slug}/orders`)}>{t('Kembali')}</Button></Card>;
  const dep = api.catalog(p.id).find((c) => c.depId === o.departureId);
  const pkg = api.packages().find((x) => x.id === o.packageId)!;
  const remaining = o.total - o.paid - o.payments.filter((x) => x.status === 'pending').reduce((a, x) => a + x.amount, 0);
  const payable = o.method !== 'financing' && ['awaiting_payment', 'payment_review'].includes(o.status) && remaining > 0;
  return (
    <div className="grid split">
      <div>
        {justCreated && (
          <Card tone="ok" title={`✅ ${t('Pesanan diterima')}`}>
            <p className="sm">{o.method === 'financing'
              ? t('Terima kasih, pesanan {0} sudah diterima. Status: menunggu proses pembiayaan. Tim Amitra akan segera menghubungi Anda.', o.code)
              : t('Terima kasih, pesanan {0} sudah diterima. Silakan selesaikan pembayaran di bawah ini; tim kami akan memverifikasi setelah bukti transfer diunggah.', o.code)}</p>
          </Card>
        )}
        <Card title={`${t('Pesanan')} ${o.code}`} right={<OrderBadge s={o.status} />}>
          <div className="sum"><span>{t('Paket')}</span><span>{t(pkg.name)}</span><span>{t('Berangkat')}</span><span>{fdate(dep?.date ?? api.state.departures.find((d) => d.id === o.departureId)?.date)}</span>
            <span>{t('Peserta')}</span><span>{o.pax}</span><span className="t">{t('Total')}</span><span className="t">{rp(o.total)}</span>
            <span>{t('Dibayar')}</span><span>{rp(o.paid)}</span></div>
          {o.holdExpires && ['awaiting_payment', 'held'].includes(o.status) && <p className="sm" style={{ marginTop: 10 }}>{t('Kursi ditahan sampai')} {fdt(o.holdExpires)} (<Countdown to={o.holdExpires} />).</p>}
          {o.status === 'expired' && <p className="mut">{t('Waktu tahan habis dan kursi dilepas. Silakan buat pesanan baru.')}</p>}
          {o.status === 'paid' && <p>{t('Pembayaran lengkap. Tim Maidaa akan memproses dokumen perjalanan Anda.')}</p>}
        </Card>
        {o.method === 'financing' && o.fin && (
          <Card title={t('Pembiayaan Amitra')} right={<Badge tone={o.fin.status === 'rejected' ? 'red' : o.fin.status === 'disbursed' || o.fin.status === 'approved' ? 'green' : 'blue'}>{t(({ submitted: 'Diajukan', docs_requested: 'Perlu dokumen', approved: 'Disetujui', rejected: 'Ditolak', disbursed: 'Dicairkan' } as Record<string, string>)[o.fin.status])}</Badge>}>
            <div className="sum"><span>{t('Tenor')}</span><span>{t('{0} bulan', o.fin.tenor)}</span><span>{t('Cicilan per bulan')}</span><span>{rp(o.fin.quote.instalment)}</span><span>{t('Pembayaran pertama')}</span><span>{rp(o.fin.quote.firstPayment)}</span><span>{t('Total biaya pembiayaan')}</span><span>{rp(o.fin.quote.totalCost)}</span></div>
            {o.fin.reason && <p className="sm" style={{ marginTop: 8 }}><b>{t('Catatan pemberi pembiayaan')}:</b> {o.fin.reason}</p>}
          </Card>)}
        {payable && (
          <Card title={t('Kirim bukti pembayaran')}>
            <p className="sm mut">{t('Transfer ke rekening Maidaa (nomor rekening resmi akan ditampilkan di sini). Lalu unggah bukti.')}</p>
            <Field label={t('Jumlah (Rp)')} hint={`${t('Sisa tagihan')}: ${rp(remaining)}`}><MoneyInput value={amount || remaining} onChange={setAmount} /></Field>
            <Field label={t('Bukti transfer')}><input type="file" accept="image/*,.pdf" onChange={(e) => setProof(e.target.files?.[0]?.name ?? '')} /></Field>
            <Button disabled={!proof} onClick={() => run(() => { const a = amount || remaining; api.submitPayment(o.id, a, a >= remaining ? 'full' : 'dp', proof); setProof(''); setAmount(0); }, 'Bukti terkirim, menunggu pemeriksaan Maidaa.')}>{t('Kirim bukti')}</Button>
          </Card>)}
        {o.payments.length > 0 && <Card title={t('Riwayat pembayaran')}>{o.payments.map((x) => <div key={x.id} className="row" style={{ justifyContent: 'space-between' }}><span>{fdt(x.at)} · {rp(x.amount)}</span><Badge tone={x.status === 'verified' ? 'green' : x.status === 'rejected' ? 'red' : 'amber'}>{t(({ pending: 'Diperiksa', verified: 'Terverifikasi', rejected: 'Ditolak' } as Record<string, string>)[x.status])}</Badge></div>)}</Card>}
      </div>
      <div>
        <Card title={t('Butuh bantuan?')}>
          <Field label={t('Pesan untuk tim')}><textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          <div className="row"><Button kind="ghost" small disabled={!note.trim()} onClick={() => run(() => { api.openTicket('support', note, o.id, p.id); setNote(''); }, 'Terkirim.')}>{t('Kirim')}</Button>
            <Button kind="danger" small onClick={() => run(() => api.openTicket('emergency', note || t('Darurat'), o.id, p.id), 'Darurat dikirim ke tim.')}>{t('Darurat')}</Button></div>
        </Card>
        {['held', 'awaiting_payment'].includes(o.status) && <Button kind="ghost" onClick={() => { if (confirm(t('Batalkan pesanan ini?'))) run(() => api.cancelOwn(o.id), 'Pesanan dibatalkan.'); }}>{t('Batalkan pesanan')}</Button>}
      </div>
    </div>
  );
}

function Orders({ p }: { p: Partner }) {
  const os = api.myOrders(p.id);
  return (
    <>
      <h2 style={{ marginBottom: 12 }}>{t('Pesanan saya')}</h2>
      {os.length === 0 ? <Empty>{t('Belum ada pesanan.')}</Empty> : os.map((o) => (
        <a key={o.id} href={`#/p/${p.slug}/o/${o.id}`} className="tile"><Card><div className="row" style={{ justifyContent: 'space-between' }}><div><b>{o.code}</b> · {t(api.packages().find((x) => x.id === o.packageId)?.name ?? '')}<div className="mut sm">{o.pax} {t('peserta')} · {rp(o.total)}</div></div><OrderBadge s={o.status} /></div></Card></a>))}
    </>
  );
}
