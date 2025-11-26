// src/routes/users.ts
import { Router, Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { authenticate } from '../middleware/auth';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Get User Profile
router.get('/:username', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { username } = req.params;

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !profile) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Get user's posts
    const { data: posts } = await supabase
      .from('posts')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false });

    // Check if current user follows this profile
    const { data: followData } = await supabase
      .from('follows')
      .select('*')
      .eq('follower_id', req.user!.id)
      .eq('following_id', profile.id)
      .single();

    // Calculate total likes received
    const { data: likesData } = await supabase
      .from('posts')
      .select('like_count')
      .eq('user_id', profile.id);

    const totalLikes = likesData?.reduce((sum: number, post: any) => sum + (post.like_count || 0), 0) || 0;

    res.json({
      profile: {
        ...profile,
        is_following: !!followData,
        total_likes_received: totalLikes,
      },
      posts: posts || [],
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update Profile
router.put(
  '/profile',
  authenticate,
  upload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'cover', maxCount: 1 },
  ]),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { displayName, bio } = req.body;
      const files = req.files as any;

      const updates: any = {};

      if (displayName) updates.display_name = displayName;
      if (bio !== undefined) updates.bio = bio;

      // Upload avatar
      if (files?.avatar && files.avatar[0]) {
        const file = files.avatar[0];
        const fileExt = file.originalname.split('.').pop();
        const fileName = `avatar-${uuidv4()}.${fileExt}`;
        const filePath = `avatars/${req.user!.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('media')
          .upload(filePath, file.buffer, {
            contentType: file.mimetype,
            upsert: true,
          });

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('media')
            .getPublicUrl(filePath);
          updates.avatar_url = urlData.publicUrl;
        }
      }

      // Upload cover
      if (files?.cover && files.cover[0]) {
        const file = files.cover[0];
        const fileExt = file.originalname.split('.').pop();
        const fileName = `cover-${uuidv4()}.${fileExt}`;
        const filePath = `covers/${req.user!.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('media')
          .upload(filePath, file.buffer, {
            contentType: file.mimetype,
            upsert: true,
          });

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('media')
            .getPublicUrl(filePath);
          updates.cover_url = urlData.publicUrl;
        }
      }

      if (Object.keys(updates).length === 0) {
        res.status(400).json({ error: 'No updates provided' });
        return;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', req.user!.id)
        .select()
        .single();

      if (error) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.json({ profile });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Follow User
router.post('/:userId/follow', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    if (userId === req.user!.id) {
      res.status(400).json({ error: 'Cannot follow yourself' });
      return;
    }

    const { data: existingFollow } = await supabase
      .from('follows')
      .select('*')
      .eq('follower_id', req.user!.id)
      .eq('following_id', userId)
      .single();

    if (existingFollow) {
      res.status(400).json({ error: 'Already following this user' });
      return;
    }

    const { error } = await supabase
      .from('follows')
      .insert({
        follower_id: req.user!.id,
        following_id: userId,
      });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    await supabase.rpc('increment_following_count', { user_id: req.user!.id });
    await supabase.rpc('increment_follower_count', { user_id: userId });

    res.json({ message: 'User followed successfully' });
  } catch (error) {
    console.error('Follow user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Unfollow User
router.delete('/:userId/follow', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', req.user!.id)
      .eq('following_id', userId);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    await supabase.rpc('decrement_following_count', { user_id: req.user!.id });
    await supabase.rpc('decrement_follower_count', { user_id: userId });

    res.json({ message: 'User unfollowed successfully' });
  } catch (error) {
    console.error('Unfollow user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get Followers
router.get('/:userId/followers', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const { data: followers, error } = await supabase
      .from('follows')
      .select(`
        follower_id,
        profiles!follows_follower_id_fkey (
          id,
          username,
          display_name,
          avatar_url,
          is_verified
        )
      `)
      .eq('following_id', userId);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ followers: followers.map((f: any) => f.profiles) });
  } catch (error) {
    console.error('Get followers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get Following
router.get('/:userId/following', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const { data: following, error } = await supabase
      .from('follows')
      .select(`
        following_id,
        profiles!follows_following_id_fkey (
          id,
          username,
          display_name,
          avatar_url,
          is_verified
        )
      `)
      .eq('follower_id', userId);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ following: following.map((f: any) => f.profiles) });
  } catch (error) {
    console.error('Get following error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;