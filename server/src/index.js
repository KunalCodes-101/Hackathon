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

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: config.clientUrl,
    methods: ['GET', 'POST']
  }
});

app.use(helmet());
app.use(cors({ origin: config.clientUrl }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

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

app.use('/api/analyses', createAnalysisRouter(io));

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
});
