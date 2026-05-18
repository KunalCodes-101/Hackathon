import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Clock3, FileText, Loader2, RadioTower, TerminalSquare } from 'lucide-react';
import Chrome from '../components/Chrome.jsx';
import AgentCard from '../components/AgentCard.jsx';
import { Card, MetricCard } from '../components/ui.jsx';
import { useAnalysis } from '../hooks/useAnalysis.js';
import { formatTime } from '../utils/format.js';

export default function LiveAnalysis() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { analysis, loading, error } = useAnalysis(id);

  useEffect(() => {
    if (analysis?.status === 'completed' && analysis?.report) {
      const timer = setTimeout(() => navigate(`/report/${analysis._id}`), 900);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [analysis, navigate]);

  if (loading) {
    return <StateView label="Loading analysis" />;
  }

  if (error || !analysis) {
    return (
      <Chrome>
        <div className="mx-auto max-w-2xl px-5 py-24 text-center">
          <h1 className="text-2xl font-semibold">Analysis unavailable</h1>
          <p className="mt-3 text-muted">{error || 'No analysis was found.'}</p>
          <Link className="mt-6 inline-flex rounded-full bg-teal px-4 py-3 text-sm font-semibold text-white" to="/">Start over</Link>
        </div>
      </Chrome>
    );
  }

  const completed = analysis.agents.filter((agent) => agent.status === 'completed').length;
  const totalProgress = Math.round(analysis.agents.reduce((sum, agent) => sum + agent.progress, 0) / analysis.agents.length);
  const events = analysis.agents
    .flatMap((agent) => agent.events.map((event) => ({ ...event, agentName: agent.agentName })))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 14);

  return (
    <Chrome>
      <section className="grid gap-5 p-4 md:p-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
            <div className="flex flex-col gap-4 border-b border-line px-5 py-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-teal">Live analysis</p>
                <h1 className="mt-2 max-w-4xl text-2xl font-semibold leading-tight text-white">{analysis.idea}</h1>
              </div>
              <div className="grid grid-cols-2 gap-2 text-right">
                <MetricCard label="Agents" value={`${completed}/8`} />
                <MetricCard label="Progress" value={`${totalProgress}%`} />
              </div>
            </div>
            <div className="px-5 py-4">
              <div className="h-2 overflow-hidden rounded-full bg-raised">
                <motion.div className="h-full rounded bg-teal" animate={{ width: `${totalProgress}%` }} />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-muted">
                <span className="capitalize">{analysis.status}</span>
                <span>Current: {analysis.currentAgent || 'finalizing'}</span>
              </div>
            </div>
            </Card>
          </motion.div>

          <div className="grid gap-4 md:grid-cols-2">
            {analysis.agents.map((agent, index) => (
              <AgentCard key={agent.agentId} agent={agent} index={index} />
            ))}
          </div>
        </div>

        <aside className="space-y-5">
          <Card>
            <div className="flex items-center gap-2 border-b border-line px-5 py-4">
              <TerminalSquare className="h-5 w-5 text-teal" />
              <h2 className="font-semibold text-white">Event feed</h2>
            </div>
            <div className="max-h-[640px] divide-y divide-line overflow-y-auto">
              {events.map((event, index) => (
                <div key={`${event.timestamp}-${index}`} className="px-5 py-4">
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <Clock3 className="h-3.5 w-3.5" />
                    {formatTime(event.timestamp)}
                  </div>
                  <p className="mt-2 text-sm font-medium text-white">{event.agentName}</p>
                  <p className="mt-1 text-sm leading-5 text-muted">{event.message}</p>
                </div>
              ))}
            </div>
          </Card>

          <section className="rounded-lg border border-teal/25 bg-teal/10 p-5">
            <RadioTower className="h-5 w-5 text-teal" />
            <h2 className="mt-3 font-semibold text-white">Report handoff</h2>
            <p className="mt-2 text-sm leading-6 text-muted">When the report agent completes, the final memo opens automatically.</p>
            {analysis.report && (
              <Link to={`/report/${analysis._id}`} className="mt-4 inline-flex items-center gap-2 rounded-full bg-teal px-4 py-3 text-sm font-semibold text-white">
                <FileText className="h-4 w-4" />
                Open report
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </section>
        </aside>
      </section>
    </Chrome>
  );
}

function StateView({ label }) {
  return (
    <Chrome>
      <div className="grid min-h-[70vh] place-items-center">
        <div className="flex items-center gap-3 rounded-md border border-line bg-panel px-4 py-3 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin text-teal" />
          {label}
        </div>
      </div>
    </Chrome>
  );
}
