import { Analysis } from '../models/Analysis.js';
import { agents } from '../agents.js';
import { runAgent } from './aiClient.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function serializeAnalysis(analysis) {
  return analysis.toObject({ versionKey: false });
}

async function emitAnalysis(io, analysisId, event, payload = {}) {
  const analysis = await Analysis.findById(analysisId);
  if (!analysis) return;
  io.to(String(analysisId)).emit(event, {
    analysis: serializeAnalysis(analysis),
    ...payload
  });
}

async function updateAgent(analysisId, agentId, patch) {
  const analysis = await Analysis.findById(analysisId);
  if (!analysis) return null;

  const agent = analysis.agents.find((item) => item.agentId === agentId);
  if (!agent) return analysis;

  Object.assign(agent, patch);
  agent.events.push({
    message: patch.message || agent.message,
    progress: patch.progress ?? agent.progress,
    status: patch.status || agent.status,
    timestamp: new Date()
  });

  if (patch.status === 'running' && !agent.startedAt) agent.startedAt = new Date();
  if (patch.status === 'completed' || patch.status === 'failed') agent.completedAt = new Date();

  await analysis.save();
  return analysis;
}

export async function startAnalysisRun({ analysisId, io }) {
  const context = {};

  try {
    await Analysis.findByIdAndUpdate(analysisId, {
      status: 'running',
      currentAgent: agents[0].id
    });
    await emitAnalysis(io, analysisId, 'analysis:updated');

    for (const agent of agents) {
      await Analysis.findByIdAndUpdate(analysisId, { currentAgent: agent.id });
      await updateAgent(analysisId, agent.id, {
        status: 'running',
        progress: 12,
        message: `${agent.name} is initializing its workspace`
      });
      await emitAnalysis(io, analysisId, 'agent:update', { agentId: agent.id });

      for (const step of [
        'Scanning founder assumptions',
        'Building evidence map',
        'Stress testing claims'
      ]) {
        await wait(450);
        const progress = step === 'Scanning founder assumptions' ? 32 : step === 'Building evidence map' ? 58 : 78;
        await updateAgent(analysisId, agent.id, {
          status: 'running',
          progress,
          message: `${agent.name}: ${step}`
        });
        await emitAnalysis(io, analysisId, 'agent:update', { agentId: agent.id });
      }

      const analysis = await Analysis.findById(analysisId);
      const result = await runAgent({
        idea: analysis.idea,
        region: analysis.region,
        budget: analysis.budget,
        ownsPlace: analysis.ownsPlace,
        agent,
        context
      });

      context[agent.id] = result.output;
      const patch = {
        status: 'completed',
        progress: 100,
        message: result.summary || `${agent.name} completed`,
        output: result.output
      };

      if (agent.id === 'report-generator') {
        await Analysis.findByIdAndUpdate(analysisId, {
          report: {
            ...result.output,
            generatedAt: new Date()
          }
        });
      }

      await updateAgent(analysisId, agent.id, patch);
      await emitAnalysis(io, analysisId, 'agent:update', { agentId: agent.id });
      await wait(350);
    }

    await Analysis.findByIdAndUpdate(analysisId, {
      status: 'completed',
      currentAgent: null
    });
    await emitAnalysis(io, analysisId, 'analysis:completed');
  } catch (error) {
    const message = error.response?.data?.error || error.message || 'Analysis failed';
    const failed = await Analysis.findById(analysisId);
    const currentAgent = failed?.currentAgent;
    if (currentAgent) {
      await updateAgent(analysisId, currentAgent, {
        status: 'failed',
        message,
        progress: 100
      });
    }

    await Analysis.findByIdAndUpdate(analysisId, {
      status: 'failed',
      error: message
    });
    await emitAnalysis(io, analysisId, 'analysis:failed', { error: message });
  }
}
