import { useSyncExternalStore } from 'react';
import { EN } from './en.ts';
export type Lang = 'id' | 'en';
const KEY = 'itp.lang';
let lang: Lang = 'id';
try { const v = localStorage.getItem(KEY); if (v === 'en' || v === 'id') lang = v; } catch { /* ignore */ }
const subs = new Set<() => void>();
export const missing = new Set<string>();
export function setLang(l: Lang) { lang = l; try { localStorage.setItem(KEY, l); } catch { /* ignore */ } document.documentElement.lang = l; subs.forEach((f) => f()); }
export function useLang() { return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => lang); }
/** Indonesian is the source text; English comes from the dictionary. {0}, {1} are placeholders. */
export function t(id: string, ...v: (string | number)[]): string {
  let s = id;
  if (lang === 'en') { const e = EN[id]; if (e === undefined) missing.add(id); else s = e; }
  return v.length ? s.replace(/\{(\d)\}/g, (_, i) => String(v[+i] ?? '')) : s;
}
export const dyn = (id: string, en: string) => (lang === 'en' ? en : id);
export const loc = () => (lang === 'en' ? 'en-US' : 'id-ID');
export const rp = (n: number) => 'Rp ' + Math.round(n).toLocaleString(loc());
export const jt = (n: number) => 'Rp ' + (n / 1e6).toLocaleString(loc(), { maximumFractionDigits: 1 }) + (lang === 'en' ? ' M' : ' jt');
export const fdate = (iso: string | null | undefined) => (iso ? new Date(iso.length === 10 ? iso + 'T00:00:00' : iso).toLocaleDateString(loc(), { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const fdt = (iso: string) => new Date(iso).toLocaleString(loc(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
document.documentElement.lang = lang;
