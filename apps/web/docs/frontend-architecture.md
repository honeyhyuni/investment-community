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
    providers.tsx           # 'use client' — 전역 라이프사이클(세션 refresh/verify 폴링, 마켓 로드+웹소켓, prefs hydrate)
    (guest)/                # 권한축: 비로그인/미승인 전용 route group
      layout.tsx            # 최소 셸: 타이틀 헤더
      login/page.tsx        # AuthPanel + PendingPanel (APPROVED면 / 로 리다이렉트)
    (auth)/                 # 권한축: 승인 유저 전용 route group
      layout.tsx            # ★ 공유 셸: 세션가드 + 헤더 + MarketPulse + nav. 라우트 간 유지됨
      page.tsx              # / = 종목(stocks) 뷰  ← 이 그룹의 인덱스
      community/page.tsx    # 얇은 래퍼: <Suspense><CommunityPage/></Suspense>
      news/page.tsx         # → <NewsPage/>
      admin/page.tsx        # → <AdminPage/>
      profile/page.tsx      # → <ProfilePage/>
  domain/                   # 도메인 특화 (그 도메인 없어지면 같이 사라지는 것)
    markets/
      components/           # StocksPage, MarketPulse, StocksView, StockDetailPanel, RealtimeChart, QuoteCard, RelatedPosts
      hooks/                # useStockRouteSelection (URL ?symbol= 동기화)
      utils/                # format.ts (formatMarketCap, translateDetailLabel, buildMetricItems — 종목 전용)
      types.ts              # StockTab, ChartPeriod, StockDetail, CandlePoint
    community/
      components/           # CommunityPage, PostCard, PostEditor, CommentThread, StockTagQuote ...
      types.ts
    news/
      components/           # NewsPage
      types.ts
    admin/
      components/           # AdminPage (AdminPanel 포함)
    profile/
      components/           # ProfilePage
    auth/
      components/           # AuthPanel, AuthForm, PendingPanel
      types.ts              # AuthMode
  common/                   # 범용 (도메인 안 가림)
    components/             # StatusBadge(+statusLabel), Notice, TextInput, SessionLoading, RichContent(TipTap HTML 렌더)
    lib/                    # api.ts (HTTP 클라이언트/인프라 래퍼 — 상태/부수효과 있음)
    utils/                  # format.ts, stock-search.ts, community.ts (순수 함수 헬퍼 — 입력→출력)
    stores/                 # session.ts, preferences.ts, market-data.ts (zustand)
    types.ts                # Language, DisplayCurrency, MarketQuote, StockSymbol, TradeTick (도메인 안 가리는 공유 타입)
```

> **`*Page` 컨벤션:** 각 (auth) 라우트의 `page.tsx`는 `domain/<name>/components/<Name>Page.tsx`를 렌더하는 **얇은 Suspense 래퍼**다. 뷰 로직(state/effect/핸들러 + 콘텐츠 JSX)은 그 `*Page` 컴포넌트에 산다. (종목 `/` = `StocksPage`, community/news/admin/profile도 동일 패턴.)

### domain vs common 판단 기준
> **"이게 이 도메인 없어지면 같이 사라지나?"** → 예면 `domain/<name>/`, 아니면 `common/`.

예: `QuoteCard`는 markets 없으면 의미 없음 → `domain/markets`. `StatusBadge`/`Notice`는 어디서나 씀 → `common/components`. `formatMoney`는 순수 함수 → `common/utils`.

> **에디터:** community 글쓰기는 **TipTap**(WYSIWYG) 사용. 콘텐츠는 **HTML**로 저장(`contentBlocks[0].text`), 렌더는 `common/components/RichContent`(dangerouslySetInnerHTML + `.tiptap-content` 스타일). 에디터/렌더가 `.tiptap-content` CSS(globals.css)를 공유. 마크다운 미사용.

---

## 3. 네이밍 & 파일 규칙

- **1 파일 1 컴포넌트.** 파일명 = 컴포넌트명, `PascalCase.tsx` (예: `StockDetailPanel.tsx`)
- 훅: `camelCase.ts`, `use` 접두 (예: `useSession.ts`)
- lib/utils 파일: `kebab-case.ts` (예: `stock-search.ts`)
  - **`utils/`** = 순수 함수(입력→출력, 부수효과 없음): `format`, `stock-search`, `community`.
  - **`lib/`** = 외부 I/O·인프라 래퍼(fetch 클라이언트 등): `api`. *"호출하면 네트워크/상태가 움직이나?" → 예면 lib, 아니면 utils.*
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

- **`(auth)/layout.tsx`가 셸 + 가드를 단독 소유한다.**
  - `authChecking` → 로딩, 미승인/비로그인 → `/login`으로 `router.replace`. APPROVED일 때만 `{children}` 렌더.
  - 헤더(언어/다크모드/프로필/로그아웃) + MarketPulse + nav를 여기서만 그린다.
  - nav 활성표시는 `usePathname()`, 이동은 `router.push(href)` (admin 항목은 `isAdmin`일 때만).
- **`/login`** (= `(guest)/login`) = `AuthPanel + PendingPanel`. 이미 승인된 세션이면 → `/`로 리다이렉트.
- 전역 라이프사이클(세션 `refresh`/`verify`, 마켓 로드+웹소켓, prefs `hydrate`)은 라우트 위 `app/providers.tsx`에서 1회 마운트한다.

### ★ 페이지 vs 셸 경계 (새 라우트 추가 시 핵심 규칙)
- **route `page.tsx`와 `*Page` 컴포넌트는 "콘텐츠"만 렌더한다.** 셸(`<main>/<section>/<header>/MarketPulse/<nav>`)·세션가드·다크모드 래퍼를 **페이지에 다시 그리지 않는다** — 전부 `(auth)/layout.tsx` 소유. 페이지는 보통 `<>...</>` 프래그먼트를 반환.
- 페이지는 APPROVED를 가정한다(레이아웃이 보장). 추가 권한이 필요하면 그것만 가드 (예: `AdminPage`의 `isAdmin` 체크 → 아니면 `router.replace("/")` + `return null`).
- 공유 상태는 페이지에서 **스토어 selector로 직접 구독** (`usePreferencesStore((s) => s.language)` 등). 셸 전용 값(pulse/darkMode 등)은 페이지로 내려보내지 않는다.

### 라우트 간 점프 = URL 쿼리파라미터 (state 넘기기 금지)
- community → stocks (종목 선택): `/?symbol=AAPL&market=US` (종목 뷰는 현재 `/`)
- stocks → community (특정 글): `/community?post=<id>`
- 각 라우트가 `useSearchParams`로 읽어 초기 상태 세팅. 종목 동기화는 `useStockRouteSelection` 훅 사용.

---

## 5. 상태 전략

### 공유 상태 → zustand 스토어 (`common/stores/`)
라우트 위에서 살아야 하는 것만. 3개로 한정한다:

| 스토어 | 보유 | 비고 |
|---|---|---|
| `useSessionStore` | `accessToken`, `user`, `authChecking` + `login/register/logout/refresh/verify/setUser` | 파생값 `isAdmin`은 selector로 |
| `usePreferencesStore` | `language`, `darkMode`, `hydrated` + `set/toggle` + `hydrate` | localStorage 영속. **하단 hydrate 패턴 필수** |
| `useMarketDataStore` | `pulse`, `usStocks/usSymbols/krStocks/krSymbols`, `livePrices`, `liveSeries`, `marketLoading` + `loadMarketData`(구독할 심볼 반환), `applyTrade` | 소켓 인스턴스는 store에 두지 않음 — `providers`가 소유 |

- **selector로 구독**해서 불필요한 리렌더 방지: `useSessionStore((s) => s.user)`.
- 스토어에는 **직렬화 가능한 상태 + 액션**만. DOM/소켓 인스턴스는 `providers` effect에서 관리.
- **클라이언트 전용 영속값(localStorage)은 hydrate 패턴으로.** SSR 기본값으로 시작 → `providers`의 effect에서 `hydrate()` 1회 호출해 localStorage 반영. 렌더 중 `useState(() => localStorage...)` lazy-init **금지**(서버/클라 불일치 → 하이드레이션 mismatch). 다크모드/언어가 이 방식.

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

## 6. 다국어(i18n) 컨벤션

**전용 i18n 라이브러리는 없다.** 언어는 `usePreferencesStore`의 `language: "en" | "ko"` 하나로 관리하고, 컴포넌트가 직접 분기한다.

- **모든 사용자 노출 문자열은 언어 대응이 필수다.** 버튼 라벨·placeholder·empty/loading 문구는 물론 `window.confirm/prompt` 다이얼로그까지 포함. 하드코딩 한국어를 그대로 두면 언어 토글에 반응하지 않는다 — **가장 흔한 누락**이다(예: 초기 `CommunityPage`는 `language`를 안 읽어 버튼이 안 바뀌었다).
- 패턴: 컴포넌트에서 `const language = usePreferencesStore((s) => s.language)` 구독 → 짧게 `const ko = language === "ko"` → `{ko ? "최신순" : "Latest"}`.
  - 동적 문장은 템플릿 리터럴로 분기: `` ko ? `구독자 ${n}` : `${n} followers` ``.
  - 셸(헤더/nav 라벨), `NewsPage`/`StocksPage` 등은 이미 이 방식. 새 컴포넌트도 동일하게.
- **새 문자열을 추가할 때 ko/en 둘 다 적는다.** 한쪽만 적고 "나중에" 미루지 않는다 — 미작성이 곧 미번역 버그다.
- **UI 칩(chrome) vs 서버 콘텐츠 구분:** 뉴스 본문·종목명처럼 서버에서 오는 텍스트는 API의 `language` 파라미터로 받는다(예: `/markets/news?...&language=ko`). 컴포넌트 분기는 UI 라벨에만.
- 한계: 단일 분기라 문자열이 많아지면 장황하다. 메시지 카탈로그/i18n 라이브러리 도입은 구조 안정화 **이후 별도 패스**로(react-query 전환과 동일 기조).

---

## 7. 원칙 요약

1. 새 컴포넌트/훅/타입은 위 폴더 규칙 자리에 둔다. `app/page.tsx`에 새 로직을 더 쌓지 않는다.
2. 공유는 zustand, 로컬은 라우트/도메인 훅, 라우트 점프는 URL.
3. Next 16은 학습데이터와 다르다 — 라우팅/서버·클라이언트 경계는 `node_modules/next/dist/docs/`(레포 루트, workspace hoist) 확인 후 작성.
4. 사용자 노출 문자열은 항상 `language` 대응 — 새 문자열은 ko/en 둘 다 작성한다(§6).
