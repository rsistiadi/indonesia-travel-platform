import { useState } from 'react';
import { api } from '../data/api.ts';
import { Badge, Button, Card, Empty, Field, Gate, OrderBadge, Stat, Table, Tabs, go, run, useApi } from '../core.tsx';
import { fdate, fdt, jt, rp, t } from '../i18n.ts';
import type { Partner } from '../data/types.ts';

export function PartnerAdmin({ slug }: { slug: string }) {
  useApi();
  const p = api.partners().find((x) => x.slug === slug);
  const me = api.me();
  return (
    <div>
      <div className="top"><div className="wrap"><span className="brand"><span className="dot" />{t('Portal admin')} · {p?.name ?? slug}</span><span className="grow" /><a href={`#/p/${slug}`}>{t('Lihat situs pembeli')}</a></div></div>
      <main className="wrap">
        <Gate roles={['partner_admin']}>
          {p && me?.partnerId === p.id ? <Panel p={p} /> : <Card title={t('Bukan mitra Anda')}><p>{t('Akun ini mengelola mitra lain.')}</p><Button onClick={() => go('/')}>{t('Beranda')}</Button></Card>}
        </Gate>
      </main>
    </div>
  );
}

function Panel({ p }: { p: Partner }) {
  const [tab, setTab] = useState('orders');
  const pending = api.members(p.id).filter((m) => m.status === 'pending').length;
  const proposed = api.agreements(p.id).filter((a) => a.status === 'proposed' && !a.partnerAt).length;
  return (
    <>
      <Tabs value={tab} onChange={setTab} tabs={[['orders', 'Pesanan dan komisi'], ['members', 'Anggota', pending], ['prices', 'Harga', proposed], ['codes', 'Kode diskon'], ['settings', 'Pengaturan']]} />
      {tab === 'orders' && <Orders p={p} />}
      {tab === 'members' && <Members p={p} />}
      {tab === 'prices' && <Prices p={p} />}
      {tab === 'codes' && <Codes p={p} />}
      {tab === 'settings' && <Settings p={p} />}
    </>
  );
}

function Orders({ p }: { p: Partner }) {
  const rows = api.commissions(p.id);
  const earned = rows.filter((r) => ['paid', 'fulfilling', 'ready'].includes(r.status)).reduce((a, r) => a + r.commission, 0);
  const paidOut = rows.filter((r) => r.paidOut).reduce((a, r) => a + r.commission, 0);
  const inflight = rows.filter((r) => ['awaiting_payment', 'payment_review', 'financing_review'].includes(r.status)).length;
  return (
    <>
      <div className="grid g4" style={{ marginBottom: 16 }}>
        <Stat label={t('Pesanan')} value={rows.length} /><Stat label={t('Sedang berjalan')} value={inflight} /><Stat label={t('Komisi dari pesanan lunas')} value={jt(earned)} /><Stat label={t('Sudah dibayarkan Maidaa')} value={jt(paidOut)} />
      </div>
      {rows.some((r) => r.placeholder) && <Card tone="warn"><p className="sm">{t('Sebagian angka komisi memakai pajak sementara (placeholder) dan akan berubah setelah angka pajak resmi ditetapkan.')}</p></Card>}
      <Card title={t('Pesanan')}>
        {rows.length === 0 ? <Empty>{t('Belum ada pesanan.')}</Empty> :
          <Table head={['Kode', 'Pembeli', 'Paket', 'Berangkat', 'Total', 'Komisi', 'Status']} rows={rows.map((r) => [r.code, r.buyer, t(r.pkg), fdate(r.date), rp(r.total), <b key="c">{rp(r.commission)}{r.paidOut && <> <Badge tone="green">{t('Dibayar')}</Badge></>}</b>, <OrderBadge key="s" s={r.status} />])} />}
        <p className="sm mut">{t('Komisi dibayar oleh Maidaa setelah pembayaran penuh diterima.')}</p>
      </Card>
    </>
  );
}

function Members({ p }: { p: Partner }) {
  const ms = api.members(p.id); const [note, setNote] = useState('');
  const pend = ms.filter((m) => m.status === 'pending');
  return (
    <>
      <Card title={t('Menunggu persetujuan')}>
        {p.eligibility === 'none' && <p className="mut sm">{t('Mode pemeriksaan: tidak perlu. Siapa pun yang masuk langsung bisa memesan.')}</p>}
        {pend.length === 0 ? <Empty>{t('Tidak ada permintaan.')}</Empty> : pend.map((m) => (
          <div key={m.id} className="row" style={{ justifyContent: 'space-between', borderBottom: '1px solid var(--line)', padding: '8px 0' }}>
            <div><b>{m.name}</b> <Badge>{t(m.relation === 'member' ? 'Anggota' : 'Keluarga anggota')}</Badge><div className="mut sm">{m.memberNo || '—'} · {m.phone} · {fdt(m.at)}</div></div>
            <div className="row"><Button small onClick={() => run(() => api.decideMember(m.id, true), 'Disetujui.')}>{t('Setujui')}</Button><Button small kind="danger" onClick={() => run(() => api.decideMember(m.id, false, note || undefined), 'Ditolak.')}>{t('Tolak')}</Button></div>
          </div>))}
        {pend.length > 0 && <Field label={t('Catatan penolakan (opsional)')}><input value={note} onChange={(e) => setNote(e.target.value)} /></Field>}
      </Card>
      <Card title={t('Semua pembeli terdaftar')}>
        <Table head={['Nama', 'Nomor anggota', 'Hubungan', 'Status']} rows={ms.map((m) => [m.name, m.memberNo || '—', t(m.relation === 'member' ? 'Anggota' : 'Keluarga anggota'), <Badge key="b" tone={m.status === 'approved' ? 'green' : m.status === 'pending' ? 'amber' : 'red'}>{t(({ approved: 'Disetujui', pending: 'Menunggu', rejected: 'Ditolak', blocked: 'Diblokir' } as Record<string, string>)[m.status])}</Badge>])} />
      </Card>
    </>
  );
}

function Prices({ p }: { p: Partner }) {
  const ags = api.agreements(p.id); const pkgs = api.packages().filter((x) => x.status === 'published');
  const [pkg, setPkg] = useState(pkgs[0]?.id ?? ''); const [price, setPrice] = useState(0); const [mkt, setMkt] = useState(0);
  const [mode, setMode] = useState<'pct_of_net' | 'fixed_per_pax'>('pct_of_net'); const [pct, setPct] = useState(50); const [fixed, setFixed] = useState(0);
  const cur = ags.find((a) => a.packageId === pkg && a.status === 'live');
  const aboveMarket = mkt > 0 && price > mkt;
  return (
    <>
      <Card title={t('Harga yang berlaku')}>
        <Table head={['Paket', 'Harga jual', 'Harga pasar', 'Komisi', 'Status']} rows={ags.filter((a) => a.status === 'live' || a.status === 'proposed').map((a) => [
          t(api.packages().find((x) => x.id === a.packageId)?.name ?? ''), rp(a.price), a.marketRef ? rp(a.marketRef) : '—', a.mode === 'pct_of_net' ? `${a.pct}% ${t('dari margin bersih')}` : `${rp(a.fixed)} / ${t('orang')}`,
          a.status === 'live' ? <Badge key="l" tone="green">{t('Berlaku')}</Badge> : (
            <span key="p" className="row"><Badge tone="amber">{a.partnerAt ? t('Menunggu Maidaa') : t('Menunggu Anda')}</Badge>
              {!a.partnerAt && <><Button small onClick={() => run(() => api.confirmAgreement(a.id), 'Dikonfirmasi.')}>{t('Konfirmasi')}</Button><Button small kind="danger" onClick={() => run(() => api.rejectAgreement(a.id), 'Ditolak.')}>{t('Tolak')}</Button></>}</span>)])} />
        <p className="sm mut">{t('Harga berlaku setelah Maidaa dan Anda sama-sama mengonfirmasi. Perubahan dibuat sebagai usulan baru, riwayat lama tetap tersimpan.')}</p>
      </Card>
      <Card title={t('Usulkan harga baru')}>
        <div className="grid g2">
          <Field label={t('Paket')}><select value={pkg} onChange={(e) => setPkg(e.target.value)}>{pkgs.map((x) => <option key={x.id} value={x.id}>{t(x.name)}</option>)}</select></Field>
          <Field label={t('Harga jual per orang (Rp)')} hint={cur ? `${t('Saat ini')}: ${rp(cur.price)}` : undefined}><input type="number" value={price || ''} onChange={(e) => setPrice(+e.target.value)} /></Field>
          <Field label={t('Harga pasar sebagai acuan (Rp)')}><input type="number" value={mkt || ''} onChange={(e) => setMkt(+e.target.value)} /></Field>
          <Field label={t('Bentuk komisi')}><select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}><option value="pct_of_net">{t('Persen dari margin bersih')}</option><option value="fixed_per_pax">{t('Nominal per orang')}</option></select></Field>
          {mode === 'pct_of_net' ? <Field label={t('Bagian mitra (%)')}><input type="number" min={0} max={100} value={pct} onChange={(e) => setPct(+e.target.value)} /></Field> : <Field label={t('Komisi per orang (Rp)')}><input type="number" value={fixed || ''} onChange={(e) => setFixed(+e.target.value)} /></Field>}
        </div>
        {aboveMarket && <Card tone="warn"><p className="sm">{t('Harga ini di atas harga pasar. Pembeli mungkin membandingkan dengan penyedia lain.')}</p></Card>}
        <Button disabled={!price} onClick={() => run(() => api.proposeAgreement(p.id, pkg, price, mkt || null, mode, pct, fixed), 'Usulan dikirim ke Maidaa.')}>{t('Kirim usulan')}</Button>
      </Card>
    </>
  );
}

function Codes({ p }: { p: Partner }) {
  const cs = api.codes(p.id); const [code, setCode] = useState(''); const [mode, setMode] = useState<'idr' | 'pct'>('idr'); const [val, setVal] = useState(0); const [phone, setPhone] = useState(''); const [self, setSelf] = useState(false);
  return (
    <>
      <Card title={t('Kode diskon')}>
        <p className="sm mut">{t('Diskon diambil dari margin. Pembeli yang memakai kode miliknya sendiri mendapat diskon tetapi tidak ada komisi.')}</p>
        {cs.length === 0 ? <Empty>{t('Belum ada kode.')}</Empty> :
          <Table head={['Kode', 'Diskon', 'Pemilik', 'Boleh pakai sendiri', 'Aktif']} rows={cs.map((c) => [<b key="c">{c.code}</b>, c.mode === 'idr' ? rp(c.value) : `${c.value}%`, c.ownerPhone ?? '—', t(c.allowSelf ? 'Ya' : 'Tidak'),
            <Button key="a" small kind="ghost" onClick={() => run(() => api.saveCode(p.id, { ...c, active: !c.active }))}>{t(c.active ? 'Aktif' : 'Nonaktif')}</Button>])} />}
      </Card>
      <Card title={t('Tambah kode')}>
        <div className="grid g2">
          <Field label={t('Kode')}><input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} /></Field>
          <Field label={t('Jenis diskon')}><select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}><option value="idr">Rp</option><option value="pct">%</option></select></Field>
          <Field label={t('Nilai')}><input type="number" value={val || ''} onChange={(e) => setVal(+e.target.value)} /></Field>
          <Field label={t('WhatsApp pemilik (opsional)')}><input value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
        </div>
        <label className="row sm" style={{ marginBottom: 12 }}><input type="checkbox" style={{ width: 20, minHeight: 20 }} checked={self} onChange={(e) => setSelf(e.target.checked)} /> {t('Boleh dipakai pemiliknya sendiri')}</label>
        <Button disabled={!code || !val} onClick={() => run(() => { api.saveCode(p.id, { code, mode, value: val, ownerPhone: phone || null, allowSelf: self, active: true }); setCode(''); setVal(0); }, 'Tersimpan.')}>{t('Simpan')}</Button>
      </Card>
    </>
  );
}

function Settings({ p }: { p: Partner }) {
  const [roster, setRoster] = useState(p.roster.join('\n'));
  return (
    <Card title={t('Pemeriksaan keanggotaan')}>
      <Field label={t('Cara memeriksa pembeli')}>
        <select value={p.eligibility} onChange={(e) => run(() => api.setEligibility(p.id, e.target.value as Partner['eligibility']), 'Tersimpan.')}>
          <option value="manual">{t('Manual: admin menyetujui satu per satu')}</option><option value="roster">{t('Otomatis dari daftar anggota')}</option><option value="none">{t('Tidak perlu')}</option>
        </select>
      </Field>
      {p.eligibility === 'roster' && <>
        <Field label={t('Daftar nomor anggota (satu per baris)')} hint={t('Anggota dengan nomor di daftar langsung disetujui. Keluarga tetap diperiksa admin.')}><textarea rows={6} value={roster} onChange={(e) => setRoster(e.target.value)} /></Field>
        <Button onClick={() => run(() => api.setEligibility(p.id, 'roster', roster.split(/\s*\n\s*/).filter(Boolean)), 'Daftar tersimpan.')}>{t('Simpan daftar')}</Button></>}
    </Card>
  );
}
