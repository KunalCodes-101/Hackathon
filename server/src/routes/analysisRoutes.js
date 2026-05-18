import { Router } from 'express';
import { z } from 'zod';
import { Analysis } from '../models/Analysis.js';
import { Job } from '../models/Job.js';
import { createInitialAgents } from '../agents.js';
import { startAnalysisRun } from '../services/analysisRunner.js';
import { requireUser } from './authRoutes.js';

const router = Router();

const createAnalysisSchema = z.object({
  idea: z.string().trim().min(12, 'Describe the idea in at least 12 characters').max(2500),
  region: z.string().trim().min(2, 'Enter a valid region or locality'),
  budget: z.coerce.number().min(0, 'Budget must be zero or more').default(0),
  ownsPlace: z.coerce.boolean().default(false)
});

export function createAnalysisRouter(io) {
  router.post('/', requireUser, async (req, res, next) => {
    try {
      const body = createAnalysisSchema.parse(req.body);
      const analysis = await Analysis.create({
        idea: body.idea,
        user: req.user?._id,
        region: body.region,
        budget: body.budget,
        ownsPlace: body.ownsPlace,
        status: 'queued',
        agents: createInitialAgents()
      });

      res.status(201).json({ analysis });
      startAnalysisRun({ analysisId: analysis._id, io });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:id/approve', requireUser, async (req, res, next) => {
    try {
      if (req.user.role !== 'founder') {
        return res.status(403).json({ error: 'Only founders can approve startups and generate jobs' });
      }

      const analysis = await Analysis.findById(req.params.id);
      if (!analysis) return res.status(404).json({ error: 'Analysis not found' });
      if (!analysis.report) return res.status(400).json({ error: 'Report must be generated before approval' });

      const existing = await Job.find({ analysis: analysis._id }).sort({ createdAt: -1 });
      if (existing.length) return res.json({ analysis, jobs: existing });

      analysis.approvedAt = new Date();
      await analysis.save();

      const jobs = await Job.insertMany(generateJobsForAnalysis(analysis, req.user));
      res.status(201).json({ analysis, jobs });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id', requireUser, async (req, res, next) => {
    try {
      const analysis = await Analysis.findById(req.params.id);
      if (!analysis) {
        return res.status(404).json({ error: 'Analysis not found' });
      }
      return res.json({ analysis });
    } catch (error) {
      next(error);
    }
  });

  router.get('/', requireUser, async (req, res, next) => {
    try {
      const filter = req.user ? { $or: [{ user: req.user._id }, { user: { $exists: false } }] } : {};
      const analyses = await Analysis.find(filter)
        .sort({ createdAt: -1 })
        .limit(20)
        .select('idea region budget ownsPlace status approvedAt report.verdict report.scores.overall createdAt updatedAt');
      res.json({ analyses });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function generateJobsForAnalysis(analysis, founder) {
  const idea = String(analysis.idea || 'Startup').replace(/\s+/g, ' ').trim();
  const startupName = idea.length > 54 ? `${idea.slice(0, 54)}...` : idea;
  const region = analysis.region || founder.region || 'Remote';
  const score = Number(analysis.report?.scores?.overall || 60);
  const openings = score >= 75 ? 2 : 1;
  const stack = analysis.report?.technicalFeasibility?.stackRecommendation || 'MVP build, operations, customer research, and launch execution';
  const audience = analysis.report?.marketAnalysis?.audience || 'target customers in the selected market';

  return [
    {
      analysis: analysis._id,
      founder: founder._id,
      startupName,
      title: 'Startup Operations Lead',
      region,
      area: region,
      openings,
      requirement: `Own launch operations for ${startupName}, coordinate vendors, local setup, budget tracking, and weekly execution reviews.`
    },
    {
      analysis: analysis._id,
      founder: founder._id,
      startupName,
      title: 'Market Research Associate',
      region,
      area: region,
      openings: 1,
      requirement: `Interview ${audience}, validate pricing, map competitors, and turn findings into weekly founder decisions.`
    },
    {
      analysis: analysis._id,
      founder: founder._id,
      startupName,
      title: 'Growth and Partnerships Executive',
      region,
      area: region,
      openings,
      requirement: `Build local partnerships, run demand experiments, manage campaigns, and report funnel learnings for the approved startup.`
    },
    {
      analysis: analysis._id,
      founder: founder._id,
      startupName,
      title: 'MVP Product Builder',
      region,
      area: region,
      openings: 1,
      requirement: `Create the first customer-facing workflow using ${stack}. Focus on fast learning, reliable tracking, and simple UX.`
    }
  ];
}
