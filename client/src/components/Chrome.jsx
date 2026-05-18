import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3 } from 'lucide-react';
import { ThemeToggle } from './ui.jsx';

const navItems = ['Home', 'Pipeline', 'Reports'];

export default function Chrome({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('founderos-theme') || 'dark');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('founderos-theme', theme);
  }, [theme]);

  return (
    <div className="min-h-screen overflow-hidden bg-ink text-white transition-colors duration-300" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="pointer-events-none fixed inset-0 opacity-70">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0,transparent_11.8%,color-mix(in_srgb,var(--color-line)_42%,transparent)_12%,transparent_12.2%,transparent_87.8%,color-mix(in_srgb,var(--color-line)_42%,transparent)_88%,transparent_88.2%),linear-gradient(color-mix(in_srgb,var(--color-line)_28%,transparent)_1px,transparent_1px)] bg-[length:100%_100%,100%_120px]" />
        <div className="absolute inset-x-0 top-36 mx-auto h-[520px] max-w-5xl bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--color-accent)_18%,transparent),transparent_62%)]" />
      </div>

      <header className="relative z-10 mx-auto flex h-24 w-full max-w-7xl items-center justify-between px-5">
        <Link to="/" className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-panel/80">
            <BarChart3 className="h-5 w-5 text-teal" />
          </div>
          <div>
            <div className="text-lg font-semibold leading-5 text-white">FounderOS</div>
            <div className="text-sm leading-5 text-muted">Validation Lab</div>
          </div>
        </Link>

        <nav className="hidden rounded-xl border border-line bg-panel/70 p-1 backdrop-blur md:flex">
          {navItems.map((item, index) => (
            <Link key={item} to="/" className={`rounded-lg px-5 py-3 text-sm transition ${index === 0 ? 'bg-raised text-white' : 'text-muted hover:text-white'}`}>
              {item}
            </Link>
          ))}
        </nav>

        <ThemeToggle theme={theme} onToggle={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))} />
      </header>

      <main className="relative z-10">{children}</main>
    </div>
  );
}
