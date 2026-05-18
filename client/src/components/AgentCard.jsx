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
  const tone =
    agent.status === 'completed'
      ? 'text-green'
      : agent.status === 'failed'
        ? 'text-danger'
        : isRunning
          ? 'text-teal'
          : 'text-muted';

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="rounded-lg border border-line bg-panel p-4"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Icon className={`h-4 w-4 ${isRunning ? 'animate-spin' : ''} ${tone}`} />
            <h3 className="truncate text-sm font-semibold text-white">{agent.agentName}</h3>
          </div>
          <p className="mt-2 min-h-10 text-sm leading-5 text-muted">{agent.message}</p>
        </div>
        <span className="rounded border border-line bg-raised px-2 py-1 font-mono text-xs text-muted">{agent.progress}%</span>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-raised">
        <motion.div
          className={`h-full rounded ${agent.status === 'failed' ? 'bg-danger' : agent.status === 'completed' ? 'bg-green' : 'bg-teal'}`}
          initial={{ width: 0 }}
          animate={{ width: `${agent.progress}%` }}
          transition={{ duration: 0.45 }}
        />
      </div>
    </motion.div>
  );
}
