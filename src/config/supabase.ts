// src/config/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

// Client for general use
export const supabase = createClient(supabaseUrl, supabaseKey);

// Admin client with service role for admin operations
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Database Types
export interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  cover_url?: string;
  bio?: string;
  follower_count: number;
  following_count: number;
  is_verified: boolean;
  created_at: string;
}

export interface Post {
  id: string;
  user_id: string;
  content: string;
  media_url?: string;
  media_type?: 'image' | 'audio';
  like_count: number;
  comment_count: number;
  created_at: string;
  profiles?: Profile;
}

export interface Like {
  user_id: string;
  post_id: string;
  created_at: string;
}

export interface Follow {
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: Profile;
}

export interface VerificationRequest {
  id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reviewed_at?: string;
  profiles?: Profile;
}

export interface Hashtag {
  id: string;
  tag: string;
  post_count: number;
  created_at: string;
}

export interface PostHashtag {
  post_id: string;
  hashtag_id: string;
}