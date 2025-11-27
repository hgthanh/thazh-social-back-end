// src/routes/posts.ts
import { Router, Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { authenticate } from '../middleware/auth';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Get News Feed (All posts, newest first)
router.get('/feed', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const { data: posts, error } = await supabase
      .from('posts')
      .select(`
        *,
        profiles!posts_user_id_fkey (
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
      res.status(400).json({ error: error.message });
      return;
    }

    // Get like status for current user
    const postsWithLikes = await Promise.all(
      (posts || []).map(async (post: any) => {
        const { data: userLike } = await supabase
          .from('likes')
          .select('*')
          .eq('post_id', post.id)
          .eq('user_id', req.user!.id)
          .single();

        return {
          ...post,
          is_liked: !!userLike,
        };
      })
    );

    res.json({ posts: postsWithLikes });
  } catch (error) {
    console.error('Feed error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create Post
router.post(
  '/',
  authenticate,
  upload.single('media'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { content } = req.body;
      const file = req.file;

      if (!content && !file) {
        res.status(400).json({ error: 'Post must have content or media' });
        return;
      }

      let mediaUrl: string | null = null;
      let mediaType: 'image' | 'audio' | null = null;

      // Upload media to Supabase Storage
      if (file) {
        const fileExt = file.originalname.split('.').pop();
        const fileName = `${uuidv4()}.${fileExt}`;
        const filePath = `posts/${req.user!.id}/${fileName}`;

        // Determine media type
        if (file.mimetype.startsWith('image/')) {
          mediaType = 'image';
        } else if (file.mimetype.startsWith('audio/')) {
          mediaType = 'audio';
        }

        const { error: uploadError } = await supabase.storage
          .from('media')
          .upload(filePath, file.buffer, {
            contentType: file.mimetype,
            upsert: false,
          });

        if (uploadError) {
          res.status(400).json({ error: uploadError.message });
          return;
        }

        const { data: urlData } = supabase.storage
          .from('media')
          .getPublicUrl(filePath);

        mediaUrl = urlData.publicUrl;
      }

      // Extract hashtags from content
      const hashtags = content?.match(/#[\w]+/g) || [];

      // Create post
      const { data: post, error: postError } = await supabase
        .from('posts')
        .insert({
          user_id: req.user!.id,
          content: content || '',
          media_url: mediaUrl,
          media_type: mediaType,
          like_count: 0,
          comment_count: 0,
        })
        .select(`
          *,
          profiles!posts_user_id_fkey (
            id,
            username,
            display_name,
            avatar_url,
            is_verified
          )
        `)
        .single();

      if (postError) {
        res.status(400).json({ error: postError.message });
        return;
      }

      // Process hashtags
      if (hashtags.length > 0) {
        for (const tag of hashtags) {
          const cleanTag = tag.toLowerCase();

          // Insert or get hashtag
          const { data: hashtag, error: hashtagError } = await supabase
            .from('hashtags')
            .upsert({ tag: cleanTag }, { onConflict: 'tag' })
            .select()
            .single();

          if (!hashtagError && hashtag) {
            // Link post to hashtag
            await supabase
              .from('post_hashtags')
              .insert({ post_id: post.id, hashtag_id: hashtag.id });

            // Update hashtag post count
            await supabase.rpc('increment_hashtag_count', { hashtag_id: hashtag.id });
          }
        }
      }

      res.status(201).json({ post });
    } catch (error) {
      console.error('Create post error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Get Single Post
router.get('/:postId', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { postId } = req.params;

    const { data: post, error } = await supabase
      .from('posts')
      .select(`
        *,
        profiles!posts_user_id_fkey (
          id,
          username,
          display_name,
          avatar_url,
          is_verified
        )
      `)
      .eq('id', postId)
      .single();

    if (error || !post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    // Check if user liked this post
    const { data: userLike } = await supabase
      .from('likes')
      .select('*')
      .eq('post_id', post.id)
      .eq('user_id', req.user!.id)
      .single();

    res.json({ post: { ...post, is_liked: !!userLike } });
  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Like/Unlike Post
router.post('/:postId/like', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { postId } = req.params;

    // Check if already liked
    const { data: existingLike } = await supabase
      .from('likes')
      .select('*')
      .eq('post_id', postId)
      .eq('user_id', req.user!.id)
      .single();

    if (existingLike) {
      // Unlike
      await supabase
        .from('likes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', req.user!.id);

      // Decrement like count
      await supabase.rpc('decrement_post_likes', { post_id: postId });

      res.json({ message: 'Post unliked', is_liked: false });
    } else {
      // Like
      await supabase
        .from('likes')
        .insert({ post_id: postId, user_id: req.user!.id });

      // Increment like count
      await supabase.rpc('increment_post_likes', { post_id: postId });

      res.json({ message: 'Post liked', is_liked: true });
    }
  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get Post Comments
router.get('/:postId/comments', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { postId } = req.params;

    const { data: comments, error } = await supabase
      .from('comments')
      .select(`
        *,
        profiles!comments_user_id_fkey (
          id,
          username,
          display_name,
          avatar_url,
          is_verified
        )
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: false });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ comments });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add Comment
router.post('/:postId/comments', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { postId } = req.params;
    const { content } = req.body;

    if (!content) {
      res.status(400).json({ error: 'Comment content required' });
      return;
    }

    const { data: comment, error } = await supabase
      .from('comments')
      .insert({
        post_id: postId,
        user_id: req.user!.id,
        content,
      })
      .select(`
        *,
        profiles!comments_user_id_fkey (
          id,
          username,
          display_name,
          avatar_url,
          is_verified
        )
      `)
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    // Increment comment count
    await supabase.rpc('increment_post_comments', { post_id: postId });

    res.status(201).json({ comment });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete Post
router.delete('/:postId', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { postId } = req.params;

    // Check if post belongs to user
    const { data: post } = await supabase
      .from('posts')
      .select('*')
      .eq('id', postId)
      .single();

    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    if (post.user_id !== req.user!.id) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    // Delete media from storage if exists
    if (post.media_url) {
      const path = post.media_url.split('/').slice(-3).join('/');
      await supabase.storage.from('media').remove([path]);
    }

    // Delete post (cascade will handle related records)
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;