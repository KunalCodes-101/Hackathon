export default function ScoreRing({ score = 0, label = 'Score' }) {
  const angle = Math.max(0, Math.min(100, score)) * 3.6;
  return (
    <div className="flex items-center gap-5">
      <div
        className="grid h-32 w-32 place-items-center rounded-full"
        style={{ background: `conic-gradient(#22D3EE ${angle}deg, rgba(255,255,255,0.08) 0deg)` }}
      >
        <div className="grid h-24 w-24 place-items-center rounded-full bg-ink">
          <div className="text-center">
            <div className="text-3xl font-bold text-white">{score}</div>
            <div className="text-xs text-white/45">/100</div>
          </div>
        </div>
      </div>
      <div>
        <p className="text-sm uppercase tracking-[0.22em] text-cyan">{label}</p>
        <h2 className="mt-2 text-3xl font-bold text-white">Investor readiness</h2>
      </div>
    </div>
  );
}
