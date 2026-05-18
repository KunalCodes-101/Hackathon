import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BriefcaseBusiness, Loader2, MapPin, Send } from 'lucide-react';
import Chrome from '../components/Chrome.jsx';
import { Card, MetricCard } from '../components/ui.jsx';
import { applyForJob, listJobs } from '../api.js';
import { useAuth } from '../auth.jsx';
import { cleanText, formatNumber } from '../utils/format.js';

export default function Jobs() {
  const { user } = useAuth();
  const [region, setRegion] = useState(user?.region || '');
  const [jobs, setJobs] = useState([]);
  const [impact, setImpact] = useState({ chart: [] });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setLoading(true);
    listJobs(region)
      .then((data) => {
        setJobs(data.jobs || []);
        setImpact(data.impact || { chart: [] });
      })
      .catch(() => {
        setJobs([]);
        setImpact({ chart: [] });
      })
      .finally(() => setLoading(false));
  }, [region]);

  const totalOpenings = useMemo(() => jobs.reduce((sum, job) => sum + Number(job.openings || 0), 0), [jobs]);

  async function apply(job) {
    setMessage('');
    try {
      const result = await applyForJob(job._id, `Interested in ${job.title} in ${job.region}`);
      setImpact(result.impact || impact);
      setJobs((items) => items.map((item) => item._id === job._id ? { ...item, alreadyApplied: true } : item));
      setMessage('Application submitted.');
    } catch (err) {
      setMessage(err.response?.data?.error || err.message);
    }
  }

  return (
    <Chrome>
      <section className="mx-auto max-w-7xl px-5 pb-16 pt-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-teal">Jobs</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Startup jobs by region</h1>
            <p className="mt-2 max-w-3xl text-base leading-7 text-muted">
              Approved startup reports generate required positions. Job seekers see openings in their selected area and can apply directly.
            </p>
          </div>
          <div className="min-w-[280px]">
            <label className="text-sm font-medium text-muted">Area / region</label>
            <input
              value={region}
              onChange={(event) => setRegion(event.target.value)}
              placeholder="e.g. Bangalore"
              className="input-surface mt-2 h-14 w-full rounded-xl border border-line px-4 py-3 text-base outline-none focus:border-teal"
            />
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <MetricCard label="Visible jobs" value={jobs.length} icon={BriefcaseBusiness} />
          <MetricCard label="Open roles" value={totalOpenings} icon={MapPin} tone="text-green" />
          <MetricCard label="Employment provided" value={`${formatNumber(impact.employmentPercent)}%`} icon={Send} tone="text-amber" />
        </div>

        <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_380px]">
          <div className="grid gap-4">
            {loading && <Card className="p-5 text-muted"><Loader2 className="mr-2 inline h-4 w-4 animate-spin text-teal" /> Loading jobs</Card>}
            {!loading && jobs.map((job) => (
              <Card key={job._id} className="p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.12em] text-teal">{cleanText(job.startupName)}</p>
                    <h2 className="mt-2 text-xl font-semibold text-white">{cleanText(job.title)}</h2>
                    <p className="mt-2 flex items-center gap-2 text-sm text-muted"><MapPin className="h-4 w-4 text-teal" /> {cleanText(job.region)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => apply(job)}
                    disabled={!user || user.role !== 'job-seeker' || job.alreadyApplied}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:border disabled:border-line disabled:bg-raised disabled:text-muted"
                  >
                    <Send className="h-4 w-4" />
                    {job.alreadyApplied ? 'Applied' : 'Apply'}
                  </button>
                </div>
                <p className="mt-4 text-base leading-7 text-muted">{cleanText(job.requirement)}</p>
                <div className="mt-4 flex flex-wrap gap-2 text-sm text-muted">
                  <span className="rounded-full border border-line bg-raised px-3 py-1">{job.openings} opening{Number(job.openings) === 1 ? '' : 's'}</span>
                  <span className="rounded-full border border-line bg-raised px-3 py-1">Score {job.analysis?.report?.scores?.overall ?? '--'}</span>
                  <span className="rounded-full border border-line bg-raised px-3 py-1">{job.analysis?.report?.verdict?.label || 'Approved'}</span>
                </div>
              </Card>
            ))}
            {!loading && !jobs.length && <Card className="p-6 text-muted">No jobs are open in this region yet.</Card>}
            {message && <p className="rounded-lg border border-line bg-panel p-4 text-sm text-muted">{message}</p>}
          </div>

          <Card className="p-5">
            <h2 className="font-semibold text-white">Employment impact</h2>
            <p className="mt-2 text-sm leading-6 text-muted">Tracks openings generated, applications received, and the current employment coverage percentage.</p>
            <div className="mt-5 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={impact.chart || []}>
                  <CartesianGrid stroke="color-mix(in srgb, var(--color-muted) 16%, transparent)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: 'var(--color-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--color-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'var(--color-panel)', border: '1px solid var(--color-line)', borderRadius: 8, color: 'var(--color-text)' }} />
                  <Bar dataKey="value" fill="var(--color-accent)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </section>
    </Chrome>
  );
}
