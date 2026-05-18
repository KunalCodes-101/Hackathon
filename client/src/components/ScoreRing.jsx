export default function ScoreRing({ score = 0, label = 'Score' }) {
  const angle = Math.max(0, Math.min(100, score)) * 3.6;
  return (
    <div className="flex items-center gap-5">
      <div
        className="grid h-28 w-28 shrink-0 place-items-center rounded-full"
        style={{ background: `conic-gradient(var(--color-accent) ${angle}deg, color-mix(in srgb, var(--color-muted) 16%, transparent) 0deg)` }}
      >
        <div className="grid h-20 w-20 place-items-center rounded-full border border-line bg-ink">
          <div className="text-center">
            <div className="font-mono text-2xl font-semibold text-white">{score}</div>
            <div className="text-[11px] text-muted">/100</div>
          </div>
        </div>
      </div>
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-teal">{label}</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Investor readiness</h2>
      </div>
    </div>
  );
}
