import { Card } from '../core.tsx';
import { t } from '../i18n.ts';
import { api } from '../data/api.ts';

export function Home() {
  const sites: [string, string, string][] = [
    ['#/p/idi', 'Situs mitra: Primkop IDI', 'Pembeli (anggota IDI dan keluarga) memilih paket, memesan, dan membayar.'],
    ['#/p/budi', 'Situs mitra: dr. Budi', 'Contoh mitra perorangan dengan harga dan komisi sendiri.'],
    ['#/admin/idi', 'Portal admin mitra', 'Mitra menyetujui anggota, mengatur harga bersama Maidaa, dan melihat komisi.'],
    ['#/maidaa', 'Konsol Maidaa', 'Pemantauan penjualan, verifikasi pembayaran, kursi, harga dasar, dan pembagian margin.'],
    ['#/financier', 'Portal mitra pembiayaan', 'Amitra memeriksa dan memutuskan pengajuan pembiayaan.'],
    ['#/platform', 'Admin platform', 'Pajak, biaya, mitra, dan catatan audit.'],
  ];
  return (
    <div className="wrap">
      <div className="hero"><h1>Indonesia Travel Platform</h1><p>{t('Satu sistem, beberapa situs sesuai peran. Gunakan bilah hitam di atas untuk berganti akun contoh dan melihat tiap layar. Semua data di sini hanya contoh.')}</p></div>
      <div className="grid g3">
        {sites.map(([h, ti, d]) => <a key={h} href={h} className="tile"><Card title={t(ti)}><p className="mut">{t(d)}</p></Card></a>)}
      </div>
      <Card title={t('Cara meninjau')}>
        <ol>
          <li>{t('Pilih "dr. Siti Rahma" di bilah atas, buka situs Primkop IDI, lalu pesan paket.')}</li>
          <li>{t('Pilih "Admin Primkop IDI" untuk menyetujui anggota baru dan melihat komisi.')}</li>
          <li>{t('Pilih "Tim Maidaa" untuk memverifikasi pembayaran dan melihat pembagian margin.')}</li>
          <li>{t('Pilih "Analis Amitra" untuk memutuskan pembiayaan.')}</li>
        </ol>
        <button className="btn ghost sm" onClick={() => { api.signIn('u-siti'); location.hash = '/p/idi'; }}>{t('Mulai sebagai pembeli')}</button>
      </Card>
    </div>
  );
}
