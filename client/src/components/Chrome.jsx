import { Link } from 'react-router-dom';
import { Activity, Sparkles } from 'lucide-react';

export default function Chrome({ children }) {
  return (
    <div className="min-h-screen overflow-hidden bg-ink text-white">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(139,92,246,0.22),transparent_38%),radial-gradient(ellipse_at_bottom_right,rgba(34,211,238,0.14),transparent_34%),linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[length:100%_100%,100%_100%,72px_72px,72px_72px]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan/50 to-transparent" />
      </div>

      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5">
        <Link to="/" className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/10 shadow-glow backdrop-blur">
            <Sparkles className="h-5 w-5 text-cyan" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-wide text-white">FounderOS</div>
            <div className="text-xs text-white/45">Autonomous validation lab</div>
          </div>
        </Link>
        <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm text-white/70 backdrop-blur md:flex">
          <Activity className="h-4 w-4 text-cyan" />
          8-agent diligence engine
        </div>
      </header>

      <main className="relative z-10">{children}</main>
    </div>
  );
}
