import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BriefcaseBusiness, CheckCircle2, FileText, Loader2 } from 'lucide-react';
import Chrome from '../components/Chrome.jsx';
import { Card, MetricCard, StatusPill } from '../components/ui.jsx';
import { listAnalyses } from '../api.js';
import { useAuth } from '../auth.jsx';
import { formatTime } from '../utils/format.js';

export default function History() {
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    listAnalyses()
      .then(setAnalyses)
      .catch(() => setAnalyses([]))
      .finally(() => setLoading(false));
  }, []);

  const approved = analyses.filter((item) => item.approvedAt).length;
  const completed = analyses.filter((item) => item.status === 'completed').length;

  return (
    <Chrome>
      <section className="mx-auto max-w-7xl px-5 pb-16 pt-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-teal">History</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Past startup reports</h1>
            <p className="mt-2 max-w-3xl text-base leading-7 text-muted">
              All generated market reports appear here, including approved startups that have opened hiring roles.
            </p>
          </div>
          {!user && <Link to="/signin" className="rounded-xl bg-teal px-5 py-3 font-semibold text-white">Sign in</Link>}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <MetricCard label="Reports" value={analyses.length} icon={FileText} />
          <MetricCard label="Completed" value={completed} icon={CheckCircle2} tone="text-green" />
          <MetricCard label="Approved" value={approved} icon={BriefcaseBusiness} tone="text-amber" />
        </div>

        <Card className="mt-6 overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <h2 className="font-semibold text-white">Report archive</h2>
          </div>
          {loading ? (
            <div className="flex items-center gap-3 p-5 text-muted"><Loader2 className="h-4 w-4 animate-spin text-teal" /> Loading history</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-left text-sm">
                <thead className="border-b border-line text-xs uppercase tracking-[0.12em] text-muted">
                  <tr>
                    <th className="px-5 py-3 font-medium">Startup idea</th>
                    <th className="px-4 py-3 font-medium">Region</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Score</th>
                    <th className="px-4 py-3 font-medium">Hiring</th>
                    <th className="px-4 py-3 font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {analyses.map((item) => (
                    <tr key={item._id} className="border-b border-line/70 transition hover:bg-raised/60">
                      <td className="max-w-[360px] px-5 py-4">
                        <Link to={item.report ? `/report/${item._id}` : `/analysis/${item._id}`} className="line-clamp-1 font-medium text-white hover:text-teal">{item.idea}</Link>
                      </td>
                      <td className="px-4 py-4 text-muted">{item.region}</td>
                      <td className="px-4 py-4"><StatusPill status={item.status} /></td>
                      <td className="px-4 py-4 font-mono text-muted">{item.report?.scores?.overall ?? '--'}</td>
                      <td className="px-4 py-4 text-muted">{item.approvedAt ? 'Jobs generated' : 'Not approved'}</td>
                      <td className="px-4 py-4 text-muted">{formatTime(item.updatedAt)}</td>
                    </tr>
                  ))}
                  {!analyses.length && (
                    <tr><td className="px-5 py-8 text-muted" colSpan="6">No reports yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>
    </Chrome>
  );
}
