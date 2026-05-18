import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, ExternalLink, Loader2, Target, TriangleAlert } from 'lucide-react';
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts';
import Chrome from '../components/Chrome.jsx';
import ScoreRing from '../components/ScoreRing.jsx';
import { Card } from '../components/ui.jsx';
import { useAnalysis } from '../hooks/useAnalysis.js';
import { verdictTone } from '../utils/format.js';

export default function Report() {
  const { id } = useParams();
  const { analysis, loading, error } = useAnalysis(id);

  if (loading) {
    return (
      <Chrome>
        <div className="grid min-h-[70vh] place-items-center">
          <div className="flex items-center gap-3 rounded-md border border-line bg-panel px-4 py-3 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin text-teal" />
            Loading report
          </div>
        </div>
      </Chrome>
    );
  }

  if (error || !analysis?.report) {
    return (
      <Chrome>
        <div className="mx-auto max-w-2xl px-5 py-24 text-center">
          <h1 className="text-2xl font-semibold">Report not ready</h1>
          <p className="mt-3 text-muted">{error || 'The analysis is still running.'}</p>
          <Link className="mt-6 inline-flex rounded-full bg-teal px-4 py-3 text-sm font-semibold text-white" to={`/analysis/${id}`}>Back to live analysis</Link>
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
      <section className="space-y-5 p-4 md:p-6">
        <Link to={`/analysis/${analysis._id}`} className="inline-flex items-center gap-2 text-sm text-muted transition hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Live trace
        </Link>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
            <div className="flex flex-col gap-5 border-b border-line px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
              <ScoreRing score={report.scores.overall} />
              <div className={`rounded-md border px-5 py-4 ${verdictTone(report.verdict.label)}`}>
                <div className="text-xs uppercase tracking-[0.16em]">Verdict</div>
                <div className="mt-2 text-3xl font-semibold">{report.verdict.label}</div>
                <div className="mt-2 font-mono text-sm opacity-80">{report.verdict.confidence}% confidence</div>
              </div>
            </div>
            <div className="px-5 py-5">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">Investment memo</p>
              <h1 className="mt-2 max-w-5xl text-2xl font-semibold leading-tight text-white md:text-3xl">{analysis.idea}</h1>
              <p className="mt-5 max-w-5xl text-base leading-7 text-muted">{report.executiveSummary}</p>
              <p className="mt-4 rounded-xl border border-line bg-raised p-4 text-sm leading-6 text-muted">{report.verdict.rationale}</p>
            </div>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
            <Card className="p-5">
            <h2 className="font-semibold text-white">Score distribution</h2>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radar}>
                  <PolarGrid stroke="rgba(154,167,184,0.22)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#9AA7B8', fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: '#111722', border: '1px solid #273142', borderRadius: 8, color: '#F4F7FA' }} />
                  <Radar dataKey="score" stroke="#2DD4BF" fill="#2DD4BF" fillOpacity={0.22} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            </Card>
          </motion.div>
        </div>

        <ScoreTable scores={report.scores} />

        <div className="grid gap-5 xl:grid-cols-2">
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

        <Panel title="Competitor Breakdown" icon={ExternalLink}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-[0.14em] text-muted">
                <tr>
                  <th className="py-3 pr-4 font-medium">Company</th>
                  <th className="px-4 py-3 font-medium">Positioning</th>
                  <th className="px-4 py-3 font-medium">Strength</th>
                  <th className="px-4 py-3 font-medium">Weakness</th>
                  <th className="py-3 pl-4 font-medium">Threat</th>
                </tr>
              </thead>
              <tbody>
                {report.competitors.map((competitor) => (
                  <tr key={competitor.name} className="border-b border-line/70 align-top">
                    <td className="py-4 pr-4 font-medium text-white">{competitor.name}</td>
                    <td className="px-4 py-4 leading-6 text-muted">{competitor.positioning}</td>
                    <td className="px-4 py-4 leading-6 text-muted">{competitor.strengths}</td>
                    <td className="px-4 py-4 leading-6 text-muted">{competitor.weakness}</td>
                    <td className="py-4 pl-4"><ThreatPill level={competitor.threatLevel} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="grid gap-5 xl:grid-cols-2">
          <Panel title="Timing" icon={CheckCircle2}>
            <Info label="Why now" value={report.timing.whyNow} />
            <BulletList title="Tailwinds" items={report.timing.tailwinds} />
            <BulletList title="Headwinds" items={report.timing.headwinds} />
          </Panel>

          <Panel title="Risk Register" icon={TriangleAlert}>
            <div className="space-y-3">
              {report.risks.map((risk) => (
                <div key={risk.risk} className="rounded-xl border border-line bg-raised p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-medium text-white">{risk.risk}</h3>
                    <ThreatPill level={risk.severity} />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted">{risk.mitigation}</p>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <Panel title="Recommended Next Steps" icon={CheckCircle2}>
          <div className="grid gap-3 md:grid-cols-2">
            {report.nextSteps.map((step, index) => (
              <div key={step} className="flex gap-3 rounded-xl border border-line bg-raised p-4">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded border border-teal/30 bg-teal/10 font-mono text-xs text-teal">{index + 1}</span>
                <p className="text-sm leading-6 text-muted">{step}</p>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </Chrome>
  );
}

function ScoreTable({ scores }) {
  const rows = [
    ['Market', scores.market],
    ['Timing', scores.timing],
    ['Defensibility', scores.defensibility],
    ['Feasibility', scores.feasibility],
    ['Risk', scores.risk],
    ['Founder fit', scores.founderFit],
    ['Overall', scores.overall]
  ];

  return (
    <Card>
      <div className="border-b border-line px-5 py-4">
        <h2 className="font-semibold text-white">Scorecard</h2>
      </div>
      <div className="grid divide-y divide-line md:grid-cols-7 md:divide-x md:divide-y-0">
        {rows.map(([label, value]) => (
          <div key={label} className="px-5 py-4">
            <div className="text-xs uppercase tracking-[0.14em] text-muted">{label}</div>
            <div className="mt-2 font-mono text-2xl text-white">{value}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Panel({ title, icon: Icon, className = '', children }) {
  return (
    <motion.section initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className={`rounded-xl border border-line bg-panel p-5 surface-shadow ${className}`}>
      <div className="mb-5 flex items-center gap-2 border-b border-line pb-4">
        <Icon className="h-5 w-5 text-teal" />
        <h2 className="font-semibold text-white">{title}</h2>
      </div>
      {children}
    </motion.section>
  );
}

function Info({ label, value }) {
  return (
    <div className="border-t border-line py-4 first:border-t-0 first:pt-0">
      <div className="text-xs uppercase tracking-[0.14em] text-muted">{label}</div>
      <p className="mt-2 text-sm leading-6 text-muted">{value}</p>
    </div>
  );
}

function BulletList({ title, items = [] }) {
  return (
    <div className="border-t border-line py-4">
      <div className="text-xs uppercase tracking-[0.14em] text-muted">{title}</div>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div key={item} className="flex gap-2 text-sm leading-6 text-muted">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function ThreatPill({ level = 'Medium' }) {
  const normalized = String(level).toLowerCase();
  const style = normalized.includes('high')
    ? 'border-danger/30 bg-danger/10 text-red-100'
    : normalized.includes('low')
      ? 'border-green/30 bg-green/10 text-green'
      : 'border-amber/30 bg-amber/10 text-amber';
  return <span className={`rounded border px-2 py-1 text-xs ${style}`}>{level}</span>;
}
