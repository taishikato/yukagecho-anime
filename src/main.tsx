import { createRoot } from 'react-dom/client';
import App from './App';
import './global.css';
import { initAnalytics } from './lib/analytics';

initAnalytics();

if (import.meta.env.DEV) {
  // @ts-expect-error StyleX exposes this virtual module through its Vite plugin.
  void import('virtual:stylex:runtime');
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/virtual:stylex.css';
  document.head.append(link);
}

createRoot(document.getElementById('root')!).render(<App />);
