import { useState } from 'react';
import { api } from '../data/api.ts';
import { rp, t, fdate } from '../i18n.ts';
import { run } from '../core.tsx';

/** Mockup of the assistant panel. Scripted answers only: the real AI comes in a later phase. */
export function Maiya({ pid, partnerName }: { pid: string; partnerName: string }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<{ me: boolean; text: string }[]>([]);
  const [text, setText] = useState('');
  const reply = (q: string): string => {
    const s = q.toLowerCase(); const cat = api.catalog(pid).filter((c) => c.availability !== 'coming_soon');
    if (/harga|price|biaya|berapa|cost/.test(s)) return cat.length ? cat.map((c) => `${t(c.pkg.name)}: ${c.price ? rp(c.price) : '—'} (${fdate(c.date)})`).join('\n') : t('Harga belum tersedia.');
    if (/kursi|seat|sisa|available|tersedia/.test(s)) return cat.map((c) => `${t(c.pkg.name)} ${fdate(c.date)}: ${t('{0} kursi', c.left ?? 0)}`).join('\n');
    if (/bayar|payment|transfer|cicil|financ|amitra|angsur/.test(s)) return t('Pembayaran bisa transfer (diperiksa Maidaa) atau pembiayaan Amitra. Pembiayaan menampilkan uang muka, cicilan, dan total biaya sebelum Anda memesan.');
    if (/dokumen|paspor|passport|visa|document/.test(s)) return t('Siapkan paspor yang berlaku minimal 8 bulan. Tim Maidaa akan memandu dokumen lain setelah pembayaran.');
    if (/batal|refund|cancel/.test(s)) return t('Kebijakan pembatalan masih disusun bersama Maidaa. Silakan hubungi tim kami lewat tombol di bawah.');
    if (/haji|hajj/.test(s)) return t('Haji khusus segera hadir. Informasi menyusul.');
    return t('Saya Maiya, asisten {0}. Saya bisa membantu soal harga, kursi, pembayaran, dan dokumen. Ini masih contoh jawaban otomatis, belum AI sungguhan.', partnerName);
  };
  const send = (q: string) => { if (!q.trim()) return; setMsgs((m) => [...m, { me: true, text: q }, { me: false, text: reply(q) }]); setText(''); };
  const human = () => run(() => { api.openTicket('support', msgs.filter((m) => m.me).map((m) => m.text).join(' | ') || t('Minta dihubungi'), null, pid); }, 'Permintaan dikirim ke tim.');
  if (!open) return <button className="btn primary maiya-fab" onClick={() => setOpen(true)}>💬 {t('Tanya Maiya')}</button>;
  return (
    <aside className="maiya" aria-label="Maiya">
      <header><strong>Maiya</strong><button className="btn ghost sm" onClick={() => setOpen(false)}>{t('Tutup')}</button></header>
      <div className="msgs">
        {!msgs.length && <div className="bub">{t('Assalamualaikum! Ada yang bisa saya bantu?')}</div>}
        {msgs.map((m, i) => <div key={i} className={`bub${m.me ? ' me' : ''}`}>{m.text}</div>)}
      </div>
      <div className="chips">{['Berapa harga paket?', 'Sisa kursi', 'Cara bayar', 'Dokumen'].map((c) => <button key={c} onClick={() => send(t(c))}>{t(c)}</button>)}<button onClick={human}>{t('Hubungi tim')}</button></div>
      <form onSubmit={(e) => { e.preventDefault(); send(text); }}><input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('Tulis pertanyaan')} aria-label={t('Tulis pertanyaan')} /><button className="btn primary" type="submit">{t('Kirim')}</button></form>
    </aside>
  );
}
