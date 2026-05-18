export const agents = [
  {
    id: 'planner',
    name: 'Planner',
    role: 'Frames the idea, target user, core assumptions, and validation plan.'
  },
  {
    id: 'market-research',
    name: 'Market Research',
    role: 'Sizes the opportunity, customer segments, urgency, and buying behavior.'
  },
  {
    id: 'competitor',
    name: 'Competitor',
    role: 'Maps alternatives, incumbents, substitutes, and whitespace.'
  },
  {
    id: 'technical-feasibility',
    name: 'Technical Feasibility',
    role: 'Judges implementation complexity, integrations, data needs, and MVP scope.'
  },
  {
    id: 'timing',
    name: 'Timing',
    role: 'Finds market tailwinds, adoption readiness, and why-now signals.'
  },
  {
    id: 'risk-analysis',
    name: 'Risk Analysis',
    role: 'Surfaces strategic, execution, legal, trust, and distribution risks.'
  },
  {
    id: 'scoring',
    name: 'Scoring',
    role: 'Converts evidence into weighted investor-grade scores.'
  },
  {
    id: 'report-generator',
    name: 'Report Generator',
    role: 'Synthesizes a crisp final report and GO/PIVOT/NO-GO verdict.'
  }
];

export function createInitialAgents() {
  return agents.map((agent) => ({
    agentId: agent.id,
    agentName: agent.name,
    status: 'queued',
    progress: 0,
    message: 'Queued for analysis',
    events: [
      {
        message: 'Queued for analysis',
        progress: 0,
        status: 'queued',
        timestamp: new Date()
      }
    ]
  }));
}
