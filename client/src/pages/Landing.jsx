import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, FileText, Layers3, Loader2, Play, ShieldAlert, SlidersHorizontal } from 'lucide-react';
import Chrome from '../components/Chrome.jsx';
import { Card, MetricCard, SegmentedControl, StatusPill } from '../components/ui.jsx';
import { createAnalysis, listAnalyses } from '../api.js';
import { formatTime } from '../utils/format.js';

const agents = [
  ['Planner', 'Frames the idea'],
  ['Market', 'Checks demand'],
  ['Competitor', 'Maps alternatives'],
  ['Technical', 'Tests build path'],
  ['Timing', 'Reads why now'],
  ['Risk', 'Finds failure modes'],
  ['Scoring', 'Grades signal'],
  ['Report', 'Writes memo']
];

const examples = [
  'AI chief of staff for solo founders that turns messy notes into weekly investor updates',
  'Compliance copilot for fintech startups shipping faster in regulated markets',
  'Autonomous outbound research platform for vertical SaaS sales teams'
];

export default function Landing() {
  const [idea, setIdea] = useState('');
  const [region, setRegion] = useState('');
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState([]);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    listAnalyses()
      .then((items) => {
        if (mounted) setRecent(items);
      })
      .catch(() => {
        if (mounted) setRecent([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (!region.trim()) {
      setError('Region or locality is compulsory.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const analysis = await createAnalysis(idea, region);
      navigate(`/analysis/${analysis._id}`);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Chrome>
      <section className="mx-auto flex w-full max-w-7xl flex-col items-center px-5 pb-16 pt-8 text-center">
        <p className="text-sm font-medium uppercase tracking-[0.12em] text-teal">
          Validate. Score. Decide.
        </p>

        <h1 className="mt-5 max-w-5xl text-4xl font-light leading-[1.08] tracking-normal text-white sm:text-5xl lg:text-6xl">
          Build the startup people actually want.
        </h1>

        <p className="mt-5 max-w-3xl text-base leading-7 text-muted md:text-lg">
          FounderOS runs an eight-agent validation flow and turns a rough idea into a clean regional investor-style decision memo.
        </p>

        <form
          onSubmit={submit}
          className="mt-8 w-full max-w-4xl rounded-3xl border border-line bg-panel/90 p-3 text-left surface-shadow backdrop-blur"
        >
          <textarea
            value={idea}
            onChange={(event) => setIdea(event.target.value)}
            placeholder="Describe your startup idea..."
            className="input-surface h-28 w-full resize-none rounded-2xl border border-line px-5 py-4 text-base leading-7 outline-none transition placeholder:text-muted/60 focus:border-teal focus:shadow-focus"
          />

          <input
            type="text"
            value={region}
            onChange={(event) => setRegion(event.target.value)}
            placeholder="Target region/locality (e.g. Koramangala, Bangalore) - Compulsory"
            className="input-surface mt-3 h-14 w-full rounded-2xl border border-line px-5 py-4 text-base outline-none transition placeholder:text-muted/60 focus:border-teal focus:shadow-focus"
            required
          />

          <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="text-xs text-muted">
              <span>{idea.trim().length < 12 ? 'Minimum 12 characters required for idea' : 'Regional validation ready'}</span>
              <span className="mx-2">•</span>
              <span>{!region.trim() ? 'Region is required' : 'Region ready'}</span>
            </div>

            <button
              disabled={loading || idea.trim().length < 12 || !region.trim()}
              className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-teal px-8 text-base font-semibold text-white transition hover:-translate-y-0.5 hover:opacity-95 disabled:translate-y-0 disabled:cursor-not-allowed disabled:border disabled:border-line disabled:bg-raised disabled:text-muted"
            >
              {loading ? 'Starting' : 'Start analysis'}
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            </button>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-muted">
            <span>{idea.trim().length}/2500 characters</span>
          </div>
          {error && <p className="mt-3 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-red-100">{error}</p>}
        </form>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {examples.map((sample) => (
            <button
              key={sample}
              type="button"
              onClick={() => setIdea(sample)}
              className="max-w-sm rounded-full border border-line bg-panel/70 px-4 py-2 text-sm text-muted transition hover:border-teal hover:text-white"
            >
              {sample}
            </button>
          ))}
        </div>

        <div className="mt-16 grid w-full max-w-5xl gap-4 sm:grid-cols-3">
          <MetricCard label="Agents" value="8" icon={Layers3} />
          <MetricCard label="Recent runs" value={recent.length} icon={FileText} tone="text-green" />
          <MetricCard label="Selected mode" value="Compulsory" icon={SlidersHorizontal} tone="text-amber" />
        </div>

        <div className="mt-6 grid w-full max-w-5xl gap-4 lg:grid-cols-[1fr_340px]">
          <Card className="overflow-hidden text-left">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div>
                <h2 className="font-semibold text-white">Recent analyses</h2>
                <p className="mt-1 text-sm text-muted">Saved validation runs</p>
              </div>
              <FileText className="h-5 w-5 text-muted" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="border-b border-line text-xs uppercase tracking-[0.12em] text-muted">
                  <tr>
                    <th className="px-5 py-3 font-medium">Idea</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Score</th>
                    <th className="px-4 py-3 font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((item) => (
                    <tr key={item._id} className="border-b border-line/70 transition hover:bg-raised/60">
                      <td className="max-w-[320px] px-5 py-3">
                        <Link to={item.report ? `/report/${item._id}` : `/analysis/${item._id}`} className="line-clamp-1 text-white hover:text-teal">
                          {item.idea}
                        </Link>
                      </td>
                      <td className="px-4 py-3"><StatusPill status={item.status} /></td>
                      <td className="px-4 py-3 font-mono text-muted">{item.report?.scores?.overall ?? '--'}</td>
                      <td className="px-4 py-3 text-muted">{formatTime(item.updatedAt)}</td>
                    </tr>
                  ))}
                  {!recent.length && (
                    <tr>
                      <td className="px-5 py-8 text-sm text-muted" colSpan="4">No saved analyses yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-5 text-left">
            <h2 className="font-semibold text-white">Agent flow</h2>
            <div className="mt-4 grid gap-2">
              {agents.map(([name, role], index) => (
                <div key={name} className="flex items-center gap-3 rounded-2xl border border-line bg-raised px-3 py-2">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-panel font-mono text-xs text-teal">{index + 1}</span>
                  <div>
                    <div className="text-sm font-medium text-white">{name}</div>
                    <div className="text-xs text-muted">{role}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 space-y-3 text-sm">
              <Note icon={CheckCircle2} tone="text-green" title="Live progress" body="Socket events update every agent." />
              <Note icon={Play} tone="text-teal" title="Provider fallback" body="Groq, Gemini, then local fallback." />
              <Note icon={ShieldAlert} tone="text-amber" title="Research note" body="Live web tools can be added next." />
            </div>
          </Card>
        </div>
      </section>
    </Chrome>
  );
}

function Note({ icon: Icon, tone, title, body }) {
  return (
    <div className="flex gap-3">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone}`} />
      <div>
        <div className="font-medium text-white">{title}</div>
        <p className="mt-1 leading-5 text-muted">{body}</p>
      </div>
    </div>
  );
}
