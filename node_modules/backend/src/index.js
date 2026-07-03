import express from 'express';
import path from 'path';
import cors from 'cors';

import morgan from 'morgan';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

import { notFound, errorHandler } from './middleware/error.middleware.js';
import apiRouter from './routes/index.js';

dotenv.config();

const app = express();

app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.use('/api', apiRouter);

// Serve uploaded doctor files (local storage)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

async function start() {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error('Missing MONGODB_URI in backend/.env');
  }

  await mongoose.connect(mongoUri);
  console.log('MongoDB connected');

  const httpServer = app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
  });

  // Socket.IO
  const { attachSocket } = await import('./socket/index.js');
  const io = attachSocket(httpServer);
  // Make io accessible to routes via req.app.get('io')
  app.set('io', io);

}


start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});


