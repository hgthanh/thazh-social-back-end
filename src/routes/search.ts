// src/routes/search.ts
import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Search Users, Posts, and Hashtags
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { q, type = 'all' } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Search query required' });
    }

    const searchTerm = q.toLowerCase();
    const results: any = { users: [], posts: [], hashtags: [] };

    // Search Users
    if (type === 'all' || type === 'users') {
      const { data: users } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, is_verified, follower_count')
        .or(`username.ilike.%${searchTerm}%,display_name.ilike.%${searchTerm}%`)
        .limit(10);

      results.users = users || [];
    }

    // Search Posts
    if (type === 'all' || type === 'posts') {
      const { data: posts } = await supabase
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
        .ilike('content', `%${searchTerm}%`)
        .order('created_at', { ascending: false })
        .limit(20);

      results.posts = posts || [];
    }

    // Search Hashtags
    if (type === 'all' || type === 'hashtags') {
      const hashtagQuery = searchTerm.startsWith('#') ? searchTerm : `#${searchTerm}`;
      
      const { data: hashtags } = await supabase
        .from('hashtags')
        .select('*')
        .ilike('tag', `%${hashtagQuery}%`)
        .order('post_count', { ascending: false })
        .limit(10);

      results.hashtags = hashtags || [];
    }

    res.json(results);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get Posts by Hashtag
router.get('/hashtag/:tag', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tag } = req.params;
    const cleanTag = tag.startsWith('#') ? tag.toLowerCase() : `#${tag.toLowerCase()}`;

    // Get hashtag
    const { data: hashtag } = await supabase
      .from('hashtags')
      .select('*')
      .eq('tag', cleanTag)
      .single();

    if (!hashtag) {
      return res.status(404).json({ error: 'Hashtag not found' });
    }

    // Get posts with this hashtag
    const { data: postHashtags } = await supabase
      .from('post_hashtags')
      .select(`
        post_id,
        posts (
          *,
          profiles (
            id,
            username,
            display_name,
            avatar_url,
            is_verified
          )
        )
      `)
      .eq('hashtag_id', hashtag.id);

    const posts = postHashtags?.map(ph => ph.posts).filter(Boolean) || [];

    res.json({ hashtag, posts });
  } catch (error) {
    console.error('Hashtag search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get Trending Hashtags
router.get('/trending', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { data: hashtags, error } = await supabase
      .from('hashtags')
      .select('*')
      .order('post_count', { ascending: false })
      .limit(10);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ hashtags });
  } catch (error) {
    console.error('Trending hashtags error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;