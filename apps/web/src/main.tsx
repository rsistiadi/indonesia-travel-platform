import { createRoot } from 'react-dom/client';
import './styles.css';
import { DemoBar, Toaster, useApi, useRoute } from './core.tsx';
import { Home } from './pages/Home.tsx';
import { PartnerSite } from './pages/PartnerSite.tsx';
import { PartnerAdmin } from './pages/PartnerAdmin.tsx';
import { Maidaa } from './pages/Maidaa.tsx';
import { Financier } from './pages/Financier.tsx';
import { Platform } from './pages/Platform.tsx';
import { t, missing } from './i18n.ts';

(window as unknown as { __missing: Set<string> }).__missing = missing;
function App() {
  useApi();
  const parts = useRoute().split('/').filter(Boolean);
  let page;
  if (parts[0] === 'p' && parts[1]) page = <PartnerSite slug={parts[1]} sub={parts.slice(2)} />;
  else if (parts[0] === 'admin' && parts[1]) page = <PartnerAdmin slug={parts[1]} />;
  else if (parts[0] === 'maidaa') page = <Maidaa />;
  else if (parts[0] === 'financier') page = <Financier />;
  else if (parts[0] === 'platform') page = <Platform />;
  else page = <main><Home /></main>;
  document.title = 'Indonesia Travel Platform';
  void t;
  return <><DemoBar />{page}<Toaster /></>;
}
createRoot(document.getElementById('root')!).render(<App />);
