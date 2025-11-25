// src/routes/verification.ts
import { Router as RouterVerif, Response as ResponseVerif } from 'express';
import { supabase as supabaseVerif } from '../config/supabase';
import { authenticate as authenticateVerif, AuthRequest as AuthRequestVerif } from '../middleware/auth';

const routerVerif = RouterVerif();

// Submit Verification Request
routerVerif.post('/request', authenticateVerif, async (req: AuthRequestVerif, res: ResponseVerif): Promise<void> => {
  try {
    const { data: existingRequest } = await supabaseVerif
      .from('verification_requests')
      .select('*')
      .eq('user_id', req.user!.id)
      .in('status', ['pending', 'approved'])
      .single();

    if (existingRequest) {
      if (existingRequest.status === 'approved') {
        res.status(400).json({ error: 'Account already verified' });
        return;
      }
      res.status(400).json({ error: 'Verification request already pending' });
      return;
    }

    const { data: request, error } = await supabaseVerif
      .from('verification_requests')
      .insert({
        user_id: req.user!.id,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
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
routerVerif.get('/status', authenticateVerif, async (req: AuthRequestVerif, res: ResponseVerif): Promise<void> => {
  try {
    const { data: request, error } = await supabaseVerif
      .from('verification_requests')
      .select('*')
      .eq('user_id', req.user!.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !request) {
      res.json({ status: 'none', message: 'No verification request found' });
      return;
    }

    res.json({ request });
  } catch (error) {
    console.error('Get verification status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default routerVerif;