import { useState } from 'react';
import { api } from '../data/api.ts';
import { Badge, Button, Card, Empty, Field, Gate, Table, Tabs, run, useApi } from '../core.tsx';
import { fdt, t } from '../i18n.ts';
import type { TaxRuleRow } from '../data/types.ts';

export function Platform() {
  useApi();
  return (<><div className="top"><div className="wrap"><span className="brand"><span className="dot" />{t('Admin platform')}</span></div></div>
    <main className="wrap"><Gate roles={['platform_admin']}><Panel /></Gate></main></>);
}
function Panel() {
  const [tab, setTab] = useState('tax');
  return (<><Tabs value={tab} onChange={setTab} tabs={[['tax', 'Pajak'], ['fees', 'Biaya dan aturan'], ['partners', 'Mitra'], ['audit', 'Catatan audit']]} />
    {tab === 'tax' && <Tax />}{tab === 'fees' && <Fees />}{tab === 'partners' && <Partners />}{tab === 'audit' && <Audit />}</>);
}

function Tax() {
  const rules = api.taxRules();
  const blank: Omit<TaxRuleRow, 'id'> = { name: '', taxType: 'PPN', taxClass: null, base: 'margin', ratePct: 0, from: new Date().toISOString().slice(0, 10), to: null, status: 'draft', placeholder: true, note: '' };
  const [f, setF] = useState<Omit<TaxRuleRow, 'id'> & { id?: string }>(blank);
  return (
    <>
      <Card tone="warn"><p className="sm">{t('Aturan pajak adalah data. Saat pemerintah mengubah tarif, buat aturan baru dengan tanggal berlaku; pesanan lama menyimpan salinan aturan yang dipakainya. Angka di bawah masih sementara sampai dikonfirmasi.')}</p></Card>
      <Card title={t('Aturan pajak')}>
        <Table head={['Nama', 'Jenis', 'Dasar', 'Tarif', 'Berlaku', 'Status']} rows={rules.map((r) => [<span key="n"><b>{r.name}</b>{r.placeholder && <> <Badge tone="amber">{t('Sementara')}</Badge></>}<div className="mut sm">{r.note}</div></span>, r.taxType, t(({ billed_amount: 'Jumlah ditagih', margin: 'Margin', commission: 'Komisi' } as Record<string, string>)[r.base]), `${r.ratePct}%`, `${r.from} → ${r.to ?? '…'}`,
          <span key="s" className="row"><Badge tone={r.status === 'active' ? 'green' : 'gray'}>{t(({ draft: 'Draf', active: 'Aktif', retired: 'Nonaktif' } as Record<string, string>)[r.status])}</Badge><Button small kind="ghost" onClick={() => setF(r)}>{t('Ubah')}</Button></span>])} />
      </Card>
      <Card title={f.id ? t('Ubah aturan') : t('Aturan baru')}>
        <div className="grid g3">
          <Field label={t('Nama')}><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label={t('Jenis pajak')}><input value={f.taxType} onChange={(e) => setF({ ...f, taxType: e.target.value })} /></Field>
          <Field label={t('Dasar perhitungan')}><select value={f.base} onChange={(e) => setF({ ...f, base: e.target.value as TaxRuleRow['base'] })}><option value="billed_amount">{t('Jumlah ditagih')}</option><option value="margin">{t('Margin')}</option><option value="commission">{t('Komisi')}</option></select></Field>
          <Field label={t('Tarif (%)')}><input type="number" step="0.001" value={f.ratePct} onChange={(e) => setF({ ...f, ratePct: +e.target.value })} /></Field>
          <Field label={t('Berlaku mulai')}><input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
          <Field label={t('Berlaku sampai (opsional)')}><input type="date" value={f.to ?? ''} onChange={(e) => setF({ ...f, to: e.target.value || null })} /></Field>
          <Field label={t('Kelas produk (kosong = semua)')}><select value={f.taxClass ?? ''} onChange={(e) => setF({ ...f, taxClass: e.target.value || null })}><option value="">{t('Semua')}</option><option value="pure_umrah">{t('Umrah murni')}</option><option value="mixed">{t('Umrah dan kunjungan tambahan')}</option></select></Field>
          <Field label={t('Status')}><select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as TaxRuleRow['status'] })}><option value="draft">{t('Draf')}</option><option value="active">{t('Aktif')}</option><option value="retired">{t('Nonaktif')}</option></select></Field>
          <Field label={t('Catatan sumber')}><input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        </div>
        <label className="row sm" style={{ marginBottom: 12 }}><input type="checkbox" style={{ width: 20, minHeight: 20 }} checked={f.placeholder} onChange={(e) => setF({ ...f, placeholder: e.target.checked })} /> {t('Tarif sementara (belum dikonfirmasi)')}</label>
        <div className="row"><Button onClick={() => run(() => { api.saveTax(f); setF(blank); }, 'Tersimpan.')}>{t('Simpan')}</Button>{f.id && <Button kind="ghost" onClick={() => setF(blank)}>{t('Batal')}</Button>}</div>
      </Card>
    </>
  );
}

function Fees() {
  const s = api.settings(); const [v, setV] = useState({ ...s });
  const num = (k: 'transfer' | 'cardPct' | 'financingPool' | 'holdHours' | 'dpPct' | 'adminFee', l: string) => <Field label={t(l)}><input type="number" step="any" value={v[k]} onChange={(e) => setV({ ...v, [k]: +e.target.value })} /></Field>;
  return (
    <Card title={t('Biaya dan aturan')}>
      <div className="grid g3">
        {num('transfer', 'Biaya transfer (Rp)')}{num('cardPct', 'Biaya kartu (%)')}{num('financingPool', 'Biaya pembiayaan ke margin (Rp)')}{num('holdHours', 'Lama tahan kursi (jam)')}{num('dpPct', 'Uang muka pembiayaan (%)')}{num('adminFee', 'Biaya admin pembiayaan (Rp)')}
      </div>
      <Button onClick={() => run(() => api.saveSettings(v), 'Tersimpan.')}>{t('Simpan')}</Button>
    </Card>
  );
}

function Partners() {
  const ps = api.partners(); const [name, setName] = useState(''); const [slug, setSlug] = useState(''); const [kind, setKind] = useState<'organization' | 'individual'>('organization');
  return (
    <>
      <Card title={t('Mitra')}>
        <Table head={['Nama', 'Alamat situs', 'Jenis', 'Status']} rows={ps.map((p) => [p.name, <a key="a" href={`#/p/${p.slug}`}>/p/{p.slug}</a>, t(p.kind === 'organization' ? 'Organisasi' : 'Perorangan'), <Button key="b" small kind="ghost" onClick={() => run(() => api.setPartnerActive(p.id, !p.active))}>{t(p.active ? 'Aktif' : 'Nonaktif')}</Button>])} />
      </Card>
      <Card title={t('Tambah mitra')}>
        <div className="grid g3"><Field label={t('Nama')}><input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label={t('Alamat situs')} hint="a-z, 0-9, -"><input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} /></Field>
          <Field label={t('Jenis')}><select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}><option value="organization">{t('Organisasi')}</option><option value="individual">{t('Perorangan')}</option></select></Field></div>
        <Button disabled={!name || !slug} onClick={() => run(() => { api.addPartner(name, slug, kind); setName(''); setSlug(''); }, 'Mitra ditambahkan.')}>{t('Tambah')}</Button>
      </Card>
    </>
  );
}

function Audit() {
  const a = api.auditLog();
  return <Card title={t('Catatan audit')}>{a.length === 0 ? <Empty>{t('Belum ada catatan.')}</Empty> : <Table head={['Waktu', 'Pelaku', 'Tindakan', 'Rincian']} rows={a.slice(0, 150).map((r) => [fdt(r.at), r.actor, r.action, r.detail])} />}</Card>;
}
