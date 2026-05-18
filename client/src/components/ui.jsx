import { CheckCircle2, Moon, Sun } from 'lucide-react';

export function Card({ className = '', children }) {
  return <section className={`rounded-xl border border-line bg-panel surface-shadow ${className}`}>{children}</section>;
}

export function CardHeader({ title, eyebrow, action }) {
  return (
    <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{eyebrow}</p>}
        <h2 className="mt-1 text-lg font-semibold text-white">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function StatusPill({ status }) {
  const styles = {
    completed: 'border-green/25 bg-green/10 text-green',
    running: 'border-teal/25 bg-teal/10 text-teal',
    queued: 'border-line bg-raised text-muted',
    failed: 'border-danger/25 bg-danger/10 text-red-100'
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${styles[status] || styles.queued}`}>{status}</span>;
}

export function MetricCard({ label, value, icon: Icon = CheckCircle2, tone = 'text-teal' }) {
  return (
    <div className="rounded-xl border border-line bg-raised p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted">{label}</span>
        <Icon className={`h-4 w-4 ${tone}`} />
      </div>
      <div className="mt-3 font-mono text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}

export function SegmentedControl({ options, value, onChange, label }) {
  return (
    <div>
      {label && <div className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-muted">{label}</div>}
      <div className="inline-flex rounded-xl border border-line bg-raised p-1">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${value === option ? 'bg-panel text-white shadow-sm' : 'text-muted hover:text-white'}`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-2 text-sm font-medium text-white transition hover:border-teal/50"
      aria-label="Toggle color theme"
    >
      {isDark ? <Moon className="h-4 w-4 text-teal" /> : <Sun className="h-4 w-4 text-amber" />}
      {isDark ? 'Dark' : 'Light'}
    </button>
  );
}
