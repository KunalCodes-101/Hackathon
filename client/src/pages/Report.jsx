import { Link, useParams } from 'react-router-dom';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, ArrowLeft, BarChart3, CheckCircle2, Download, ExternalLink, Layers3, Loader2, ShieldCheck, Target, TriangleAlert } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Chrome from '../components/Chrome.jsx';
import ScoreRing from '../components/ScoreRing.jsx';
import { Card } from '../components/ui.jsx';
import { useAnalysis } from '../hooks/useAnalysis.js';
import { useAuth } from '../auth.jsx';
import { approveStartup } from '../api.js';
import { cleanList, cleanText, formatNumber, formatPercent, verdictTone } from '../utils/format.js';

export default function Report() {
  const { id } = useParams();
  const { analysis, loading, error } = useAnalysis(id);
  const { user } = useAuth();
  const [approval, setApproval] = useState({ loading: false, message: '' });

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
  const scores = report.scores || {};
  const competitors = Array.isArray(report.competitors) ? report.competitors : [];
  const risks = Array.isArray(report.risks) ? report.risks : [];
  const nextSteps = cleanList(report.nextSteps);
  const reviewGaps = Array.isArray(report.reviewGaps) ? report.reviewGaps : [];
  const radar = [
    ['Market', scores.market],
    ['Timing', scores.timing],
    ['Defensibility', scores.defensibility],
    ['Feasibility', scores.feasibility],
    ['Risk', scores.risk],
    ['Founder fit', scores.founderFit]
  ].map(([subject, score]) => ({ subject, score: Number(score) || 0 }));
  const highThreatCount = competitors.filter((competitor) => String(competitor.threatLevel || '').toLowerCase().includes('high')).length;
  const budgetPlan = report.budgetPlan || {};
  const budgetCategories = Array.isArray(budgetPlan.categories) ? budgetPlan.categories.filter((item) => Number(item.amount) > 0) : [];
  const threatData = ['High', 'Medium', 'Low'].map((level) => ({
    level,
    count: competitors.filter((competitor) => String(competitor.threatLevel || '').toLowerCase().includes(level.toLowerCase())).length
  }));
  const marketSignalData = buildMarketSignalData(report);

  async function handleApprove() {
    if (!user) {
      setApproval({ loading: false, message: 'Sign in as a founder to approve this startup and open jobs.' });
      return;
    }
    setApproval({ loading: true, message: '' });
    try {
      const result = await approveStartup(analysis._id);
      setApproval({ loading: false, message: `${result.jobs?.length || 0} job openings generated for this approved startup.` });
    } catch (err) {
      setApproval({ loading: false, message: err.response?.data?.error || err.message });
    }
  }

  return (
    <Chrome>
      <section className="space-y-5 p-4 md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link to={`/analysis/${analysis._id}`} className="inline-flex items-center gap-2 text-sm text-muted transition hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Live trace
          </Link>
          <button
            type="button"
            onClick={() => downloadReport(analysis)}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-panel px-4 py-3 text-sm font-semibold text-white transition hover:border-teal"
          >
            <Download className="h-4 w-4 text-teal" />
            Download report
          </button>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <div className="flex flex-col gap-5 border-b border-line px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
                <ScoreRing score={scores.overall} />
                <div className={`rounded-lg border px-5 py-4 ${verdictTone(report.verdict?.label)}`}>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em]">Verdict</div>
                  <div className="mt-2 text-3xl font-semibold">{cleanText(report.verdict?.label, 'PIVOT')}</div>
                  <div className="mt-2 font-mono text-sm opacity-80">{formatPercent(report.verdict?.confidence)} confidence</div>
                </div>
              </div>
              <div className="px-5 py-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">Investment memo</p>
                <h1 className="mt-2 max-w-5xl text-2xl font-semibold leading-tight text-white md:text-3xl">{cleanText(analysis.idea)}</h1>
                <p className="mt-5 max-w-5xl text-base leading-7 text-muted">{cleanText(report.executiveSummary)}</p>
                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <SummaryMetric icon={BarChart3} label="Overall score" value={formatNumber(scores.overall)} />
                  <SummaryMetric icon={Layers3} label="Competitors found" value={formatNumber(competitors.length)} />
                  <SummaryMetric icon={TriangleAlert} label="High threats" value={formatNumber(highThreatCount)} />
                </div>
                <p className="mt-4 rounded-lg border border-line bg-raised p-4 text-sm leading-6 text-muted">{cleanText(report.verdict?.rationale)}</p>
                <div className="mt-4 flex flex-col gap-3 rounded-lg border border-line bg-raised p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="font-semibold text-white">Approve startup</h2>
                    <p className="mt-1 text-sm leading-6 text-muted">Approval generates required hiring roles from this market report.</p>
                    {approval.message && <p className="mt-2 text-sm text-teal">{approval.message}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={approval.loading}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {approval.loading ? 'Approving' : 'Approve startup'}
                  </button>
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
            <Card className="p-5">
              <h2 className="font-semibold text-white">Score distribution</h2>
              <p className="mt-2 text-sm leading-6 text-muted">A quick read of the strongest and weakest signals across the validation model.</p>
              <div className="mt-4 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radar}>
                    <PolarGrid stroke="color-mix(in srgb, var(--color-muted) 22%, transparent)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--color-muted)', fontSize: 12 }} />
                    <Tooltip contentStyle={{ background: 'var(--color-panel)', border: '1px solid var(--color-line)', borderRadius: 8, color: 'var(--color-text)' }} />
                    <Radar dataKey="score" stroke="var(--color-accent)" fill="var(--color-accent)" fillOpacity={0.24} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </motion.div>
        </div>

        <ScoreTable scores={scores} />

        {!!budgetCategories.length && <BudgetPanel budgetPlan={budgetPlan} />}

        <div className="grid gap-5 xl:grid-cols-2">
          <Panel title="Market Analysis" icon={Target}>
            <div className="mb-5 h-64 rounded-lg border border-line bg-raised p-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={marketSignalData}>
                  <CartesianGrid stroke="color-mix(in srgb, var(--color-muted) 16%, transparent)" vertical={false} />
                  <XAxis dataKey="signal" tick={{ fill: 'var(--color-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: 'var(--color-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(value) => [`${formatNumber(value)}/100`, 'Signal strength']}
                    contentStyle={{ background: 'var(--color-panel)', border: '1px solid var(--color-line)', borderRadius: 8, color: 'var(--color-text)' }}
                  />
                  <Bar dataKey="score" name="Signal strength" fill="var(--color-accent)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <Info label="Size" value={report.marketAnalysis?.size} />
            <Info label="Audience" value={report.marketAnalysis?.audience} />
            <Info label="Growth" value={report.marketAnalysis?.growth} />
            <Info label="Willingness to pay" value={report.marketAnalysis?.willingnessToPay} />
          </Panel>

          <Panel title="Technical Feasibility" icon={ShieldCheck}>
            <Info label="Complexity" value={report.technicalFeasibility?.complexity} />
            <Info label="Stack" value={report.technicalFeasibility?.stackRecommendation} />
            <BulletList title="MVP scope" items={report.technicalFeasibility?.mvpScope} />
            <BulletList title="Build risks" items={report.technicalFeasibility?.buildRisks} />
          </Panel>
        </div>

        <Panel title="Competitor Breakdown" icon={ExternalLink}>
          {competitors.some((competitor) => competitor.source) && (
            <p className="mb-4 text-xs uppercase tracking-[0.14em] text-muted">
              Sources: {Array.from(new Set(competitors.map((competitor) => formatCompetitorSource(competitor.source)).filter(Boolean))).join(', ')}
            </p>
          )}
          <div className="hidden overflow-x-auto lg:block">
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
                {competitors.map((competitor) => (
                  <tr key={competitor.name} className="border-b border-line/70 align-top">
                    <td className="py-4 pr-4 font-medium text-white">
                      {competitor.sourceUrl ? (
                        <a className="inline-flex items-center gap-1 text-white transition hover:text-teal" href={competitor.sourceUrl} target="_blank" rel="noreferrer">
                          {cleanText(competitor.name, 'Unnamed competitor')}
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : cleanText(competitor.name, 'Unnamed competitor')}
                      {competitor.source && <div className="mt-2 text-xs uppercase tracking-[0.12em] text-muted">{formatCompetitorSource(competitor.source)}</div>}
                      {(competitor.rating || competitor.reviewCount) && (
                        <div className="mt-2 text-xs text-muted">
                          {competitor.rating ? `${formatNumber(competitor.rating)} stars` : ''}
                          {competitor.rating && competitor.reviewCount ? ' / ' : ''}
                          {competitor.reviewCount ? `${formatNumber(competitor.reviewCount)} reviews` : ''}
                        </div>
                      )}
                      {competitor.reviewSummaryUrl && (
                        <a className="mt-2 inline-flex text-xs text-teal hover:text-white" href={competitor.reviewSummaryUrl} target="_blank" rel="noreferrer">
                          Google reviews
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-4 leading-6 text-muted">
                      {cleanText(competitor.positioning)}
                      {competitor.reviewSummary && <p className="mt-3 rounded-lg border border-line bg-raised/70 p-3 text-xs leading-5">{cleanText(competitor.reviewSummary)}</p>}
                    </td>
                    <td className="px-4 py-4 leading-6 text-muted">{cleanText(competitor.strengths)}</td>
                    <td className="px-4 py-4 leading-6 text-muted">{cleanText(competitor.weakness)}</td>
                    <td className="py-4 pl-4"><ThreatPill level={competitor.threatLevel} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 lg:hidden">
            {competitors.map((competitor) => <CompetitorCard key={competitor.name} competitor={competitor} />)}
          </div>
          <div className="mt-5 h-64 rounded-lg border border-line bg-raised p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={threatData}>
                <CartesianGrid stroke="color-mix(in srgb, var(--color-muted) 16%, transparent)" vertical={false} />
                <XAxis dataKey="level" tick={{ fill: 'var(--color-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: 'var(--color-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'var(--color-panel)', border: '1px solid var(--color-line)', borderRadius: 8, color: 'var(--color-text)' }} />
                <Bar dataKey="count" name="Competitors" fill="var(--color-accent)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        {!!reviewGaps.length && (
          <Panel title="Review Gaps" icon={TriangleAlert}>
            <div className="grid gap-3 md:grid-cols-2">
              {reviewGaps.map((gap) => (
                <div key={gap.theme} className="rounded-lg border border-line bg-raised p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-medium capitalize text-white">{cleanText(gap.theme, 'Opportunity')}</h3>
                    <span className="rounded border border-amber/30 bg-amber/10 px-2 py-1 text-xs text-amber">{formatNumber(gap.mentions)} mentions</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted">{cleanText(gap.opportunity)}</p>
                  {!!gap.businesses?.length && <p className="mt-3 text-xs text-muted">Seen in: {cleanList(gap.businesses).join(', ')}</p>}
                  {!!gap.examples?.length && (
                    <div className="mt-3 space-y-2">
                      {gap.examples.slice(0, 2).map((example) => (
                        <p key={`${example.business}-${example.text}`} className="rounded-lg border border-line bg-panel p-3 text-xs leading-5 text-muted">
                          {example.business ? `${cleanText(example.business)}: ` : ''}{cleanText(example.text)}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Panel>
        )}

        <div className="grid gap-5 xl:grid-cols-2">
          <Panel title="Timing" icon={Activity}>
            <Info label="Why now" value={report.timing?.whyNow} />
            <BulletList title="Tailwinds" items={report.timing?.tailwinds} />
            <BulletList title="Headwinds" items={report.timing?.headwinds} />
          </Panel>

          <Panel title="Risk Register" icon={TriangleAlert}>
            <div className="space-y-3">
              {risks.map((risk) => (
                <div key={risk.risk} className="rounded-lg border border-line bg-raised p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-medium text-white">{cleanText(risk.risk, 'Risk')}</h3>
                    <ThreatPill level={risk.severity} />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted">{cleanText(risk.mitigation)}</p>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <Panel title="Recommended Next Steps" icon={CheckCircle2}>
          <div className="grid gap-3 md:grid-cols-2">
            {nextSteps.map((step, index) => (
              <div key={step} className="flex gap-3 rounded-lg border border-line bg-raised p-4">
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
        <p className="mt-1 text-sm text-muted">Clean numeric view of every scoring dimension.</p>
      </div>
      <div className="grid divide-y divide-line sm:grid-cols-2 sm:divide-x md:grid-cols-4 xl:grid-cols-7">
        {rows.map(([label, value]) => (
          <div key={label} className="px-5 py-4">
            <div className="text-xs uppercase tracking-[0.14em] text-muted">{label}</div>
            <div className="mt-2 font-mono text-2xl text-white">{formatNumber(value)}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function SummaryMetric({ icon: Icon, label, value }) {
  return (
    <div className="rounded-lg border border-line bg-raised p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
        <Icon className="h-4 w-4 text-teal" />
        {label}
      </div>
      <div className="mt-3 font-mono text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}

function BudgetPanel({ budgetPlan }) {
  const categories = Array.isArray(budgetPlan.categories) ? budgetPlan.categories.filter((item) => Number(item.amount) > 0) : [];
  const colors = ['#14b8a6', '#6366f1', '#f59e0b', '#22c55e', '#ef4444', '#0ea5e9', '#a855f7'];

  return (
    <Panel title="Budget Distribution" icon={BarChart3}>
      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div>
          <div className="rounded-lg border border-line bg-raised p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-muted">Total budget</div>
            <div className="mt-2 font-mono text-3xl font-semibold text-white">{formatCurrency(budgetPlan.totalBudget)}</div>
            <p className="mt-2 text-sm leading-6 text-muted">
              {budgetPlan.ownsPlace ? 'Own place selected, so rent is not included.' : `Rent estimate included: ${formatCurrency(budgetPlan.rentEstimate)}.`}
            </p>
          </div>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categories} dataKey="amount" nameKey="name" innerRadius={58} outerRadius={96} paddingAngle={2}>
                  {categories.map((entry, index) => (
                    <Cell key={entry.name} fill={colors[index % colors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value)} contentStyle={{ background: 'var(--color-panel)', border: '1px solid var(--color-line)', borderRadius: 8, color: 'var(--color-text)' }} />
                <Legend wrapperStyle={{ color: 'var(--color-muted)', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-3">
          {categories.map((item, index) => (
            <div key={item.name} className="rounded-lg border border-line bg-raised p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
                  <h3 className="font-medium text-white">{cleanText(item.name)}</h3>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm text-white">{formatCurrency(item.amount)}</div>
                  <div className="text-xs text-muted">{formatPercent(item.percent)}</div>
                </div>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted">{cleanText(item.note)}</p>
            </div>
          ))}
          {!!budgetPlan.assumptions?.length && (
            <div className="rounded-lg border border-line bg-panel p-4">
              <div className="text-xs uppercase tracking-[0.14em] text-muted">Assumptions</div>
              <div className="mt-3 space-y-2">
                {cleanList(budgetPlan.assumptions).map((assumption) => (
                  <p key={assumption} className="text-sm leading-6 text-muted">{assumption}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}

function buildMarketSignalData(report) {
  const marketAnalysis = report.marketAnalysis || {};
  const marketScore = boundedScore(report.scores?.market, 60);
  const growthScore = scoreFromGrowthText(marketAnalysis.growth, marketScore);
  const payScore = scoreFromPayText(marketAnalysis.willingnessToPay, marketScore);

  return [
    { signal: 'Market', score: marketScore },
    { signal: 'Growth', score: growthScore },
    { signal: 'Pay', score: payScore }
  ];
}

function boundedScore(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function scoreFromGrowthText(value, fallback) {
  const text = String(value || '');
  const percents = Array.from(text.matchAll(/(\d+(?:\.\d+)?)\s*%/g), (match) => Number(match[1])).filter(Number.isFinite);

  if (percents.length) {
    const average = percents.reduce((sum, percent) => sum + percent, 0) / percents.length;
    return boundedScore(45 + average * 2, fallback);
  }

  const normalized = text.toLowerCase();
  if (/(fast|rapid|explosive|surging|high growth|strong growth)/.test(normalized)) return boundedScore(fallback + 10, fallback);
  if (/(slow|flat|declining|shrinking|weak)/.test(normalized)) return boundedScore(fallback - 18, fallback);
  return fallback;
}

function scoreFromPayText(value, fallback) {
  const normalized = String(value || '').toLowerCase();
  if (/(highest|premium|luxury|enterprise|high-value|strong|willing)/.test(normalized)) return boundedScore(fallback + 8, fallback);
  if (/(low|uncertain|price sensitive|weak|limited)/.test(normalized)) return boundedScore(fallback - 16, fallback);
  return fallback;
}

function Panel({ title, icon: Icon, className = '', children }) {
  return (
    <motion.section initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className={`rounded-lg border border-line bg-panel p-5 surface-shadow ${className}`}>
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
      <p className="mt-2 text-sm leading-6 text-muted">{cleanText(value)}</p>
    </div>
  );
}

function BulletList({ title, items = [] }) {
  const cleanItems = cleanList(items);

  return (
    <div className="border-t border-line py-4">
      <div className="text-xs uppercase tracking-[0.14em] text-muted">{title}</div>
      <div className="mt-3 space-y-2">
        {cleanItems.length ? cleanItems.map((item) => (
          <div key={item} className="flex gap-2 text-sm leading-6 text-muted">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />
            {item}
          </div>
        )) : <p className="text-sm leading-6 text-muted">Not available</p>}
      </div>
    </div>
  );
}

function CompetitorCard({ competitor }) {
  return (
    <article className="rounded-lg border border-line bg-raised p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          {competitor.sourceUrl ? (
            <a className="inline-flex items-center gap-1 font-semibold text-white transition hover:text-teal" href={competitor.sourceUrl} target="_blank" rel="noreferrer">
              {cleanText(competitor.name, 'Unnamed competitor')}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : (
            <h3 className="font-semibold text-white">{cleanText(competitor.name, 'Unnamed competitor')}</h3>
          )}
          {competitor.source && <p className="mt-1 text-xs uppercase tracking-[0.12em] text-muted">{formatCompetitorSource(competitor.source)}</p>}
        </div>
        <ThreatPill level={competitor.threatLevel} />
      </div>
      <p className="mt-3 text-sm leading-6 text-muted">{cleanText(competitor.positioning)}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <InfoBlock label="Strength" value={competitor.strengths} />
        <InfoBlock label="Weakness" value={competitor.weakness} />
      </div>
      {(competitor.rating || competitor.reviewCount) && (
        <p className="mt-3 text-xs text-muted">
          {competitor.rating ? `${formatNumber(competitor.rating)} stars` : ''}
          {competitor.rating && competitor.reviewCount ? ' / ' : ''}
          {competitor.reviewCount ? `${formatNumber(competitor.reviewCount)} reviews` : ''}
        </p>
      )}
    </article>
  );
}

function InfoBlock({ label, value }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.14em] text-muted">{label}</div>
      <p className="mt-2 text-sm leading-6 text-muted">{cleanText(value)}</p>
    </div>
  );
}

function formatCompetitorSource(source = '') {
  const normalized = String(source).toLowerCase();
  if (normalized === 'google_places') return 'Google Maps';
  if (normalized === 'openstreetmap') return 'OpenStreetMap';
  if (normalized === 'foursquare') return 'Foursquare';
  if (normalized === 'web') return 'Web';
  return source;
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

function formatCurrency(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'INR 0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
}

function downloadReport(analysis) {
  const report = analysis.report || {};
  const budgetCategories = Array.isArray(report.budgetPlan?.categories) ? report.budgetPlan.categories : [];
  const competitors = Array.isArray(report.competitors) ? report.competitors : [];
  const risks = Array.isArray(report.risks) ? report.risks : [];
  const nextSteps = cleanList(report.nextSteps);

  const rows = (items, render) => items.map(render).join('');
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>FounderOS Report</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111827; line-height: 1.55; margin: 40px; }
    h1, h2, h3 { color: #0f172a; }
    h1 { font-size: 30px; margin-bottom: 8px; }
    h2 { border-bottom: 1px solid #d9e1ea; padding-bottom: 8px; margin-top: 28px; }
    .meta, .muted { color: #5f6c7a; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .card { border: 1px solid #d9e1ea; border-radius: 8px; padding: 14px; margin: 10px 0; }
    .metric { font-size: 24px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { border-bottom: 1px solid #e5e7eb; padding: 10px; text-align: left; vertical-align: top; }
    th { background: #f7f9fc; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; }
    ul { padding-left: 20px; }
  </style>
</head>
<body>
  <p class="meta">FounderOS validation report</p>
  <h1>${escapeHtml(cleanText(analysis.idea))}</h1>
  <p class="meta">Region: ${escapeHtml(cleanText(analysis.region))}</p>
  <div class="grid">
    <div class="card"><div class="muted">Verdict</div><div class="metric">${escapeHtml(cleanText(report.verdict?.label, 'PIVOT'))}</div></div>
    <div class="card"><div class="muted">Overall score</div><div class="metric">${formatNumber(report.scores?.overall)}</div></div>
    <div class="card"><div class="muted">Confidence</div><div class="metric">${formatPercent(report.verdict?.confidence)}</div></div>
  </div>
  <h2>Simple Summary</h2>
  <p>${escapeHtml(cleanText(report.executiveSummary))}</p>
  <p>${escapeHtml(cleanText(report.verdict?.rationale))}</p>
  <h2>Budget Distribution</h2>
  <p>Total budget: <strong>${formatCurrency(report.budgetPlan?.totalBudget || analysis.budget)}</strong>. ${report.budgetPlan?.ownsPlace ? 'Rent is excluded because own place was selected.' : 'Rent is included as an area estimate.'}</p>
  <table><thead><tr><th>Category</th><th>Amount</th><th>Percent</th><th>Why it matters</th></tr></thead><tbody>
    ${rows(budgetCategories, (item) => `<tr><td>${escapeHtml(cleanText(item.name))}</td><td>${formatCurrency(item.amount)}</td><td>${formatPercent(item.percent)}</td><td>${escapeHtml(cleanText(item.note))}</td></tr>`)}
  </tbody></table>
  <h2>Market</h2>
  <p><strong>Size:</strong> ${escapeHtml(cleanText(report.marketAnalysis?.size))}</p>
  <p><strong>Audience:</strong> ${escapeHtml(cleanText(report.marketAnalysis?.audience))}</p>
  <p><strong>Growth:</strong> ${escapeHtml(cleanText(report.marketAnalysis?.growth))}</p>
  <h2>Competitors</h2>
  <table><thead><tr><th>Company</th><th>Positioning</th><th>Strength</th><th>Weakness</th><th>Threat</th></tr></thead><tbody>
    ${rows(competitors, (item) => `<tr><td>${escapeHtml(cleanText(item.name, 'Unnamed competitor'))}</td><td>${escapeHtml(cleanText(item.positioning))}</td><td>${escapeHtml(cleanText(item.strengths))}</td><td>${escapeHtml(cleanText(item.weakness))}</td><td>${escapeHtml(cleanText(item.threatLevel, 'Medium'))}</td></tr>`)}
  </tbody></table>
  <h2>Risks</h2>
  ${rows(risks, (risk) => `<div class="card"><h3>${escapeHtml(cleanText(risk.risk, 'Risk'))}</h3><p class="muted">Severity: ${escapeHtml(cleanText(risk.severity, 'Medium'))}</p><p>${escapeHtml(cleanText(risk.mitigation))}</p></div>`)}
  <h2>Next Steps</h2>
  <ul>${rows(nextSteps, (step) => `<li>${escapeHtml(step)}</li>`)}</ul>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `founderos-report-${analysis._id}.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
