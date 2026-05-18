import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, ExternalLink, Loader2, Target, TriangleAlert } from 'lucide-react';
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts';
import Chrome from '../components/Chrome.jsx';
import ScoreRing from '../components/ScoreRing.jsx';
import { useAnalysis } from '../hooks/useAnalysis.js';
import { verdictTone } from '../utils/format.js';

export default function Report() {
  const { id } = useParams();
  const { analysis, loading, error } = useAnalysis(id);

  if (loading) {
    return (
      <Chrome>
        <div className="grid min-h-[70vh] place-items-center">
          <Loader2 className="h-8 w-8 animate-spin text-cyan" />
        </div>
      </Chrome>
    );
  }

  if (error || !analysis?.report) {
    return (
      <Chrome>
        <div className="mx-auto max-w-2xl px-5 py-24 text-center">
          <h1 className="text-3xl font-bold">Report not ready</h1>
          <p className="mt-3 text-white/55">{error || 'The analysis is still running.'}</p>
          <Link className="mt-6 inline-flex rounded-md bg-white px-4 py-3 text-sm font-semibold text-ink" to={`/analysis/${id}`}>Back to live analysis</Link>
        </div>
      </Chrome>
    );
  }

  const { report } = analysis;
  const radar = [
    ['Market', report.scores.market],
    ['Timing', report.scores.timing],
    ['Defensibility', report.scores.defensibility],
    ['Feasibility', report.scores.feasibility],
    ['Risk', report.scores.risk],
    ['Founder fit', report.scores.founderFit]
  ].map(([subject, score]) => ({ subject, score }));

  return (
    <Chrome>
      <section className="mx-auto w-full max-w-7xl px-5 pb-16 pt-8">
        <Link to={`/analysis/${analysis._id}`} className="inline-flex items-center gap-2 text-sm text-white/55 transition hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Live trace
        </Link>

        <div className="mt-6 grid gap-6 lg:grid-cols-[0.68fr_0.32fr]">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg border border-white/10 bg-white/[0.055] p-6 backdrop-blur-xl">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <ScoreRing score={report.scores.overall} />
              <div className={`rounded-lg border px-5 py-4 ${verdictTone(report.verdict.label)}`}>
                <div className="text-xs uppercase tracking-[0.24em]">Verdict</div>
                <div className="mt-2 text-4xl font-extrabold">{report.verdict.label}</div>
                <div className="mt-2 text-sm opacity-80">{report.verdict.confidence}% confidence</div>
              </div>
            </div>
            <h1 className="mt-8 text-3xl font-bold leading-tight text-white md:text-5xl">{analysis.idea}</h1>
            <p className="mt-5 max-w-4xl text-lg leading-8 text-white/62">{report.executiveSummary}</p>
            <p className="mt-4 rounded-lg border border-white/10 bg-black/20 p-4 text-sm leading-6 text-white/58">{report.verdict.rationale}</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="rounded-lg border border-white/10 bg-panel/70 p-5 backdrop-blur-xl">
            <h2 className="font-semibold text-white">Score radar</h2>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radar}>
                  <PolarGrid stroke="rgba(255,255,255,0.14)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(255,255,255,0.62)', fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: '#0D1021', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8 }} />
                  <Radar dataKey="score" stroke="#22D3EE" fill="#8B5CF6" fillOpacity={0.35} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Panel title="Market Analysis" icon={Target}>
            <Info label="Size" value={report.marketAnalysis.size} />
            <Info label="Audience" value={report.marketAnalysis.audience} />
            <Info label="Growth" value={report.marketAnalysis.growth} />
            <Info label="Willingness to pay" value={report.marketAnalysis.willingnessToPay} />
          </Panel>

          <Panel title="Technical Feasibility" icon={CheckCircle2}>
            <Info label="Complexity" value={report.technicalFeasibility.complexity} />
            <Info label="Stack" value={report.technicalFeasibility.stackRecommendation} />
            <BulletList title="MVP scope" items={report.technicalFeasibility.mvpScope} />
            <BulletList title="Build risks" items={report.technicalFeasibility.buildRisks} />
          </Panel>
        </div>

        <Panel title="Competitor Breakdown" icon={ExternalLink} className="mt-6">
          <div className="grid gap-4 lg:grid-cols-3">
            {report.competitors.map((competitor) => (
              <div key={competitor.name} className="rounded-lg border border-white/10 bg-black/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold text-white">{competitor.name}</h3>
                  <span className="rounded-full bg-white/10 px-2 py-1 text-xs text-white/55">{competitor.threatLevel}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-white/55">{competitor.positioning}</p>
                <p className="mt-3 text-sm leading-6 text-white/55"><span className="text-white/80">Strength:</span> {competitor.strengths}</p>
                <p className="mt-2 text-sm leading-6 text-white/55"><span className="text-white/80">Weakness:</span> {competitor.weakness}</p>
              </div>
            ))}
          </div>
        </Panel>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Panel title="Timing" icon={CheckCircle2}>
            <Info label="Why now" value={report.timing.whyNow} />
            <BulletList title="Tailwinds" items={report.timing.tailwinds} />
            <BulletList title="Headwinds" items={report.timing.headwinds} />
          </Panel>

          <Panel title="Risk Register" icon={TriangleAlert}>
            <div className="space-y-3">
              {report.risks.map((risk) => (
                <div key={risk.risk} className="rounded-lg border border-white/10 bg-black/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold text-white">{risk.risk}</h3>
                    <span className="rounded-full bg-rose-300/10 px-2 py-1 text-xs text-rose-100">{risk.severity}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-white/55">{risk.mitigation}</p>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <Panel title="Recommended Next Steps" icon={CheckCircle2} className="mt-6">
          <div className="grid gap-3 md:grid-cols-2">
            {report.nextSteps.map((step, index) => (
              <div key={step} className="flex gap-3 rounded-lg border border-white/10 bg-black/20 p-4">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-cyan/10 text-sm font-semibold text-cyan">{index + 1}</span>
                <p className="text-sm leading-6 text-white/60">{step}</p>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </Chrome>
  );
}

function Panel({ title, icon: Icon, className = '', children }) {
  return (
    <motion.section initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className={`rounded-lg border border-white/10 bg-white/[0.055] p-5 backdrop-blur-xl ${className}`}>
      <div className="mb-5 flex items-center gap-2">
        <Icon className="h-5 w-5 text-cyan" />
        <h2 className="text-lg font-semibold text-white">{title}</h2>
      </div>
      {children}
    </motion.section>
  );
}

function Info({ label, value }) {
  return (
    <div className="border-t border-white/10 py-4 first:border-t-0 first:pt-0">
      <div className="text-xs uppercase tracking-[0.2em] text-white/35">{label}</div>
      <p className="mt-2 text-sm leading-6 text-white/62">{value}</p>
    </div>
  );
}

function BulletList({ title, items = [] }) {
  return (
    <div className="border-t border-white/10 py-4">
      <div className="text-xs uppercase tracking-[0.2em] text-white/35">{title}</div>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div key={item} className="flex gap-2 text-sm leading-6 text-white/60">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" />
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
