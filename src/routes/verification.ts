// src/routes/verification.ts
import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Submit Verification Request
router.post('/request', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    // Check if user already has a pending or approved request
    const { data: existingRequest } = await supabase
      .from('verification_requests')
      .select('*')
      .eq('user_id', req.user!.id)
      .in('status', ['pending', 'approved'])
      .single();

    if (existingRequest) {
      if (existingRequest.status === 'approved') {
        return res.status(400).json({ error: 'Account already verified' });
      }
      return res.status(400).json({ error: 'Verification request already pending' });
    }

    // Create verification request
    const { data: request, error } = await supabase
      .from('verification_requests')
      .insert({
        user_id: req.user!.id,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json({
      message: 'Verification request submitted successfully',
      request,
    });
  } catch (error) {
    console.error('Verification request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get User's Verification Request Status
router.get('/status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { data: request, error } = await supabase
      .from('verification_requests')
      .select('*')
      .eq('user_id', req.user!.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !request) {
      return res.json({ status: 'none', message: 'No verification request found' });
    }

    res.json({ request });
  } catch (error) {
    console.error('Get verification status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;