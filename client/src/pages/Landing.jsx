import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, BrainCircuit, LineChart, Radar, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import Chrome from '../components/Chrome.jsx';
import { createAnalysis } from '../api.js';

const agents = [
  'Planner',
  'Market Research',
  'Competitor',
  'Technical Feasibility',
  'Timing',
  'Risk Analysis',
  'Scoring',
  'Report Generator'
];

const examples = [
  'AI chief of staff for solo founders that turns messy notes into weekly investor updates',
  'Autonomous outbound research platform for vertical SaaS sales teams',
  'Compliance copilot for fintech startups shipping faster in regulated markets'
];

export default function Landing() {
  const [idea, setIdea] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function submit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const analysis = await createAnalysis(idea);
      navigate(`/analysis/${analysis._id}`);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Chrome>
      <section className="mx-auto grid min-h-[calc(100vh-88px)] w-full max-w-7xl items-center gap-10 px-5 pb-14 pt-8 lg:grid-cols-[1.04fr_0.96fr]">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 rounded-full border border-cyan/20 bg-cyan/10 px-4 py-2 text-sm text-cyan"
          >
            <Sparkles className="h-4 w-4" />
            Real-time autonomous startup diligence
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="mt-7 max-w-4xl text-5xl font-extrabold leading-[1.03] tracking-normal text-white sm:text-6xl lg:text-7xl"
          >
            Validate your startup idea before you build the wrong company.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16 }}
            className="mt-6 max-w-2xl text-lg leading-8 text-white/62"
          >
            FounderOS runs eight specialist AI agents in sequence and turns raw strategy questions into an investor-grade validation report with scores, risks, competitors, and a decisive verdict.
          </motion.p>

          <motion.form
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24 }}
            onSubmit={submit}
            className="mt-8 overflow-hidden rounded-lg border border-white/10 bg-white/[0.07] p-2 shadow-glow backdrop-blur-xl"
          >
            <textarea
              value={idea}
              onChange={(event) => setIdea(event.target.value)}
              placeholder="Describe the startup idea you want validated..."
              className="h-36 w-full resize-none rounded-md border border-white/10 bg-black/20 px-5 py-4 text-base leading-7 text-white outline-none placeholder:text-white/35 focus:border-cyan/40"
            />
            <div className="flex flex-col gap-3 p-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-white/45">Minimum 12 characters. Best results include customer, product, and why now.</div>
              <button
                disabled={loading || idea.trim().length < 12}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:bg-cyan disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/35"
              >
                {loading ? 'Launching agents' : 'Run validation'}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </motion.form>

          {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}

          <div className="mt-5 flex flex-wrap gap-2">
            {examples.map((sample) => (
              <button
                key={sample}
                type="button"
                onClick={() => setIdea(sample)}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-xs text-white/55 transition hover:border-cyan/30 hover:text-white"
              >
                {sample}
              </button>
            ))}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.18 }}
          className="relative"
        >
          <div className="relative rounded-lg border border-white/10 bg-panel/70 p-5 shadow-cyan backdrop-blur-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-white/35">Agent Team</p>
                <h2 className="mt-2 text-xl font-semibold text-white">Live diligence pipeline</h2>
              </div>
              <div className="grid h-11 w-11 place-items-center rounded-lg bg-cyan/10">
                <BrainCircuit className="h-5 w-5 text-cyan" />
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              {agents.map((agent, index) => (
                <motion.div
                  key={agent}
                  initial={{ opacity: 0, x: 18 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.08 * index }}
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.045] px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="grid h-8 w-8 place-items-center rounded-md bg-white/10 text-xs font-semibold text-cyan">
                      {index + 1}
                    </div>
                    <span className="text-sm font-medium text-white/80">{agent}</span>
                  </div>
                  <span className="h-2 w-2 rounded-full bg-cyan shadow-[0_0_18px_rgba(34,211,238,0.85)]" />
                </motion.div>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              {[
                [LineChart, 'Market'],
                [Radar, 'Scores'],
                [ShieldCheck, 'Risks']
              ].map(([Icon, label]) => (
                <div key={label} className="rounded-lg border border-white/10 bg-black/20 p-4 text-center">
                  <Icon className="mx-auto h-5 w-5 text-violet-200" />
                  <div className="mt-2 text-xs text-white/50">{label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm text-white/45">
            <Zap className="h-4 w-4 text-cyan" />
            Progress streams while agents work.
          </div>
        </motion.div>
      </section>
    </Chrome>
  );
}
