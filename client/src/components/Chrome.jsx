import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, LogOut, UserRound } from 'lucide-react';
import { ThemeToggle } from './ui.jsx';
import { useAuth } from '../auth.jsx';

const navItems = [
  ['Home', '/'],
  ['History', '/history'],
  ['Jobs', '/jobs']
];

export default function Chrome({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('founderos-theme') || 'dark');
  const { user, signOut } = useAuth();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('founderos-theme', theme);
  }, [theme]);

  return (
    <div className="min-h-screen overflow-hidden bg-ink text-white transition-colors duration-300" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="interactive-bg pointer-events-none fixed inset-0">
        <div className="mesh-grid" />
        <div className="aurora aurora-one" />
        <div className="aurora aurora-two" />
        <div className="signal-orbit orbit-a" />
        <div className="signal-orbit orbit-b" />
        <div className="floating-node node-a" />
        <div className="floating-node node-b" />
        <div className="floating-node node-c" />
      </div>

      <header className="relative z-10 mx-auto flex h-24 w-full max-w-7xl items-center justify-between px-5">
        <Link to="/" className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg border border-line bg-panel/80 shadow-focus backdrop-blur">
            <BarChart3 className="h-5 w-5 text-teal" />
          </div>
          <div>
            <div className="text-lg font-semibold leading-5 text-white">FounderOS</div>
            <div className="text-sm leading-5 text-muted">Validation Lab</div>
          </div>
        </Link>

        <nav className="hidden rounded-lg border border-line bg-panel/70 p-1 backdrop-blur md:flex">
          {navItems.map(([item, to]) => (
            <Link key={item} to={to} className="rounded-lg px-5 py-3 text-sm text-muted transition hover:bg-raised hover:text-white">
              {item}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <button
              type="button"
              onClick={signOut}
              className="inline-flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-2 text-sm font-medium text-white transition hover:border-teal/50"
            >
              <UserRound className="h-4 w-4 text-teal" />
              {user.name}
              <LogOut className="h-4 w-4 text-muted" />
            </button>
          ) : (
            <Link to="/signin" className="inline-flex rounded-full border border-line bg-panel px-3 py-2 text-sm font-medium text-white transition hover:border-teal/50">
              Sign in
            </Link>
          )}
          <ThemeToggle theme={theme} onToggle={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))} />
        </div>
      </header>

      <main className="relative z-10">{children}</main>
    </div>
  );
}
