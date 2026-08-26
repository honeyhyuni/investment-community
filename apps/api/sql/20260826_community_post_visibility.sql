ALTER TABLE community_posts
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;
