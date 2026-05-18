import { Router } from 'express';
import { z } from 'zod';
import { Application } from '../models/Application.js';
import { Job } from '../models/Job.js';
import { requireUser } from './authRoutes.js';

const router = Router();

const applySchema = z.object({
  note: z.string().trim().max(1000).optional().default('')
});

function regionMatches(jobRegion, requestedRegion) {
  if (!requestedRegion) return true;
  return String(jobRegion || '').toLowerCase().includes(String(requestedRegion).toLowerCase());
}

async function getImpact() {
  const jobs = await Job.find({ status: 'open' });
  const applications = await Application.find();
  const totalOpenings = jobs.reduce((sum, job) => sum + Number(job.openings || 0), 0);
  const totalApplications = applications.length;
  const hired = applications.filter((item) => item.status === 'hired').length;
  const employmentPercent = totalOpenings ? Math.min(100, Math.round((totalApplications / totalOpenings) * 100)) : 0;

  return {
    totalOpenings,
    totalApplications,
    hired,
    employmentPercent,
    chart: [
      { label: 'Openings', value: totalOpenings },
      { label: 'Applications', value: totalApplications },
      { label: 'Employment %', value: employmentPercent }
    ]
  };
}

export function createJobsRouter() {
  router.get('/', requireUser, async (req, res, next) => {
    try {
      const region = req.query.region || req.user?.region || '';
      const jobs = await Job.find({ status: 'open' })
        .sort({ createdAt: -1 })
        .populate('analysis', 'idea report.scores.overall report.verdict.label')
        .lean();
      const filtered = jobs.filter((job) => regionMatches(job.region, region));
      const applications = req.user
        ? await Application.find({ applicant: req.user._id, job: { $in: filtered.map((job) => job._id) } }).lean()
        : [];
      const appliedJobIds = new Set(applications.map((item) => String(item.job)));

      res.json({
        jobs: filtered.map((job) => ({ ...job, alreadyApplied: appliedJobIds.has(String(job._id)) })),
        impact: await getImpact()
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:id/apply', requireUser, async (req, res, next) => {
    try {
      if (req.user.role !== 'job-seeker') {
        return res.status(403).json({ error: 'Only job seekers can apply for jobs' });
      }

      const body = applySchema.parse(req.body);
      const job = await Job.findById(req.params.id);
      if (!job || job.status !== 'open') return res.status(404).json({ error: 'Job not found' });

      const application = await Application.findOneAndUpdate(
        { job: job._id, applicant: req.user._id },
        { note: body.note, status: 'applied' },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      res.status(201).json({ application, impact: await getImpact() });
    } catch (error) {
      if (error.code === 11000) return res.status(409).json({ error: 'You already applied for this job' });
      next(error);
    }
  });

  router.get('/impact', requireUser, async (_req, res, next) => {
    try {
      res.json({ impact: await getImpact() });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
