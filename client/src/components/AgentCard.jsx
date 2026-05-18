import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';

const statusIcon = {
  queued: Circle,
  running: Loader2,
  completed: CheckCircle2,
  failed: XCircle
};

export default function AgentCard({ agent, index }) {
  const Icon = statusIcon[agent.status] || Circle;
  const isRunning = agent.status === 'running';

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="rounded-lg border border-white/10 bg-white/[0.055] p-4 backdrop-blur-xl"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Icon className={`h-4 w-4 ${isRunning ? 'animate-spin text-cyan' : agent.status === 'completed' ? 'text-emerald-300' : agent.status === 'failed' ? 'text-rose-300' : 'text-white/35'}`} />
            <h3 className="text-sm font-semibold text-white">{agent.agentName}</h3>
          </div>
          <p className="mt-2 min-h-10 text-sm leading-6 text-white/60">{agent.message}</p>
        </div>
        <span className="text-xs font-medium uppercase tracking-wide text-white/40">{agent.progress}%</span>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-violet via-fuchsia to-cyan"
          initial={{ width: 0 }}
          animate={{ width: `${agent.progress}%` }}
          transition={{ duration: 0.45 }}
        />
      </div>
    </motion.div>
  );
}
