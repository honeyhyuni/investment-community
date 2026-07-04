update community_posts
set title = '제목없음'
where title is null or btrim(title) = '';

create or replace function normalize_community_post_title()
returns trigger
language plpgsql
as $$
begin
  if new.title is null or btrim(new.title) = '' then
    new.title := '제목없음';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_normalize_community_post_title on community_posts;
create trigger trg_normalize_community_post_title
before insert or update of title on community_posts
for each row execute function normalize_community_post_title();