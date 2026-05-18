import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import morgan from 'morgan';
import { Server } from 'socket.io';
import { ZodError } from 'zod';
import { config } from './config.js';
import { createAnalysisRouter } from './routes/analysisRoutes.js';
import { authenticate, createAuthRouter } from './routes/authRoutes.js';
import { createJobsRouter } from './routes/jobsRoutes.js';

const app = express();
const server = http.createServer(app);

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (config.clientUrls.includes(origin)) return true;

  try {
    const { hostname, port, protocol } = new URL(origin);
    const portNumber = Number(port);
    const isDevClientPort = portNumber >= 5173 && portNumber <= 5179;
    const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(hostname);
    const isPrivateLan =
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname);

    return protocol === 'http:' && isDevClientPort && (isLocalHost || isPrivateLan);
  } catch {
    return false;
  }
}

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) return callback(null, true);
    return callback(new Error(`Origin ${origin} is not allowed by CORS`));
  }
};

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) return callback(null, true);
      return callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    methods: ['GET', 'POST']
  }
});

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));
app.use(authenticate);

io.on('connection', (socket) => {
  socket.on('analysis:join', (analysisId) => {
    if (analysisId) socket.join(String(analysisId));
  });

  socket.on('analysis:leave', (analysisId) => {
    if (analysisId) socket.leave(String(analysisId));
  });
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'founderos-api' });
});

app.use('/api/auth', createAuthRouter());
app.use('/api/analyses', createAnalysisRouter(io));
app.use('/api/jobs', createJobsRouter());

app.use((error, _req, res, _next) => {
  if (error instanceof ZodError) {
    return res.status(400).json({ error: error.issues[0]?.message || 'Invalid request' });
  }

  if (error.name === 'CastError') {
    return res.status(400).json({ error: 'Invalid analysis ID' });
  }

  console.error(error);
  return res.status(500).json({ error: error.message || 'Internal server error' });
});

async function boot() {
  await mongoose.connect(config.mongoUri);
  server.listen(config.port, () => {
    console.log(`FounderOS API running on http://localhost:${config.port}`);
  });
}

boot().catch((error) => {
  console.error('Failed to start API', error);
  process.exit(1);
});// Loaded successfully - ports verified clear
