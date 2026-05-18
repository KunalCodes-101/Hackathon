import { Router } from 'express';
import { z } from 'zod';
import { Analysis } from '../models/Analysis.js';
import { createInitialAgents } from '../agents.js';
import { startAnalysisRun } from '../services/analysisRunner.js';

const router = Router();

const createAnalysisSchema = z.object({
  idea: z.string().trim().min(12, 'Describe the idea in at least 12 characters').max(2500),
  region: z.string().trim().min(2, 'Enter a valid region or locality')
});

export function createAnalysisRouter(io) {
  router.post('/', async (req, res, next) => {
    try {
      const body = createAnalysisSchema.parse(req.body);
      const analysis = await Analysis.create({
        idea: body.idea,
        region: body.region,
        status: 'queued',
        agents: createInitialAgents()
      });

      res.status(201).json({ analysis });
      startAnalysisRun({ analysisId: analysis._id, io });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id', async (req, res, next) => {
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

  router.get('/', async (_req, res, next) => {
    try {
      const analyses = await Analysis.find()
        .sort({ createdAt: -1 })
        .limit(20)
        .select('idea status report.verdict report.scores.overall createdAt updatedAt');
      res.json({ analyses });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
