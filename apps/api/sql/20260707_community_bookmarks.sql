CREATE TABLE IF NOT EXISTS community_post_bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_community_post_bookmarks_post_user UNIQUE (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_community_post_bookmarks_user_created
  ON community_post_bookmarks (user_id, created_at DESC);