// src/index.ts
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import authRoutes from './routes/auth';
import postRoutes from './routes/posts';
import userRoutes from './routes/users';
import searchRoutes from './routes/search';
import adminRoutes from './routes/admin';
import verificationRoutes from './routes/verification';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files for admin dashboard
app.use('/admin', express.static(path.join(__dirname, '../public/admin')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/users', userRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/verification', verificationRoutes);

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root route
app.get('/', (req: Request, res: Response) => {
  res.json({ 
    message: 'Thazh Social API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      posts: '/api/posts',
      users: '/api/users',
      search: '/api/search',
      admin: '/api/admin',
      verification: '/api/verification'
    }
  });
});

// Error handling
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Thazh Social Backend running on port ${PORT}`);
  console.log(`📊 Admin Dashboard: http://localhost:${PORT}/admin`);
});

export default app;