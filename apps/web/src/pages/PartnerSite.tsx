import { useEffect, useState } from 'react';
import { api } from '../data/api.ts';
import { Badge, Button, Card, Empty, Field, OrderBadge, go, run, useApi } from '../core.tsx';
import { dyn, fdate, fdt, rp, t, jt } from '../i18n.ts';
import { Maiya } from './Maiya.tsx';
import type { Partner } from '../data/types.ts';

export function PartnerSite({ slug, sub }: { slug: string; sub: string[] }) {
  useApi();
  const p = api.partnerBySlug(slug);
  if (!p) return <div className="wrap"><Card title={t('Situs tidak ditemukan')}><p>{t('Alamat mitra ini tidak aktif.')}</p></Card></div>;
  return (
    <div style={{ ['--acc' as string]: p.color }}>
      <div className="top"><div className="wrap">
        <a className="brand" href={`#/p/${slug}`}><span className="dot" />{p.name}</a>
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
  if (sub[0] === 'order' && sub[1]) return <Checkout p={p} depId={sub[1]} />;
  if (sub[0] === 'o' && sub[1]) return <OrderPage p={p} id={sub[1]} />;
  if (sub[0] === 'orders') return <Orders p={p} />;
  return <Catalog p={p} />;
}

function SignInPrompt({ p, staffNote }: { p: Partner; staffNote: boolean }) {
  return (
    <>
      <div className="hero"><h1>{t('Umrah bersama {0}', p.name)}</h1><p>{t('Paket resmi dari Maidaa Umrah Services, dijual melalui {0}. Masuk untuk melihat harga dan memesan.', p.name)}</p></div>
      <Card title={t('Masuk')}>
        {staffNote && <p className="mut">{t('Akun yang aktif bukan akun pembeli.')}</p>}
        <p>{t('Mode contoh: pilih akun pembeli.')}</p>
        <div className="row">
          <Button onClick={() => { api.signIn('u-siti'); go('/p/idi'); }}>dr. Siti Rahma</Button>
          <Button kind="ghost" onClick={() => { api.signIn('u-andi'); go('/p/budi'); }}>Andi Pratama</Button>
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
        {onOrder && <Button onClick={onOrder} disabled={c.availability !== 'available'}>{c.availability === 'sold_out' ? t('Penuh') : t('Pesan sekarang')}</Button>}
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
      <div className="hero"><h1>{t('Pilih paket Anda')}</h1><p>{t('Harga sudah final dan disepakati antara {0} dan Maidaa. Kursi dipakai bersama semua saluran, jadi sisa kursi selalu terkini.', p.name)}</p></div>
      <div className="row" style={{ marginBottom: 14 }}>{(['all', 'umrah', 'haji'] as const).map((k) => <Button key={k} small kind={f === k ? 'primary' : 'ghost'} onClick={() => setF(k)}>{t(k === 'all' ? 'Semua' : k === 'umrah' ? 'Umrah' : 'Haji')}</Button>)}</div>
      {items.length === 0 ? <Empty>{t('Belum ada paket.')}</Empty> : <div className="grid g3">{items.map((c) => <PackageCard key={c.depId ?? c.pkg.id} c={c} onOrder={c.depId ? () => go(`/p/${p.slug}/order/${c.depId}`) : null} />)}</div>}
    </>
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
  const c = api.catalog(p.id).find((x) => x.depId === depId);
  const me = api.myMember(p.id)!;
  const [pax, setPax] = useState(1); const [codeText, setCode] = useState(''); const [method, setMethod] = useState<'transfer' | 'card' | 'financing'>('transfer'); const [tenor, setTenor] = useState(24);
  if (!c || !c.price) return <Card title={t('Keberangkatan tidak tersedia')}><Button onClick={() => go(`/p/${p.slug}`)}>{t('Kembali')}</Button></Card>;
  let q; try { q = api.buyerQuote(p.id, depId, pax, codeText, method, me.phone); } catch { q = null; }
  const fq = q && method === 'financing' ? api.financingQuote(q.total, tenor) : null;
  const left = c.left ?? 0;
  return (
    <div className="grid split">
      <Card title={t(c.pkg.name)} right={<span className="mut sm">{fdate(c.date)}</span>}>
        <div className="grid g2">
          <Field label={t('Jumlah peserta')} hint={t('Sisa {0} kursi', left)}><input type="number" min={1} max={Math.min(20, left)} value={pax} onChange={(e) => setPax(Math.max(1, Math.min(Math.min(20, left) || 1, +e.target.value || 1)))} /></Field>
          {p.allowCodes && <Field label={t('Kode diskon (opsional)')} hint={q?.codeOk === false ? t('Kode tidak berlaku di situs ini.') : q?.codeOk ? (q.self ? t('Kode Anda sendiri: diskon berlaku, komisi tidak.') : t('Kode dipakai.')) : undefined}><input value={codeText} onChange={(e) => setCode(e.target.value)} placeholder="IDI-2026" /></Field>}
        </div>
        <Field label={t('Cara pembayaran')}>
          <select value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
            <option value="transfer">{t('Transfer bank (diperiksa Maidaa)')}</option><option value="card">{t('Kartu kredit')}</option><option value="financing">{t('Pembiayaan Amitra (cicilan)')}</option>
          </select>
        </Field>
        {method === 'financing' && <Field label={t('Tenor cicilan')}><select value={tenor} onChange={(e) => setTenor(+e.target.value)}>{[12, 24, 36].map((n) => <option key={n} value={n}>{t('{0} bulan', n)}</option>)}</select></Field>}
        <Card tone="warn"><p className="sm">{t('Kursi ditahan {0} jam setelah Anda memesan. Tanpa pembayaran, kursi dilepas kembali.', api.state.settings.holdHours)}</p></Card>
      </Card>
      <Card title={t('Ringkasan')}>
        {q ? <>
          <div className="sum"><span>{t('Harga per orang')}</span><span>{rp(q.unit)}</span>
            {q.discountPerPax > 0 && <><span>{t('Diskon per orang')}</span><span>− {rp(q.discountPerPax)}</span></>}
            <span>{t('Peserta')}</span><span>× {pax}</span>
            <span className="t">{t('Total')}</span><span className="t">{rp(q.total)}</span></div>
          {q.floorHit && <p className="sm mut">{t('Diskon dibatasi agar harga tidak di bawah batas minimum.')}</p>}
          {fq && <div className="sum" style={{ marginTop: 12 }}>
            <span>{t('Uang muka')}</span><span>{rp(fq.dp)}</span><span>{t('Biaya admin')}</span><span>{rp(fq.admin)}</span><span>{t('Asuransi')}</span><span>{rp(fq.insurance)}</span>
            <span className="t">{t('Pembayaran pertama')}</span><span className="t">{rp(fq.firstPayment)}</span>
            <span>{t('Cicilan per bulan')}</span><span>{rp(fq.instalment)} × {tenor}</span>
            <span>{t('Total biaya pembiayaan')}</span><span>{rp(fq.totalCost)}</span><span>{t('Lebih mahal dari tunai')}</span><span>{rp(fq.extra)}</span></div>}
          <div style={{ marginTop: 14 }}><Button disabled={q.invalid || left < pax} onClick={() => { let id = ''; if (run(() => { id = api.placeOrder({ partnerId: p.id, departureId: depId, pax, method, codeText, tenor: method === 'financing' ? tenor : undefined }).id; }, 'Pesanan dibuat.')) go(`/p/${p.slug}/o/${id}`); }}>{t('Buat pesanan')}</Button></div>
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
  if (!o) return <Card title={t('Pesanan tidak ditemukan')}><Button onClick={() => go(`/p/${p.slug}/orders`)}>{t('Kembali')}</Button></Card>;
  const dep = api.catalog(p.id).find((c) => c.depId === o.departureId);
  const pkg = api.packages().find((x) => x.id === o.packageId)!;
  const remaining = o.total - o.paid - o.payments.filter((x) => x.status === 'pending').reduce((a, x) => a + x.amount, 0);
  const payable = o.method !== 'financing' && ['awaiting_payment', 'payment_review'].includes(o.status) && remaining > 0;
  return (
    <div className="grid split">
      <div>
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
            <Field label={t('Jumlah (Rp)')} hint={`${t('Sisa tagihan')}: ${rp(remaining)}`}><input type="number" value={amount || remaining} onChange={(e) => setAmount(+e.target.value)} /></Field>
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
        <a key={o.id} href={`#/p/${p.slug}/o/${o.id}`} className="tile"><Card><div className="row" style={{ justifyContent: 'space-between' }}><div><b>{o.code}</b> · {t(api.packages().find((x) => x.id === o.packageId)?.name ?? '')}<div className="mut sm">{o.pax} {t('peserta')} · {jt(o.total)}</div></div><OrderBadge s={o.status} /></div></Card></a>))}
    </>
  );
}
