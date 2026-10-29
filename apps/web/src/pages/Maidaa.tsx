import { useState } from 'react';
import { api } from '../data/api.ts';
import { Badge, Button, Card, Empty, Field, Gate, OrderBadge, Stat, Table, Tabs, run, useApi } from '../core.tsx';
import { fdate, fdt, jt, rp, t } from '../i18n.ts';

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
      <Tabs value={tab} onChange={setTab} tabs={[['pipeline', 'Penjualan'], ['payments', 'Pembayaran', pays], ['seats', 'Kursi dan harga dasar'], ['prices', 'Harga mitra', props], ['payout', 'Pembagian margin', due], ['tickets', 'Bantuan', tix]]} />
      {tab === 'pipeline' && <Pipeline />}{tab === 'payments' && <Payments />}{tab === 'seats' && <Seats />}{tab === 'prices' && <Prices />}{tab === 'payout' && <Payout />}{tab === 'tickets' && <Tickets />}
    </>
  );
}

function Pipeline() {
  const rows = api.pipeline(); const live = rows.filter((o) => !['cancelled', 'expired'].includes(o.status));
  const sum = (f: (o: (typeof rows)[number]) => number) => live.filter((o) => ['paid', 'fulfilling', 'ready'].includes(o.status)).reduce((a, o) => a + f(o), 0);
  const by = (s: string) => rows.filter((o) => o.status === s).length;
  return (
    <>
      <div className="grid g4" style={{ marginBottom: 16 }}>
        <Stat label={t('Menunggu pembayaran')} value={by('awaiting_payment')} /><Stat label={t('Perlu diperiksa')} value={by('payment_review') + by('financing_review')} />
        <Stat label={t('Penjualan lunas')} value={jt(sum((o) => o.total))} sub={`${t('Margin bersih')}: ${jt(sum((o) => o.money.net))}`} /><Stat label={t('Siap diproses')} value={by('paid') + by('fulfilling')} />
      </div>
      <Card title={t('Semua pesanan')}>
        {rows.length === 0 ? <Empty>{t('Belum ada pesanan.')}</Empty> :
          <Table head={['Kode', 'Mitra', 'Pembeli', 'Paket', 'Total', 'Margin bersih', 'Status', 'Aksi']} rows={rows.map((o) => [
            <b key="c">{o.code}</b>, o.partnerName, o.buyer, `${t(o.pkgName)} · ${fdate(o.date)} · ${o.pax}`, rp(o.total), <span key="m" className={o.money.net < 0 ? 'bad' : ''}>{rp(o.money.net)}{o.money.placeholder && ' *'}</span>, <OrderBadge key="s" s={o.status} />,
            <span key="a" className="row">
              {o.status === 'paid' && <Button small onClick={() => run(() => api.advanceOrder(o.id, 'fulfilling'), 'Diproses.')}>{t('Mulai proses')}</Button>}
              {o.status === 'fulfilling' && <Button small onClick={() => run(() => api.advanceOrder(o.id, 'ready'), 'Siap berangkat.')}>{t('Tandai siap')}</Button>}
              {['awaiting_payment', 'payment_review', 'financing_review', 'paid', 'fulfilling'].includes(o.status) && <Button small kind="ghost" onClick={() => { if (confirm(t('Batalkan pesanan ini?'))) run(() => api.advanceOrder(o.id, 'cancelled'), 'Pesanan dibatalkan.'); }}>{t('Batalkan')}</Button>}
              {o.holdExpires && ['awaiting_payment'].includes(o.status) && <span className="mut sm">{t('tahan sampai')} {fdt(o.holdExpires)}</span>}</span>])} />}
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
          <Field label={t('Harga dasar per orang (Rp)')}><input type="number" value={nh || ''} onChange={(e) => setNh(+e.target.value)} /></Field>
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
        <Field label={t('Harga dasar per orang (Rp)')}><input type="number" value={hpp} onChange={(e) => setHpp(+e.target.value)} /></Field>
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
          <Field label={t('Harga jual per orang (Rp)')}><input type="number" value={price || ''} onChange={(e) => setPrice(+e.target.value)} /></Field>
          <Field label={t('Harga pasar sebagai acuan (Rp)')}><input type="number" value={mkt || ''} onChange={(e) => setMkt(+e.target.value)} /></Field>
          <Field label={t('Bentuk komisi')}><select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}><option value="pct_of_net">{t('Persen dari margin bersih')}</option><option value="fixed_per_pax">{t('Nominal per orang')}</option></select></Field>
          {mode === 'pct_of_net' ? <Field label={t('Bagian mitra (%)')}><input type="number" value={pct} onChange={(e) => setPct(+e.target.value)} /></Field> : <Field label={t('Komisi per orang (Rp)')}><input type="number" value={fixed || ''} onChange={(e) => setFixed(+e.target.value)} /></Field>}
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
