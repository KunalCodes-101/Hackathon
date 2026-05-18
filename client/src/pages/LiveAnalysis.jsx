import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Clock3, FileText, Loader2, TerminalSquare } from 'lucide-react';
import Chrome from '../components/Chrome.jsx';
import AgentCard from '../components/AgentCard.jsx';
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
    return (
      <Chrome>
        <div className="grid min-h-[70vh] place-items-center">
          <Loader2 className="h-8 w-8 animate-spin text-cyan" />
        </div>
      </Chrome>
    );
  }

  if (error || !analysis) {
    return (
      <Chrome>
        <div className="mx-auto max-w-2xl px-5 py-24 text-center">
          <h1 className="text-3xl font-bold">Analysis unavailable</h1>
          <p className="mt-3 text-white/55">{error || 'No analysis was found.'}</p>
          <Link className="mt-6 inline-flex rounded-md bg-white px-4 py-3 text-sm font-semibold text-ink" to="/">Start over</Link>
        </div>
      </Chrome>
    );
  }

  const completed = analysis.agents.filter((agent) => agent.status === 'completed').length;
  const totalProgress = Math.round(analysis.agents.reduce((sum, agent) => sum + agent.progress, 0) / analysis.agents.length);
  const events = analysis.agents
    .flatMap((agent) => agent.events.map((event) => ({ ...event, agentName: agent.agentName })))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 12);

  return (
    <Chrome>
      <section className="mx-auto w-full max-w-7xl px-5 pb-14 pt-8">
        <div className="grid gap-6 lg:grid-cols-[0.72fr_0.28fr]">
          <div>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg border border-white/10 bg-white/[0.055] p-6 backdrop-blur-xl">
              <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-cyan">Live Analysis</p>
                  <h1 className="mt-3 max-w-3xl text-3xl font-bold leading-tight text-white md:text-4xl">{analysis.idea}</h1>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/65">
                  {completed}/8 agents complete
                </div>
              </div>
              <div className="mt-7 h-2 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-violet via-fuchsia to-cyan"
                  animate={{ width: `${totalProgress}%` }}
                />
              </div>
              <div className="mt-3 flex items-center justify-between text-sm text-white/45">
                <span>{totalProgress}% total progress</span>
                <span>{analysis.status}</span>
              </div>
            </motion.div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {analysis.agents.map((agent, index) => (
                <AgentCard key={agent.agentId} agent={agent} index={index} />
              ))}
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-lg border border-white/10 bg-panel/70 p-5 backdrop-blur-xl">
              <div className="flex items-center gap-2">
                <TerminalSquare className="h-5 w-5 text-cyan" />
                <h2 className="font-semibold text-white">Agent feed</h2>
              </div>
              <div className="mt-5 space-y-4">
                {events.map((event, index) => (
                  <div key={`${event.timestamp}-${index}`} className="border-l border-white/10 pl-4">
                    <div className="flex items-center gap-2 text-xs text-white/35">
                      <Clock3 className="h-3.5 w-3.5" />
                      {formatTime(event.timestamp)}
                    </div>
                    <p className="mt-1 text-sm font-medium text-white/80">{event.agentName}</p>
                    <p className="mt-1 text-sm leading-6 text-white/50">{event.message}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-cyan/20 bg-cyan/10 p-5">
              <FileText className="h-5 w-5 text-cyan" />
              <h2 className="mt-3 font-semibold text-white">Report unlocks automatically</h2>
              <p className="mt-2 text-sm leading-6 text-white/55">When the report generator finishes, FounderOS will open the full investor-grade breakdown.</p>
              {analysis.report && (
                <Link to={`/report/${analysis._id}`} className="mt-4 inline-flex items-center gap-2 rounded-md bg-white px-4 py-3 text-sm font-semibold text-ink">
                  Open report
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          </aside>
        </div>
      </section>
    </Chrome>
  );
}
