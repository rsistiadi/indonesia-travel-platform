import { useState } from 'react';
import { api } from '../data/api.ts';
import { Badge, Button, Card, Empty, Field, Gate, MoneyInput, OrderBadge, Stat, Table, Tabs, run, useApi } from '../core.tsx';
import { fdate, fdt, rp, t } from '../i18n.ts';

export function Maidaa() {
  useApi();
  return (
    <>
      <div className="top"><div className="wrap"><span className="brand"><span className="dot" />{t('Konsol Maidaa')}</span></div></div>
      <main className="wrap"><Gate roles={['maidaa_staff', 'platform_admin']}><Console /></Gate></main>
    </>
  );
}

function Console() {
  const [tab, setTab] = useState('pipeline');
  const pays = api.paymentsAll().filter((p) => p.status === 'pending').length;
  const props = api.agreements().filter((a) => a.status === 'proposed' && !a.maidaaAt).length;
  const tix = api.tickets().filter((x) => x.status === 'open').length;
  const due = api.ledgerAll().filter((l) => l.status === 'pending').length;
  return (
    <>
      <Tabs value={tab} onChange={setTab} tabs={[['pipeline', 'Penjualan'], ['payments', 'Pembayaran', pays], ['packages', 'Paket'], ['seats', 'Kursi dan harga dasar'], ['prices', 'Harga mitra', props], ['payout', 'Pembagian margin', due], ['tickets', 'Bantuan', tix]]} />
      {tab === 'pipeline' && <Pipeline />}{tab === 'payments' && <Payments />}{tab === 'packages' && <Packages />}{tab === 'seats' && <Seats />}{tab === 'prices' && <Prices />}{tab === 'payout' && <Payout />}{tab === 'tickets' && <Tickets />}
    </>
  );
}

function Pipeline() {
  const rows = api.pipeline();
  const active = rows.filter((o) => !['cancelled', 'expired'].includes(o.status));
  const confirmed = active.filter((o) => ['paid', 'fulfilling', 'ready'].includes(o.status));
  const needsAction = active.filter((o) => ['paid', 'payment_review', 'financing_review'].includes(o.status));
  const sum = (f: (o: (typeof rows)[number]) => number) => confirmed.reduce((a, o) => a + f(o), 0);
  const by = (s: string) => rows.filter((o) => o.status === s).length;
  const rev = sum((o) => o.total);
  const net = sum((o) => o.money.net);
  const partnerTotal = sum((o) => o.money.partnerPayout);
  const platformTotal = sum((o) => o.money.platformShare);

  return (
    <>
      {/* KPI row */}
      <div className="grid g4" style={{ marginBottom: 16 }}>
        <Stat label={t('Penjualan lunas')} value={rp(rev)} sub={`${active.length} ${t('aktif')}`} />
        <Stat label={t('Margin bersih')} value={rp(net)} sub={`HPP: ${rp(sum((o) => o.money.hppTotal))}`} />
        <Stat label={t('Komisi mitra (total)')} value={rp(partnerTotal)} sub={`${t('Platform')}: ${rp(platformTotal)}`} />
        <Stat label={t('Perlu tindakan')} value={needsAction.length} sub={`${t('Menunggu bayar')}: ${by('awaiting_payment')}`} />
      </div>

      {/* Urgent actions card */}
      {needsAction.length > 0 && (
        <Card title={`⚡ ${t('Perlu tindakan sekarang')}`}>
          <Table head={['Kode', 'Mitra', 'Pembeli', 'Paket', 'Total', 'Status', 'Aksi']} rows={needsAction.map((o) => [
            <b key="c">{o.code}</b>, o.partnerName, o.buyer, `${t(o.pkgName)} · ${fdate(o.date)} · ${o.pax}p`, rp(o.total),
            <OrderBadge key="s" s={o.status} />,
            <span key="a" className="row">
              {o.status === 'paid' && <Button small onClick={() => run(() => api.advanceOrder(o.id, 'fulfilling'), 'Diproses.')}>{t('Mulai proses')}</Button>}
              {['awaiting_payment', 'payment_review', 'financing_review', 'paid'].includes(o.status) && <Button small kind="ghost" onClick={() => { if (confirm(t('Batalkan pesanan ini?'))) run(() => api.advanceOrder(o.id, 'cancelled'), 'Pesanan dibatalkan.'); }}>{t('Batalkan')}</Button>}
            </span>])} />
        </Card>
      )}

      {/* Full order table */}
      <Card title={t('Semua pesanan')}>
        {rows.length === 0 ? <Empty>{t('Belum ada pesanan.')}</Empty> :
          <Table head={['Kode', 'Mitra', 'Pembeli', 'Paket', 'Total', 'Net', 'Mitra', 'Status', 'Aksi']} rows={rows.map((o) => [
            <b key="c">{o.code}</b>, o.partnerName, o.buyer, `${t(o.pkgName)} · ${fdate(o.date)} · ${o.pax}p`, rp(o.total),
            <span key="m" className={o.money.net < 0 ? 'bad' : ''}>{rp(o.money.net)}{o.money.placeholder && ' *'}</span>,
            <span key="p" className="mut">{rp(o.money.partnerPayout)}</span>,
            <OrderBadge key="s" s={o.status} />,
            <span key="a" className="row">
              {o.status === 'paid' && <Button small onClick={() => run(() => api.advanceOrder(o.id, 'fulfilling'), 'Diproses.')}>{t('Mulai proses')}</Button>}
              {o.status === 'fulfilling' && <Button small onClick={() => run(() => api.advanceOrder(o.id, 'ready'), 'Siap berangkat.')}>{t('Tandai siap')}</Button>}
              {['awaiting_payment', 'payment_review', 'financing_review', 'paid', 'fulfilling'].includes(o.status) && <Button small kind="ghost" onClick={() => { if (confirm(t('Batalkan pesanan ini?'))) run(() => api.advanceOrder(o.id, 'cancelled'), 'Pesanan dibatalkan.'); }}>{t('Batalkan')}</Button>}
              {o.holdExpires && ['awaiting_payment'].includes(o.status) && <span className="mut sm">{fdt(o.holdExpires)}</span>}
            </span>])} />}
        <p className="sm mut">* {t('Memakai pajak sementara (placeholder).')}</p>
      </Card>
    </>
  );
}

function Payments() {
  const ps = api.paymentsAll(); const pend = ps.filter((p) => p.status === 'pending'); const [note, setNote] = useState('');
  return (
    <>
      <Card title={t('Menunggu verifikasi')}>
        {pend.length === 0 ? <Empty>{t('Tidak ada pembayaran yang menunggu.')}</Empty> : pend.map((p) => (
          <div key={p.id} className="row" style={{ justifyContent: 'space-between', borderBottom: '1px solid var(--line)', padding: '8px 0' }}>
            <div><b>{p.order.code}</b> · {rp(p.amount)} <span className="mut sm">({t('tagihan')} {rp(p.order.total)})</span><div className="mut sm">📎 {p.proof} · {fdt(p.at)}</div></div>
            <div className="row"><Button small onClick={() => run(() => api.verifyPayment(p.id, true), 'Pembayaran diverifikasi.')}>{t('Terima')}</Button><Button small kind="danger" onClick={() => run(() => api.verifyPayment(p.id, false, note || undefined), 'Pembayaran ditolak.')}>{t('Tolak')}</Button></div>
          </div>))}
        {pend.length > 0 && <Field label={t('Alasan penolakan (opsional)')}><input value={note} onChange={(e) => setNote(e.target.value)} /></Field>}
      </Card>
      <Card title={t('Riwayat')}><Table head={['Waktu', 'Pesanan', 'Jumlah', 'Status']} rows={ps.filter((p) => p.status !== 'pending').map((p) => [fdt(p.at), p.order.code, rp(p.amount), <Badge key="b" tone={p.status === 'verified' ? 'green' : 'red'}>{t(p.status === 'verified' ? 'Terverifikasi' : 'Ditolak')}</Badge>])} /></Card>
    </>
  );
}

function Seats() {
  const deps = api.departuresAll(); const pkgs = api.packages().filter((p) => p.status === 'published');
  const [np, setNp] = useState(pkgs[0]?.id ?? ''); const [nd, setNd] = useState(''); const [nc, setNc] = useState(40); const [nh, setNh] = useState(0);
  return (
    <>
      <Card title={t('Keberangkatan')}>
        <p className="sm mut">{t('Satu stok untuk semua saluran. Isi "terjual di luar platform" untuk kursi yang Maidaa jual sendiri.')}</p>
        {deps.map((d) => <DepRow key={d.id} d={d} />)}
      </Card>
      <Card title={t('Tambah keberangkatan')}>
        <div className="grid g4">
          <Field label={t('Paket')}><select value={np} onChange={(e) => setNp(e.target.value)}>{pkgs.map((p) => <option key={p.id} value={p.id}>{t(p.name)}</option>)}</select></Field>
          <Field label={t('Tanggal berangkat')}><input type="date" value={nd} onChange={(e) => setNd(e.target.value)} /></Field>
          <Field label={t('Kapasitas')}><input type="number" value={nc} onChange={(e) => setNc(+e.target.value)} /></Field>
          <Field label={t('Harga dasar per orang (Rp)')}><MoneyInput value={nh} onChange={setNh} /></Field>
        </div>
        <Button disabled={!nd || !nh} onClick={() => run(() => { api.addDeparture(np, nd, nc, nh); setNd(''); }, 'Keberangkatan ditambahkan.')}>{t('Tambah')}</Button>
      </Card>
    </>
  );
}
function DepRow({ d }: { d: ReturnType<typeof api.departuresAll>[number] }) {
  const [cap, setCap] = useState(d.capacity); const [out, setOut] = useState(d.soldOutside); const [hpp, setHpp] = useState(d.hpp);
  return (
    <div style={{ borderBottom: '1px solid var(--line)', padding: '10px 0' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}><b>{t(d.pkg.name)} · {fdate(d.date)}</b><span className="sm">{t('Terpakai')} {d.taken} · {t('Sisa')} <b>{d.left}</b> <Badge tone={d.status === 'open' ? 'green' : 'gray'}>{t(d.status === 'open' ? 'Buka' : 'Tutup')}</Badge></span></div>
      <div className="grid g4" style={{ marginTop: 8 }}>
        <Field label={t('Kapasitas')}><input type="number" value={cap} onChange={(e) => setCap(+e.target.value)} /></Field>
        <Field label={t('Terjual di luar platform')}><input type="number" value={out} onChange={(e) => setOut(+e.target.value)} /></Field>
        <Field label={t('Harga dasar per orang (Rp)')}><MoneyInput value={hpp} onChange={setHpp} /></Field>
        <div className="row" style={{ alignItems: 'flex-end' }}><Button small onClick={() => run(() => api.saveDeparture(d.id, { capacity: cap, soldOutside: out, hpp }), 'Tersimpan.')}>{t('Simpan')}</Button>
          <Button small kind="ghost" onClick={() => run(() => api.saveDeparture(d.id, { status: d.status === 'open' ? 'closed' : 'open' }))}>{t(d.status === 'open' ? 'Tutup penjualan' : 'Buka penjualan')}</Button></div>
      </div>
    </div>
  );
}

function Prices() {
  const ags = api.agreements(); const partners = api.partners(); const pkgs = api.packages().filter((p) => p.status === 'published');
  const [pid, setPid] = useState(partners[0].id); const [pkg, setPkg] = useState(pkgs[0]?.id ?? ''); const [price, setPrice] = useState(0); const [mkt, setMkt] = useState(0);
  const [mode, setMode] = useState<'pct_of_net' | 'fixed_per_pax'>('pct_of_net'); const [pct, setPct] = useState(50); const [fixed, setFixed] = useState(0);
  const pv = api.previewMargin(pkg, price, mode, pct, fixed);
  const name = (id: string) => partners.find((p) => p.id === id)?.name; const pk = (id: string) => t(api.packages().find((p) => p.id === id)?.name ?? '');
  return (
    <>
      <Card title={t('Kesepakatan harga')}>
        <Table head={['Mitra', 'Paket', 'Harga jual', 'Komisi', 'Status', 'Aksi']} rows={ags.filter((a) => ['live', 'proposed'].includes(a.status)).map((a) => [name(a.partnerId), pk(a.packageId), rp(a.price), a.mode === 'pct_of_net' ? `${a.pct}%` : rp(a.fixed),
          a.status === 'live' ? <Badge key="s" tone="green">{t('Berlaku')}</Badge> : <Badge key="s" tone="amber">{a.maidaaAt ? t('Menunggu mitra') : t('Menunggu Maidaa')}</Badge>,
          a.status === 'proposed' && !a.maidaaAt ? <span key="a" className="row"><Button small onClick={() => run(() => api.confirmAgreement(a.id), 'Dikonfirmasi.')}>{t('Konfirmasi')}</Button><Button small kind="danger" onClick={() => run(() => api.rejectAgreement(a.id), 'Ditolak.')}>{t('Tolak')}</Button></span> : '']) } />
      </Card>
      <Card title={t('Usulkan harga untuk mitra')}>
        <div className="grid g3">
          <Field label={t('Mitra')}><select value={pid} onChange={(e) => setPid(e.target.value)}>{partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
          <Field label={t('Paket')}><select value={pkg} onChange={(e) => setPkg(e.target.value)}>{pkgs.map((p) => <option key={p.id} value={p.id}>{t(p.name)}</option>)}</select></Field>
          <Field label={t('Harga jual per orang (Rp)')}><MoneyInput value={price} onChange={setPrice} /></Field>
          <Field label={t('Harga pasar sebagai acuan (Rp)')}><MoneyInput value={mkt} onChange={setMkt} /></Field>
          <Field label={t('Bentuk komisi')}><select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}><option value="pct_of_net">{t('Persen dari margin bersih')}</option><option value="fixed_per_pax">{t('Nominal per orang')}</option></select></Field>
          {mode === 'pct_of_net' ? <Field label={t('Bagian mitra (%)')}><input type="number" value={pct} onChange={(e) => setPct(+e.target.value)} /></Field> : <Field label={t('Komisi per orang (Rp)')}><MoneyInput value={fixed} onChange={setFixed} /></Field>}
        </div>
        {pv && <div className="sum" style={{ marginBottom: 12 }}><span>{t('Margin kotor per orang')}</span><span>{rp(pv.gross)}</span><span>{t('Biaya dan pajak')}</span><span>{rp(pv.fee + pv.taxTotal)}</span><span>{t('Margin bersih')}</span><span>{rp(pv.net)}</span><span>{t('Bagian mitra')}</span><span>{rp(pv.partnerShare)}</span><span className="t">{t('Bagian platform')}</span><span className="t">{rp(pv.platformShare)}</span></div>}
        {pv?.invalid && <p className="sm bad">{t('Harga ini membuat margin negatif.')}</p>}
        <Button disabled={!price} onClick={() => run(() => api.proposeAgreement(pid, pkg, price, mkt || null, mode, pct, fixed), 'Usulan dikirim ke mitra.')}>{t('Kirim usulan')}</Button>
      </Card>
    </>
  );
}

function Payout() {
  const ls = api.ledgerAll();
  return (
    <Card title={t('Pembagian margin')}>
      <p className="sm mut">{t('Dicatat otomatis ketika Maidaa sudah memegang pembayaran penuh. Maidaa membayarkan bagian mitra, lalu menandai dibayar.')}</p>
      {ls.length === 0 ? <Empty>{t('Belum ada pembagian.')}</Empty> :
        <Table head={['Pesanan', 'Penerima', 'Jumlah', 'Status', 'Aksi']} rows={ls.map((l) => [l.order.code, l.partnerName, <b key="a">{rp(l.amount)}</b>, <Badge key="s" tone={l.status === 'paid' ? 'green' : 'amber'}>{t(l.status === 'paid' ? 'Dibayar' : 'Menunggu')}</Badge>, l.status === 'pending' && l.party === 'partner' ? <Button key="b" small onClick={() => run(() => api.payLedger(l.id), 'Ditandai dibayar.')}>{t('Tandai dibayar')}</Button> : ''])} />}
    </Card>
  );
}

const OCC_LABELS: Record<string, string> = { quad: 'Quad (4)', triple: 'Triple (3)', double: 'Double (2)', single: 'Single (1)' };
const STATUS_FLOW: Record<string, string> = { draft: 'coming_soon', coming_soon: 'published', published: 'draft' };
const STATUS_LABEL: Record<string, string> = { draft: 'Draft', coming_soon: 'Segera hadir', published: 'Dipublikasi' };
const STATUS_TONE: Record<string, 'gray' | 'amber' | 'green'> = { draft: 'gray', coming_soon: 'amber', published: 'green' };

function PkgForm({ initial, onSave, onCancel }: { initial?: Partial<import('../data/types.ts').Pkg>; onSave: (p: Partial<import('../data/types.ts').Pkg>) => void; onCancel: () => void }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [category, setCategory] = useState<'umrah' | 'holyland' | 'haji'>(initial?.category ?? 'umrah');
  const [cls, setCls] = useState(initial?.cls ?? 'economy');
  const [days, setDays] = useState(String(initial?.days ?? '9'));
  const [summaryId, setSummaryId] = useState(initial?.summaryId ?? '');
  const [summaryEn, setSummaryEn] = useState(initial?.summaryEn ?? '');
  const [includes, setIncludes] = useState((initial?.includes ?? []).join('\n'));
  const [excludes, setExcludes] = useState((initial?.excludes ?? []).join('\n'));
  const [departureCity, setDepartureCity] = useState(initial?.departureCity ?? '');
  // Occupancy
  type OccRow = { type: string; basePrice: string };
  const initOcc: OccRow[] = (initial?.occupancy ?? []).map((o) => ({ type: o.type, basePrice: String(o.basePrice) }));
  if (!initOcc.length) initOcc.push({ type: 'quad', basePrice: '' }, { type: 'triple', basePrice: '' }, { type: 'double', basePrice: '' }, { type: 'single', basePrice: '' });
  const [occs, setOccs] = useState<OccRow[]>(initOcc);
  // Add-ons
  type AoRow = { nameId: string; nameEn: string; price: string; perPerson: boolean };
  const [addOns, setAddOns] = useState<AoRow[]>((initial?.addOns ?? []).map((a) => ({ nameId: a.nameId, nameEn: a.nameEn, price: String(a.price), perPerson: a.perPerson })));
  // Cancellation
  type CxRow = { minDays: string; maxDays: string; pct: string };
  const [cancels, setCancels] = useState<CxRow[]>((initial?.cancellation ?? []).map((c) => ({ minDays: String(c.minDays), maxDays: c.maxDays != null ? String(c.maxDays) : '', pct: String(c.pct) })));

  const submit = () => {
    if (!name.trim()) return alert(t('Nama paket wajib diisi.'));
    const occupancy = occs.filter((o) => o.basePrice.trim()).map((o) => ({ type: o.type as import('../data/types.ts').OccupancyType, basePrice: Number(o.basePrice) }));
    const aos = addOns.filter((a) => a.nameId.trim()).map((a, i) => ({ id: initial?.addOns?.[i]?.id ?? `ao-${Date.now()}-${i}`, nameId: a.nameId, nameEn: a.nameEn, price: Number(a.price), perPerson: a.perPerson }));
    const cxs = cancels.filter((c) => c.pct.trim()).map((c) => ({ minDays: Number(c.minDays), maxDays: c.maxDays.trim() ? Number(c.maxDays) : null, pct: Number(c.pct) }));
    onSave({ ...initial, name: name.trim(), category, cls: cls.trim(), days: Number(days) || 9, summaryId: summaryId.trim(), summaryEn: summaryEn.trim(), includes: includes.split('\n').map((s) => s.trim()).filter(Boolean), excludes: excludes.split('\n').map((s) => s.trim()).filter(Boolean), departureCity: departureCity.trim() || undefined, occupancy, addOns: aos, cancellation: cxs });
  };

  return (
    <div className="pkg-form">
      <div className="pkg-form-grid">
        <Field label={t('Nama paket')}><input className="inp" value={name} onChange={(e) => setName(e.target.value)} placeholder="Umrah Ramadan 2027 *" /></Field>
        <Field label={t('Kategori')}>
          <select className="inp" value={category} onChange={(e) => setCategory(e.target.value as typeof category)}>
            <option value="umrah">Umrah</option><option value="holyland">Holy Land</option><option value="haji">Haji</option>
          </select>
        </Field>
        <Field label={t('Kelas')}><input className="inp" value={cls} onChange={(e) => setCls(e.target.value)} placeholder="economy / business / vip" /></Field>
        <Field label={t('Durasi (hari)')}><input className="inp" type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)} /></Field>
        <Field label={t('Kota keberangkatan')}><input className="inp" value={departureCity} onChange={(e) => setDepartureCity(e.target.value)} placeholder="Jakarta" /></Field>
      </div>
      <Field label={t('Ringkasan (Indonesia)')}><textarea className="inp" rows={2} value={summaryId} onChange={(e) => setSummaryId(e.target.value)} /></Field>
      <Field label={t('Ringkasan (English)')}><textarea className="inp" rows={2} value={summaryEn} onChange={(e) => setSummaryEn(e.target.value)} /></Field>
      <Field label={t('Termasuk (satu baris satu)')}><textarea className="inp" rows={4} value={includes} onChange={(e) => setIncludes(e.target.value)} placeholder={'Tiket pesawat PP\nAkomodasi hotel bintang 5\nVisa umrah'} /></Field>
      <Field label={t('Tidak termasuk (opsional)')}><textarea className="inp" rows={2} value={excludes} onChange={(e) => setExcludes(e.target.value)} placeholder={'Pengeluaran pribadi\nObat-obatan'} /></Field>

      <p className="sm" style={{ fontWeight: 600, marginTop: 12, marginBottom: 6 }}>{t('Kamar (harga dasar HPP per orang)')}</p>
      <div className="pkg-occ-grid">
        {occs.map((o, i) => (
          <Field key={o.type} label={OCC_LABELS[o.type] ?? o.type}>
            <input className="inp" type="number" min={0} value={o.basePrice} onChange={(e) => setOccs((prev) => prev.map((x, j) => j === i ? { ...x, basePrice: e.target.value } : x))} placeholder="0" />
          </Field>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, marginBottom: 6 }}>
        <p className="sm" style={{ fontWeight: 600 }}>{t('Layanan tambahan (add-on)')}</p>
        <Button small kind="ghost" onClick={() => setAddOns((p) => [...p, { nameId: '', nameEn: '', price: '', perPerson: true }])}>{t('+ Tambah')}</Button>
      </div>
      {addOns.length === 0 && <p className="sm mut">{t('Belum ada add-on.')}</p>}
      {addOns.map((a, i) => (
        <div key={i} className="pkg-addon-row">
          <input className="inp sm" value={a.nameId} onChange={(e) => setAddOns((p) => p.map((x, j) => j === i ? { ...x, nameId: e.target.value } : x))} placeholder={t('Nama (Indonesia)')} />
          <input className="inp sm" value={a.nameEn} onChange={(e) => setAddOns((p) => p.map((x, j) => j === i ? { ...x, nameEn: e.target.value } : x))} placeholder="Name (English)" />
          <input className="inp sm" type="number" min={0} value={a.price} onChange={(e) => setAddOns((p) => p.map((x, j) => j === i ? { ...x, price: e.target.value } : x))} placeholder="0" />
          <label className="row sm"><input type="checkbox" checked={a.perPerson} onChange={(e) => setAddOns((p) => p.map((x, j) => j === i ? { ...x, perPerson: e.target.checked } : x))} /> {t('per orang')}</label>
          <button className="comm-expand-btn" onClick={() => setAddOns((p) => p.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, marginBottom: 6 }}>
        <p className="sm" style={{ fontWeight: 600 }}>{t('Kebijakan pembatalan')}</p>
        <Button small kind="ghost" onClick={() => setCancels((p) => [...p, { minDays: '', maxDays: '', pct: '' }])}>{t('+ Tambah')}</Button>
      </div>
      {cancels.length === 0 && <p className="sm mut">{t('Belum ada kebijakan.')}</p>}
      {cancels.map((c, i) => (
        <div key={i} className="pkg-cx-row">
          <Field label={t('Min hari')}><input className="inp sm" type="number" value={c.minDays} onChange={(e) => setCancels((p) => p.map((x, j) => j === i ? { ...x, minDays: e.target.value } : x))} placeholder="0" /></Field>
          <Field label={t('Max hari (kosong = tak terbatas)')}><input className="inp sm" type="number" value={c.maxDays} onChange={(e) => setCancels((p) => p.map((x, j) => j === i ? { ...x, maxDays: e.target.value } : x))} placeholder={t('Tak terbatas')} /></Field>
          <Field label={t('% biaya batal')}><input className="inp sm" type="number" value={c.pct} onChange={(e) => setCancels((p) => p.map((x, j) => j === i ? { ...x, pct: e.target.value } : x))} placeholder="0" /></Field>
          <button className="comm-expand-btn" style={{ alignSelf: 'flex-end', marginBottom: 4 }} onClick={() => setCancels((p) => p.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}

      <div className="row" style={{ marginTop: 16, justifyContent: 'flex-end', gap: 8 }}>
        <Button kind="ghost" onClick={onCancel}>{t('Batal')}</Button>
        <Button onClick={submit}>{initial?.id ? t('Simpan perubahan') : t('Buat paket')}</Button>
      </div>
    </div>
  );
}

function Packages() {
  const pkgs = api.packages();
  const [editing, setEditing] = useState<string | null>(null); // pkg id or 'new'
  const editPkg = pkgs.find((p) => p.id === editing);

  const advanceStatus = (p: import('../data/types.ts').Pkg) => {
    const next = STATUS_FLOW[p.status] as import('../data/types.ts').Pkg['status'];
    if (next === 'published') { if (!confirm(t('Publikasikan paket ini? Mitra bisa melihat dan menjual.'))) return; }
    if (next === 'draft') { if (!confirm(t('Kembalikan ke draft? Paket tidak akan tampil ke mitra.'))) return; }
    run(() => api.savePackage({ id: p.id, status: next }), `Status diubah ke ${STATUS_LABEL[next]}.`);
  };

  if (editing === 'new' || (editing && editPkg)) {
    return (
      <Card title={editing === 'new' ? t('Paket baru') : `${t('Edit')} · ${editPkg!.name}`}>
        <PkgForm
          initial={editPkg}
          onSave={(data) => run(() => api.savePackage(data), editing === 'new' ? 'Paket dibuat.' : 'Paket diperbarui.')}
          onCancel={() => setEditing(null)}
        />
      </Card>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Button onClick={() => setEditing('new')}>{t('+ Paket baru')}</Button>
      </div>
      {pkgs.length === 0 ? (
        <Card><Empty>{t('Belum ada paket. Buat paket pertama Anda.')}</Empty></Card>
      ) : (
        <div className="pkg-list">
          {pkgs.map((p) => (
            <Card key={p.id}>
              <div className="pkg-card-header">
                <div>
                  <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700 }}>{p.name}</span>
                    <Badge tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</Badge>
                    <Badge tone="gray">{p.category.toUpperCase()}</Badge>
                    <span className="mut sm">{p.days} hari · {p.cls}</span>
                  </div>
                  {p.summaryId && <p className="sm mut" style={{ marginTop: 4 }}>{p.summaryId}</p>}
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <Button small kind="ghost" onClick={() => setEditing(p.id)}>{t('Edit')}</Button>
                  <Button small kind={p.status === 'published' ? 'ghost' : 'primary'} onClick={() => advanceStatus(p)}>
                    {p.status === 'draft' ? t('→ Segera hadir') : p.status === 'coming_soon' ? t('→ Publikasikan') : t('→ Draft')}
                  </Button>
                </div>
              </div>
              {(p.occupancy?.length ?? 0) > 0 && (
                <div className="pkg-occ-summary">
                  {p.occupancy!.map((o) => (
                    <span key={o.type} className="pkg-occ-chip"><span className="mut">{OCC_LABELS[o.type]}</span> {rp(o.basePrice)}</span>
                  ))}
                </div>
              )}
              {(p.addOns?.length ?? 0) > 0 && (
                <p className="sm mut" style={{ marginTop: 4 }}>{p.addOns!.length} {t('add-on')} · {p.addOns!.map((a) => a.nameId).join(', ')}</p>
              )}
              {(p.includes?.length ?? 0) > 0 && (
                <details style={{ marginTop: 6 }}>
                  <summary className="sm" style={{ cursor: 'pointer', color: 'var(--acc)' }}>{t('Lihat termasuk')} ({p.includes.length})</summary>
                  <ul className="sm mut" style={{ margin: '4px 0 0 16px', padding: 0 }}>{p.includes.map((s, i) => <li key={i}>{s}</li>)}</ul>
                </details>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function Tickets() {
  const ts = api.tickets();
  return (
    <Card title={t('Permintaan bantuan')}>
      {ts.length === 0 ? <Empty>{t('Tidak ada permintaan.')}</Empty> : ts.map((x) => (
        <div key={x.id} className="row" style={{ justifyContent: 'space-between', borderBottom: '1px solid var(--line)', padding: '8px 0' }}>
          <div><Badge tone={x.kind === 'emergency' ? 'red' : 'gray'}>{t(x.kind === 'emergency' ? 'Darurat' : 'Bantuan')}</Badge> <b>{x.by}</b><div className="sm">{x.body}</div><div className="mut sm">{fdt(x.at)}</div></div>
          {x.status === 'open' ? <Button small onClick={() => run(() => api.closeTicket(x.id), 'Selesai.')}>{t('Selesai')}</Button> : <Badge tone="green">{t('Selesai')}</Badge>}
        </div>))}
    </Card>
  );
}
