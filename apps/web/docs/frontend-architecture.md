# 프론트엔드 아키텍처 & 컨벤션

> 이 문서는 `apps/web`의 **목표 구조와 규칙**이다. 새 코드를 짜거나 옮길 때 이 규칙을 따른다.
> 현재 진행 중인 마이그레이션 상태는 [`refactor-plan.md`](./refactor-plan.md) 참고.

---

## 1. 큰 그림

단일 거대 `app/page.tsx`(~3,800줄, `Home()` 한 컴포넌트에 state 62개)를 다음으로 분해한다:

- **멀티라우트** (Next App Router) — 뷰 스위칭을 URL 라우트로
- **`domain/` + `common/`** — 도메인 특화 코드 vs 범용 코드 분리
- **zustand 스토어** — 라우트 간 공유 상태
- **URL 쿼리파라미터** — 라우트 간 점프

---

## 2. 폴더 구조

```
src/
  app/
    layout.tsx              # root: html/body/폰트 + <Providers>
    providers.tsx           # 'use client' — 세션 라이프사이클(refresh + /auth/me 폴링)
    page.tsx                # 랜딩: 승인 유저 앱 (현재는 거대 Home, 추후 /stocks 리다이렉트)
    (guest)/                # 권한축: 비로그인/미승인 전용 route group
      layout.tsx            # 최소 셸: 타이틀 헤더
      login/page.tsx        # AuthPanel + PendingPanel (APPROVED면 / 로 리다이렉트)
    (auth)/                 # 권한축: 승인 유저 전용 route group
      layout.tsx            # 셸: 헤더 + MarketPulse + nav + 세션가드
      stocks/page.tsx
      news/page.tsx
      community/page.tsx
      admin/page.tsx
      profile/page.tsx
  domain/                   # 도메인 특화 (그 도메인 없어지면 같이 사라지는 것)
    markets/
      components/           # MarketPulse, StocksView, StockDetailPanel, RealtimeChart, QuoteCard ...
      hooks/                # useQuotes, useRealtimeTrades ...
      types.ts
    community/
      components/           # CommunityView, PostEditor, CommentThread, RelatedPosts ...
      hooks/
      types.ts
    auth/
      components/           # AuthPanel, AuthForm, AccountPanel, ProfilePanel, PendingPanel
      hooks/                # useSession ...
      types.ts
    admin/
      components/           # AdminPanel
  common/                   # 범용 (도메인 안 가림)
    components/             # InfoRow, InfoBox, StatusBadge, Notice, TextInput, MarkdownContent, SessionLoading, Placeholder
    lib/                    # format.ts, stock-search.ts, api.ts, community.ts (순수 유틸, 컴포넌트/훅 아님)
    stores/                 # session.ts, preferences.ts, market-data.ts (zustand)
    types.ts                # 도메인 안 가리는 공유 타입
```

### domain vs common 판단 기준
> **"이게 이 도메인 없어지면 같이 사라지나?"** → 예면 `domain/<name>/`, 아니면 `common/`.

예: `QuoteCard`는 markets 없으면 의미 없음 → `domain/markets`. `StatusBadge`/`Notice`는 어디서나 씀 → `common/components`. `formatMoney`는 순수 함수 → `common/lib`.

---

## 3. 네이밍 & 파일 규칙

- **1 파일 1 컴포넌트.** 파일명 = 컴포넌트명, `PascalCase.tsx` (예: `StockDetailPanel.tsx`)
- 훅: `camelCase.ts`, `use` 접두 (예: `useSession.ts`)
- lib/유틸: `kebab-case.ts` (예: `stock-search.ts`)
- 타입: 도메인 전용은 `domain/<name>/types.ts`, 범용은 `common/types.ts`
- import 별칭: `@/*` → `src/*` (예: `@/common/lib/format`, `@/domain/markets/components/QuoteCard`)

### 컴포넌트 폴더가 커질 때
- 처음엔 `domain/<name>/components/*` **평평하게**.
- 한 도메인 components가 **~8개를 넘거나** 뚜렷한 하위 묶음이 생기면 → **sub-feature 폴더로 nest** (page 이름 말고 **기능 이름**). 예:
  ```
  community/components/
    feed/       FeedList, FeedItem, FeedFilters
    editor/     PostEditor, ImageBlock, BlockToolbar
    comments/   CommentThread, CommentItem
  ```
- page 단위로 나누지 않는다 — 이 앱은 뷰≈도메인이라 page축은 domain 경계와 중복된다.

---

## 4. 라우팅 모델

라우트 그룹을 **유저 권한 축**으로 가른다. 두 그룹의 이름은 의미상 반대쌍:

| 그룹 | 대상 | 셸(layout) |
|---|---|---|
| `(auth)` | 승인된(`APPROVED`) 유저 전용 | 헤더 + MarketPulse + nav + 세션가드 |
| `(guest)` | 비로그인/미승인(`PENDING`/`REJECTED`) | 최소 셸(타이틀 헤더) |

> **왜 `(guest)`?** 처음엔 `(public)`을 고려했으나, Next의 정적 에셋 폴더 `public/`과 글자가 겹쳐 검색·리뷰에서 헷갈린다. `(auth)`(로그인 필요) ↔ `(guest)`(로그인 불필요)가 정확한 반대쌍이라 이 이름을 쓴다.

- **`(auth)` 그룹** — `(auth)/layout.tsx`가 셸을 그리고 세션을 가드한다.
  - `authChecking` → 로딩
  - 미승인/비로그인 → `/login`으로 `router.replace`
- **`/login`** (= `(guest)/login`) = `AuthPanel + PendingPanel`. 이미 승인된 세션이면 → `/`(→`/stocks`)로 리다이렉트.
- 세션 자체(`refresh`/`verify` 폴링)는 라우트 위 `app/providers.tsx`에서 1회 마운트해 `useSessionStore`로 공유한다. 두 그룹이 같은 세션을 본다.
- `app/page.tsx` = 랜딩(추후 `/stocks`로 리다이렉트).
- nav는 `next/navigation`의 `<Link>` / `usePathname`으로 활성표시.

### 라우트 간 점프 = URL 쿼리파라미터 (state 넘기기 금지)
- community → stocks (종목 선택): `/stocks?symbol=AAPL&market=US`
- stocks → community (특정 글): `/community?post=<id>`
- 각 라우트가 `useSearchParams`로 읽어서 초기 상태를 세팅한다.

---

## 5. 상태 전략

### 공유 상태 → zustand 스토어 (`common/stores/`)
라우트 위에서 살아야 하는 것만. 3개로 한정한다:

| 스토어 | 보유 | 비고 |
|---|---|---|
| `useSessionStore` | `accessToken`, `user`, `authChecking` + `login/logout/refresh/verify` | 파생값 `isAdmin`은 selector로 |
| `usePreferencesStore` | `language`, `darkMode` | localStorage 영속 |
| `useMarketDataStore` | `pulse`, `usStocks/usSymbols/krStocks/krSymbols`, `livePrices`, `marketLoading` + `loadMarketData` | 웹소켓 라이프사이클 포함. 여러 라우트가 공유 |

- **selector로 구독**해서 불필요한 리렌더 방지: `useSessionStore((s) => s.user)`.
- 스토어에는 **직렬화 가능한 상태 + 액션**만. DOM/소켓 인스턴스는 provider effect에서 관리.

### 라우트 로컬 상태 → 그 라우트(page) 또는 도메인 훅
- stocks: `selectedSymbol, stockDetail, chartPeriod, candles, search, stockTab ...`
- news: `news, newsPage, newsCategory`
- community: `posts, users, scope, sort, 에디터 state, 댓글 draft ...`
- admin: `pendingUsers` / profile: `nicknameDraft, ...`
- 복잡한 로컬 로직은 `domain/<name>/hooks/`의 훅으로 묶는다 (예: `useStocksView`, `useCommunityFeed`).

### 서버 상태 (`@tanstack/react-query`)
- **현재는 도입하지 않는다.** 기존 수동 `apiRequest` fetch 함수를 그대로 도메인 훅으로 옮긴다.
- react-query 전환은 구조/라우팅 안정화 **이후 별도 패스**로. (의존성은 이미 설치돼 있음)

---

## 6. 원칙 요약

1. 새 컴포넌트/훅/타입은 위 폴더 규칙 자리에 둔다. `app/page.tsx`에 새 로직을 더 쌓지 않는다.
2. 공유는 zustand, 로컬은 라우트/도메인 훅, 라우트 점프는 URL.
3. Next 16은 학습데이터와 다르다 — 라우팅/서버·클라이언트 경계는 `node_modules/next/dist/docs/`(레포 루트, workspace hoist) 확인 후 작성.
