update community_posts
set title = '다음 생에도 나를 선택할 수 있도록',
    updated_at = now()
where id = (
  select id
  from community_posts
  where content like '%전일 분기 회식%'
    and content like '%삼쏘회동%'
  order by created_at desc
  limit 1
);