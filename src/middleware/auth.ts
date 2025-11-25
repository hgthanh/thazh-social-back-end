// src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role?: string;
  };
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = {
      id: user.id,
      email: user.email!,
      role: user.role
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
};

export const requireAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Check if user has admin role in profiles table
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('id', req.user.id)
      .single();

    if (error || !profile?.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(403).json({ error: 'Admin access denied' });
  }
};