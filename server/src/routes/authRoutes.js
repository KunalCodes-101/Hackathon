import crypto from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { User } from '../models/User.js';

const router = Router();
const TOKEN_SECRET = process.env.AUTH_TOKEN_SECRET || 'founderos-local-dev-secret';

const signupSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name'),
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['founder', 'job-seeker']).default('founder'),
  region: z.string().trim().optional().default('')
});

const signinSchema = z.object({
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password')
});

function publicUser(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    region: user.region
  };
}

function signToken(user) {
  const payload = Buffer.from(JSON.stringify({ userId: String(user._id), issuedAt: Date.now() })).toString('base64url');
  const signature = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export async function authenticate(req, _res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return next();

  try {
    const [payload, signature] = token.split('.');
    const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
    if (!signature || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return next();
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const user = await User.findById(parsed.userId);
    if (user) req.user = user;
  } catch {
    req.user = null;
  }

  return next();
}

export function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Sign in required' });
  return next();
}

export function createAuthRouter() {
  router.post('/signup', async (req, res, next) => {
    try {
      const body = signupSchema.parse(req.body);
      const existing = await User.findOne({ email: body.email.toLowerCase() });
      if (existing) return res.status(409).json({ error: 'An account already exists for this email' });

      const user = new User({
        name: body.name,
        email: body.email,
        role: body.role,
        region: body.region
      });
      user.setPassword(body.password);
      await user.save();

      res.status(201).json({ user: publicUser(user), token: signToken(user) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/signin', async (req, res, next) => {
    try {
      const body = signinSchema.parse(req.body);
      const user = await User.findOne({ email: body.email.toLowerCase() });
      if (!user || !user.checkPassword(body.password)) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      res.json({ user: publicUser(user), token: signToken(user) });
    } catch (error) {
      next(error);
    }
  });

  router.get('/me', requireUser, (req, res) => {
    res.json({ user: publicUser(req.user) });
  });

  return router;
}
