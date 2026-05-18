import mongoose from 'mongoose';

const agentLogSchema = new mongoose.Schema(
  {
    agentId: { type: String, required: true },
    agentName: { type: String, required: true },
    status: {
      type: String,
      enum: ['queued', 'running', 'completed', 'failed'],
      default: 'queued'
    },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    message: { type: String, default: '' },
    output: { type: mongoose.Schema.Types.Mixed },
    startedAt: Date,
    completedAt: Date,
    events: [
      {
        message: String,
        progress: Number,
        status: String,
        timestamp: { type: Date, default: Date.now }
      }
    ]
  },
  { _id: false }
);

const reportSchema = new mongoose.Schema(
  {
    executiveSummary: String,
    verdict: {
      label: { type: String, enum: ['GO', 'PIVOT', 'NO-GO'], default: 'PIVOT' },
      rationale: String,
      confidence: Number
    },
    scores: {
      market: Number,
      timing: Number,
      defensibility: Number,
      feasibility: Number,
      risk: Number,
      founderFit: Number,
      overall: Number
    },
    marketAnalysis: {
      size: String,
      audience: String,
      growth: String,
      willingnessToPay: String
    },
    competitors: [
      {
        name: String,
        positioning: String,
        strengths: String,
        weakness: String,
        threatLevel: String
      }
    ],
    technicalFeasibility: {
      complexity: String,
      stackRecommendation: String,
      buildRisks: [String],
      mvpScope: [String]
    },
    timing: {
      whyNow: String,
      tailwinds: [String],
      headwinds: [String]
    },
    risks: [
      {
        risk: String,
        severity: String,
        mitigation: String
      }
    ],
    nextSteps: [String],
    generatedAt: Date
  },
  { _id: false }
);

const analysisSchema = new mongoose.Schema(
  {
    idea: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['queued', 'running', 'completed', 'failed'],
      default: 'queued',
      index: true
    },
    currentAgent: String,
    agents: [agentLogSchema],
    report: reportSchema,
    error: String
  },
  { timestamps: true }
);

export const Analysis = mongoose.model('Analysis', analysisSchema);
