# 멍동네 공개 버전 (GitHub Pages + Supabase)

로그인 없이 누구나 들어와서 같이 산책하고, 소원 장식을 달고, 단짝 자물쇠를 잠글 수 있는 버전이에요.

| 파일 | 하는 일 |
|---|---|
| `index.html` | 멍동네 화면 (Claude 아티팩트와 같은 내용) |
| `adapter.js` | 멍동네를 Supabase에 연결해요 |
| `config.js` | Supabase 주소와 공개용 키를 넣는 곳 |
| `supabase.sql` | Supabase에 한 번 실행하는 설정 (표, 보안 규칙, 실시간) |
| `build.py` | 아티팩트 파일이 바뀌면 `index.html`을 다시 만들어요 |

---

## 1단계. Supabase 만들기 (약 10분)

1. https://supabase.com 에서 가입하고 **New project**를 눌러요.
   - Name: `mung-village`
   - Region: **Northeast Asia (Seoul)**
   - Database password: 자동 생성된 비밀번호를 회사 비밀번호 관리자에 보관해 주세요. 저에게 보내지 마세요.
2. 왼쪽 메뉴 **SQL Editor** → **New query** → `supabase.sql` 파일 내용을 전부 붙여 넣고 **Run**.
   "Success. No rows returned"가 나오면 돼요.
3. 왼쪽 메뉴 **Authentication** → **Sign In / Providers** → **Allow anonymous sign-ins**를 켜고 저장해요.
   방문자가 회원가입 없이 들어오게 해 주는 설정이에요.
4. **Project Settings** → **API Keys** (또는 **Data API**)에서 두 가지를 복사해요.
   - **Project URL** (예: `https://abcd1234.supabase.co`)
   - **anon public** 키 (`eyJ...`로 시작하는 긴 글자)
   이 두 개는 웹페이지에 넣도록 만든 공개용이라 Claude에게 알려 줘도 괜찮아요.
   **service_role** 키는 절대 어디에도 붙여 넣지 마세요.

## 2단계. GitHub에 올리기 (약 5분)

1. https://github.com 에서 가입(또는 회사 조직 계정)하고 **New repository**를 눌러요.
   - Repository name: `mung-village`
   - **Public** 선택 (무료 GitHub Pages는 공개 저장소에서만 돼요)
2. 저장소 화면에서 **Add file** → **Upload files** → `index.html`, `adapter.js`, `config.js` 세 파일을 끌어다 놓고 **Commit changes**.
3. 저장소 **Settings** → **Pages** → Branch를 **main** / **/(root)**로 고르고 **Save**.
4. 1~2분 뒤 같은 화면 위쪽에 `https://<계정이름>.github.io/mung-village/` 주소가 생겨요. 이게 공개 주소예요.

## 3단계. 연결 확인

- `config.js`에 1단계의 Project URL과 anon 키가 들어가 있어야 해요. (Claude가 넣어 드릴 수 있어요)
- 공개 주소를 휴대폰과 컴퓨터에서 동시에 열어 보세요. 위쪽 버튼이 **"지금 2마리 산책 중"**이 되면 연결된 거예요.
- 자물쇠 언덕 → **단짝 · 초대** → 초대 코드 만들기 → **초대 메시지 복사**.
  공개 버전에서는 메시지 안의 링크만 누르면 친구가 바로 초대 화면으로 들어와요.

---

## 운영 메모

- **부적절한 글 지우기**: Supabase **Table Editor** → `docs` 표에서 해당 줄을 지우면 마을에서도 바로 사라져요.
  욕설 몇 가지는 화면에서 미리 막아 두었지만, 공개 전 운영자가 확인하는 방법을 정해 두는 게 좋아요.
- **단짝 초대 지표**: `supabase.sql` 맨 아래 6번 쿼리를 SQL Editor에서 실행하면 초대 수와 함께 잠근 수가 나와요.
- **무료 한도**: Supabase 무료 플랜은 동시 접속 200명, 월 활성 사용자 5만 명 정도까지 충분해요.
  캠페인으로 크게 알릴 때는 유료 플랜(월 25달러)을 검토해 주세요.
- **설채현 수의사 문구와 캐릭터**: 공개 전에 수의사 검수를 받아 주세요.
