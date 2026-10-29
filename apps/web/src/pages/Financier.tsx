import { useState } from 'react';
import { api } from '../data/api.ts';
import { Badge, Button, Card, Empty, Field, Gate, Stat, run, useApi } from '../core.tsx';
import { fdate, fdt, rp, t } from '../i18n.ts';

const LBL: Record<string, string> = { submitted: 'Diajukan', docs_requested: 'Perlu dokumen', approved: 'Disetujui', rejected: 'Ditolak', disbursed: 'Dicairkan' };
export function Financier() {
  useApi();
  return (<><div className="top"><div className="wrap"><span className="brand"><span className="dot" />{t('Portal pembiayaan')}</span></div></div>
    <main className="wrap"><Gate roles={['financier_analyst', 'maidaa_staff', 'platform_admin']}><List /></Gate></main></>);
}
function List() {
  const apps = api.finApps(); const [reason, setReason] = useState<Record<string, string>>({});
  const n = (s: string) => apps.filter((a) => a.status === s).length;
  return (
    <>
      <div className="grid g4" style={{ marginBottom: 16 }}><Stat label={t('Baru')} value={n('submitted')} /><Stat label={t('Perlu dokumen')} value={n('docs_requested')} /><Stat label={t('Disetujui')} value={n('approved')} /><Stat label={t('Dicairkan')} value={n('disbursed')} /></div>
      {apps.length === 0 ? <Empty>{t('Belum ada pengajuan.')}</Empty> : apps.map((a) => {
        const r = reason[a.id] ?? '';
        return (
          <Card key={a.id} title={`${a.code} · ${a.buyer}`} right={<Badge tone={a.status === 'rejected' ? 'red' : a.status === 'submitted' ? 'blue' : a.status === 'docs_requested' ? 'amber' : 'green'}>{t(LBL[a.status])}</Badge>}>
            <div className="grid g2">
              <div className="sum"><span>{t('Pemohon')}</span><span>{a.buyer}</span><span>{t('Nomor anggota')}</span><span>{a.memberNo || '—'}</span><span>{t('WhatsApp')}</span><span>{a.phone}</span><span>{t('Mitra')}</span><span>{a.partner}</span><span>{t('Paket')}</span><span>{t(a.pkg)} · {fdate(a.date)} · {a.pax}</span></div>
              <div className="sum"><span>{t('Nilai pembelian')}</span><span>{rp(a.total)}</span><span>{t('Tenor')}</span><span>{t('{0} bulan', a.tenor)}</span><span>{t('Pembayaran pertama')}</span><span>{rp(a.quote.firstPayment)}</span><span>{t('Cicilan per bulan')}</span><span>{rp(a.quote.instalment)}</span><span>{t('Diajukan')}</span><span>{fdt(a.at)}</span></div>
            </div>
            {a.reason && <p className="sm"><b>{t('Catatan')}:</b> {a.reason}</p>}
            {['submitted', 'docs_requested'].includes(a.status) && <>
              <Field label={t('Alasan (wajib untuk minta dokumen atau menolak)')}><input value={r} onChange={(e) => setReason({ ...reason, [a.id]: e.target.value })} /></Field>
              <div className="row"><Button onClick={() => run(() => api.decideFinancing(a.id, 'approved', r || undefined), 'Disetujui.')}>{t('Setujui')}</Button>
                {a.status === 'submitted' && <Button kind="ghost" onClick={() => run(() => api.decideFinancing(a.id, 'docs_requested', r), 'Dokumen diminta.')}>{t('Minta dokumen')}</Button>}
                <Button kind="danger" onClick={() => run(() => api.decideFinancing(a.id, 'rejected', r), 'Ditolak.')}>{t('Tolak')}</Button></div></>}
            {a.status === 'approved' && <Button onClick={() => run(() => api.decideFinancing(a.id, 'disbursed'), 'Dicairkan. Pesanan menjadi lunas.')}>{t('Tandai dicairkan')}</Button>}
          </Card>);
      })}
    </>
  );
}
