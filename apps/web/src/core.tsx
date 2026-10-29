import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { api } from './data/api.ts';
import { setLang, t, useLang } from './i18n.ts';

let ver = 0;
api.subscribe(() => { ver++; });
export function useApi() {
  useLang();
  return useSyncExternalStore((f) => api.subscribe(f), () => ver);
}

// ---------- router (hash based, so it works on any static host) ----------
export function useRoute() {
  const get = () => (location.hash.replace(/^#/, '') || '/');
  const [r, setR] = useState(get);
  useEffect(() => { const f = () => { setR(get()); window.scrollTo(0, 0); }; window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  return r;
}
export const go = (path: string) => { location.hash = path; };

// ---------- small UI parts ----------
export function Button({ children, onClick, kind = 'primary', disabled, small, type = 'button' }: { children: ReactNode; onClick?: () => void; kind?: 'primary' | 'ghost' | 'danger' | 'soft'; disabled?: boolean; small?: boolean; type?: 'button' | 'submit' }) {
  return <button type={type} className={`btn ${kind}${small ? ' sm' : ''}`} disabled={disabled} onClick={onClick}>{children}</button>;
}
export function Card({ title, children, right, tone }: { title?: ReactNode; children: ReactNode; right?: ReactNode; tone?: 'warn' | 'ok' }) {
  return <section className={`card${tone ? ' ' + tone : ''}`}>{(title || right) && <header className="card-h"><h3>{title}</h3><div>{right}</div></header>}{children}</section>;
}
export function Badge({ tone = 'gray', children }: { tone?: 'gray' | 'green' | 'amber' | 'red' | 'blue'; children: ReactNode }) { return <span className={`badge ${tone}`}>{children}</span>; }
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="field"><span>{label}</span>{children}{hint && <em>{hint}</em>}</label>;
}
export function Empty({ children }: { children: ReactNode }) { return <p className="empty">{children}</p>; }
export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return <div className="stat"><div className="stat-l">{label}</div><div className="stat-v">{value}</div>{sub && <div className="stat-s">{sub}</div>}</div>;
}

let toastSet: ((m: { text: string; bad?: boolean } | null) => void) | null = null;
export function Toaster() {
  const [m, setM] = useState<{ text: string; bad?: boolean } | null>(null);
  toastSet = setM;
  useEffect(() => { if (m) { const id = setTimeout(() => setM(null), 4200); return () => clearTimeout(id); } }, [m]);
  return m ? <div className={`toast${m.bad ? ' bad' : ''}`} role="status">{m.text}</div> : null;
}
const ERR: Record<string, string> = {
  NOT_ALLOWED: 'Tidak diizinkan untuk akun ini.', MEMBER_NOT_ELIGIBLE: 'Keanggotaan belum disetujui.', SEATS_UNAVAILABLE: 'Kursi tidak cukup.',
  PRICE_MISMATCH: 'Harga belum disepakati untuk paket ini.', PRICE_BELOW_MINIMUM: 'Harga di bawah batas minimum yang diizinkan.', BELOW_COST: 'Harga akhir terlalu rendah.',
  CODE_NOT_VALID_HERE: 'Kode tidak berlaku di sini.', DEPARTURE_NOT_AVAILABLE: 'Keberangkatan tidak tersedia.', AMOUNT_INVALID: 'Jumlah pembayaran tidak valid.',
  REASON_REQUIRED: 'Alasan wajib diisi.', INVALID_TRANSITION: 'Perubahan status tidak diizinkan.', NOT_PENDING: 'Pembayaran sudah diproses.', NOT_PROPOSED: 'Usulan sudah diproses.',
  BELOW_SEATS_SOLD: 'Kapasitas tidak boleh di bawah kursi yang sudah terjual.', INVALID: 'Data tidak valid.', CODE_EXISTS: 'Kode sudah dipakai.', CODE_REQUIRED: 'Kode wajib diisi.',
  SLUG_EXISTS: 'Alamat sudah dipakai.', ORDER_NOT_PAYABLE: 'Pesanan tidak bisa dibayar saat ini.', FINANCING_DETAILS_REQUIRED: 'Pilih tenor pembiayaan.', PAX_INVALID: 'Jumlah peserta tidak valid.',
};
export const toast = (text: string, bad = false) => toastSet?.({ text, bad });
/** Run an action, show errors in plain words. Returns true on success. */
export function run(f: () => unknown, ok?: string): boolean {
  try { f(); if (ok) toast(t(ok)); return true; } catch (e) { const c = (e as Error).message; toast(ERR[c] ? t(ERR[c]) : t('Gagal: {0}', c), true); return false; }
}

export function LangToggle() {
  const l = useLang();
  return <div className="seg" role="group" aria-label="language"><button className={l === 'id' ? 'on' : ''} onClick={() => setLang('id')}>ID</button><button className={l === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN</button></div>;
}

const ROLE_HOME: Record<string, string> = { buyer: '/p/idi', partner_admin: '', maidaa_staff: '/maidaa', financier_analyst: '/financier', platform_admin: '/platform' };
/** Demo only: switch between the sample people to review each screen. Real sign-in replaces this. */
export function DemoBar() {
  useApi();
  const me = api.me();
  return (
    <div className="demobar">
      <strong>{t('MODE DEMO')}</strong>
      <span className="hide-sm">{t('Data contoh, tersimpan di peramban ini.')}</span>
      <select aria-label={t('Masuk sebagai')} value={me?.id ?? ''} onChange={(e) => {
        const id = e.target.value || null; api.signIn(id); const u = api.users().find((x) => x.id === id);
        if (!u) return go('/');
        if (u.role === 'partner_admin') go('/admin/' + api.partners().find((p) => p.id === u.partnerId)?.slug);
        else if (u.role === 'buyer') go(u.id === 'u-andi' ? '/p/budi' : '/p/idi');
        else go(ROLE_HOME[u.role]);
      }}>
        <option value="">{t('Belum masuk (tamu)')}</option>
        {api.users().map((u) => <option key={u.id} value={u.id}>{u.name} · {roleLabel(u.role)}</option>)}
      </select>
      <a href="#/" className="lnk">{t('Beranda')}</a>
      <button className="lnk" onClick={() => { if (confirm(t('Kembalikan semua data contoh ke awal?'))) { api.reset(); } }}>{t('Reset data')}</button>
      <LangToggle />
    </div>
  );
}
export const roleLabel = (r: string) => t(({ buyer: 'Pembeli', partner_admin: 'Admin mitra', maidaa_staff: 'Maidaa', financier_analyst: 'Pembiayaan', platform_admin: 'Platform' } as Record<string, string>)[r] ?? r);

export const STATUS: Record<string, [string, 'gray' | 'green' | 'amber' | 'red' | 'blue']> = {
  held: ['Ditahan', 'amber'], awaiting_payment: ['Menunggu pembayaran', 'amber'], payment_review: ['Pembayaran diperiksa', 'blue'], financing_review: ['Menunggu keputusan pembiayaan', 'blue'],
  paid: ['Lunas', 'green'], fulfilling: ['Diproses Maidaa', 'blue'], ready: ['Siap berangkat', 'green'], cancelled: ['Dibatalkan', 'red'], expired: ['Kedaluwarsa', 'gray'],
};
export function OrderBadge({ s }: { s: string }) { const [l, tone] = STATUS[s] ?? [s, 'gray']; return <Badge tone={tone}>{t(l)}</Badge>; }

export function Tabs({ tabs, value, onChange }: { tabs: [string, string, number?][]; value: string; onChange: (v: string) => void }) {
  return <nav className="tabs" role="tablist">{tabs.map(([k, l, n]) => <button key={k} role="tab" aria-selected={value === k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>{t(l)}{n ? <b>{n}</b> : null}</button>)}</nav>;
}
export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return <div className="tbl"><table><thead><tr>{head.map((h, i) => <th key={i}>{t(h)}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} data-l={t(head[j])}>{c}</td>)}</tr>)}</tbody></table></div>;
}
export function Gate({ roles, children }: { roles: string[]; children: ReactNode }) {
  useApi(); const me = api.me();
  if (!me || !roles.includes(me.role)) return <Card title={t('Masuk diperlukan')}><p>{t('Halaman ini untuk akun tertentu. Pilih akun contoh di bilah atas untuk melihatnya.')}</p></Card>;
  return <>{children}</>;
}
