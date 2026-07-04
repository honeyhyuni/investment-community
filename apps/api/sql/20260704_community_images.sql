create table if not exists community_images (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users(id) on delete cascade,
  post_id uuid references community_posts(id) on delete set null,
  filename varchar(80) not null unique,
  mime_type varchar(40) not null,
  width integer not null,
  height integer not null,
  size integer not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_community_images_owner on community_images(owner_id);
create index if not exists idx_community_images_post on community_images(post_id);
