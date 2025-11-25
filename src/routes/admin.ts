// src/routes/admin.ts
import { Router, Response } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

// Get Dashboard Statistics
router.get('/stats', async (req: AuthRequest, res: Response) => {
  try {
    // Total users
    const { count: totalUsers } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    // Total posts
    const { count: totalPosts } = await supabaseAdmin
      .from('posts')
      .select('*', { count: 'exact', head: true });

    // Total hashtags
    const { count: totalHashtags } = await supabaseAdmin
      .from('hashtags')
      .select('*', { count: 'exact', head: true });

    // Verified accounts
    const { count: verifiedAccounts } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('is_verified', true);

    // Pending verification requests
    const { count: pendingRequests } = await supabaseAdmin
      .from('verification_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    res.json({
      stats: {
        totalUsers: totalUsers || 0,
        totalPosts: totalPosts || 0,
        totalHashtags: totalHashtags || 0,
        verifiedAccounts: verifiedAccounts || 0,
        pendingVerificationRequests: pendingRequests || 0,
      },
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get All Verification Requests
router.get('/verification-requests', async (req: AuthRequest, res: Response) => {
  try {
    const { status = 'pending' } = req.query;

    const query = supabaseAdmin
      .from('verification_requests')
      .select(`
        *,
        profiles (
          id,
          username,
          display_name,
          avatar_url,
          follower_count
        )
      `)
      .order('created_at', { ascending: false });

    if (status !== 'all') {
      query.eq('status', status);
    }

    const { data: requests, error } = await query;

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ requests });
  } catch (error) {
    console.error('Get verification requests error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Approve Verification Request
router.post('/verification-requests/:requestId/approve', async (req: AuthRequest, res: Response) => {
  try {
    const { requestId } = req.params;

    // Get request
    const { data: request } = await supabaseAdmin
      .from('verification_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Request already processed' });
    }

    // Update request status
    await supabaseAdmin
      .from('verification_requests')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    // Verify user profile
    await supabaseAdmin
      .from('profiles')
      .update({ is_verified: true })
      .eq('id', request.user_id);

    res.json({ message: 'Verification request approved' });
  } catch (error) {
    console.error('Approve verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reject Verification Request
router.post('/verification-requests/:requestId/reject', async (req: AuthRequest, res: Response) => {
  try {
    const { requestId } = req.params;

    const { data: request } = await supabaseAdmin
      .from('verification_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Request already processed' });
    }

    await supabaseAdmin
      .from('verification_requests')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    res.json({ message: 'Verification request rejected' });
  } catch (error) {
    console.error('Reject verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get All Posts (with pagination)
router.get('/posts', async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const { data: posts, error } = await supabaseAdmin
      .from('posts')
      .select(`
        *,
        profiles (
          id,
          username,
          display_name,
          avatar_url,
          is_verified
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ posts });
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete Post (Admin)
router.delete('/posts/:postId', async (req: AuthRequest, res: Response) => {
  try {
    const { postId } = req.params;

    // Get post to delete media
    const { data: post } = await supabaseAdmin
      .from('posts')
      .select('*')
      .eq('id', postId)
      .single();

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Delete media from storage if exists
    if (post.media_url) {
      const path = post.media_url.split('/').slice(-3).join('/');
      await supabaseAdmin.storage.from('media').remove([path]);
    }

    // Delete post
    const { error } = await supabaseAdmin
      .from('posts')
      .delete()
      .eq('id', postId);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get All Users
router.get('/users', async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = supabaseAdmin
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (search && typeof search === 'string') {
      query = query.or(`username.ilike.%${search}%,display_name.ilike.%${search}%`);
    }

    const { data: users, error } = await query
      .range(offset, offset + Number(limit) - 1);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Ban/Suspend User
router.post('/users/:userId/ban', async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    // Update user status (you may want to add a banned field to profiles table)
    await supabaseAdmin
      .from('profiles')
      .update({ is_banned: true, ban_reason: reason })
      .eq('id', userId);

    // Optionally disable auth access
    // await supabaseAdmin.auth.admin.updateUserById(userId, { banned: true });

    res.json({ message: 'User banned successfully' });
  } catch (error) {
    console.error('Ban user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete Comment (Admin)
router.delete('/comments/:commentId', async (req: AuthRequest, res: Response) => {
  try {
    const { commentId } = req.params;

    const { error } = await supabaseAdmin
      .from('comments')
      .delete()
      .eq('id', commentId);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;