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

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/users', userRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/verification', verificationRoutes);

// HTML Page Routes
app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/login', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/login/index.html'));
});

app.get('/register', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/register/index.html'));
});

app.get('/home', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/home/index.html'));
});

app.get('/create', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/create/index.html'));
});

app.get('/search', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/search/index.html'));
});

app.get('/settings', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/settings/index.html'));
});

app.get('/verified', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/verified/index.html'));
});

app.get('/admin', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/admin/index.html'));
});

// Dynamic routes - Profile (@username)
app.get('/@:username', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/profile/index.html'));
});

// Dynamic routes - Hashtag
app.get('/hashtag/:tag', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/hashtag/index.html'));
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use(errorHandler);

// 404 handler - must be last
app.use((req: Request, res: Response) => {
  res.status(404).sendFile(path.join(__dirname, '../public/404.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Thazh Social Backend running on port ${PORT}`);
  console.log(`📊 Admin Dashboard: http://localhost:${PORT}/admin`);
  console.log(`🏠 Home Page: http://localhost:${PORT}/home`);
});

export default app;