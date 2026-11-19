-- 멍동네 Supabase 설정
-- Supabase 대시보드 > SQL Editor > New query 에 이 파일 전체를 붙여 넣고 Run 을 누르세요.

-- 1. 모든 기록을 담는 표 하나 (소원, 장식, 자물쇠, 단짝 초대, 개인 산책 기록)
create table if not exists public.docs (
  coll       text        not null,               -- 어떤 종류인지 (wishes, ornaments, locks, pals, palJoins, data/users/<내 id>)
  id         text        not null,               -- 한 사람당 하나: 보통 작성자 id
  data       jsonb       not null,
  owner      uuid        not null default auth.uid(),
  updated_at timestamptz not null default now(),
  primary key (coll, id),
  constraint data_small check (pg_column_size(data) < 8000)
);

alter table public.docs enable row level security;
grant select, insert, update, delete on public.docs to anon, authenticated;

-- 2. 읽기: 마을에 걸린 것은 누구나, 개인 산책 기록은 본인만
drop policy if exists "read shared" on public.docs;
create policy "read shared" on public.docs for select
  using (coll in ('wishes', 'ornaments', 'locks', 'pals', 'palJoins'));

drop policy if exists "read own progress" on public.docs;
create policy "read own progress" on public.docs for select
  using (coll = 'data/users/' || auth.uid()::text);

-- 3. 쓰기: 각자 자기 것만 만들고, 고치고, 지울 수 있어요
drop policy if exists "insert own" on public.docs;
create policy "insert own" on public.docs for insert
  with check (
    owner = auth.uid() and (
      (coll in ('wishes', 'ornaments', 'locks', 'pals', 'palJoins') and id = auth.uid()::text)
      or coll = 'data/users/' || auth.uid()::text
    )
  );

drop policy if exists "update own" on public.docs;
create policy "update own" on public.docs for update
  using (owner = auth.uid())
  with check (
    owner = auth.uid() and (
      (coll in ('wishes', 'ornaments', 'locks', 'pals', 'palJoins') and id = auth.uid()::text)
      or coll = 'data/users/' || auth.uid()::text
    )
  );

drop policy if exists "delete own" on public.docs;
create policy "delete own" on public.docs for delete
  using (owner = auth.uid());

-- 4. 실시간으로 다른 사람 화면에 바로 보이게
alter table public.docs replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;

-- 5. 운영자가 부적절한 글을 지울 때 (SQL Editor 에서 실행)
-- delete from public.docs where coll = 'wishes' and data->>'text' like '%지울 단어%';

-- 6. 단짝 초대 지표 (SQL Editor 에서 실행)
-- select
--   (select coalesce(sum(jsonb_array_length(data->'invs')), 0) from public.docs where coll = 'pals') as 초대_만든_수,
--   (select coalesce(sum(jsonb_array_length(data->'list')), 0) from public.docs where coll = 'palJoins') as 함께_잠근_수;
