# 프론트 구조화 마이그레이션 플랜

> 거대 `app/page.tsx` → `domain`/`common` + 멀티라우트 전환.
> 규칙은 [`frontend-architecture.md`](./frontend-architecture.md). 이 문서는 **진행 상태 추적용**.

## 결정 로그
- 공유 상태: **zustand** (Context 대신) — prop-drilling 제거, selector 리렌더 최적화
- 서버 상태: **react-query는 이번엔 미도입** — 수동 fetch를 도메인 훅으로 이동만, 전환은 별도 패스
- 라우트 간 점프: **URL 쿼리파라미터** (state 전달 금지)
- 라우트 그룹: **권한축으로 `(auth)`(승인 유저) ↔ `(guest)`(비로그인/미승인)**. `(public)`은 정적 `public/` 폴더와 혼동돼 폐기.
- 첫 분리는 **auth 수직 슬라이스** — 로그인을 라우트로 떼려면 세션 공유가 선결이라, 세션 스토어→providers→`(guest)/login` 순으로 한 도메인을 세로로 완성. (Phase 2~4를 auth만 가로지름)
- 작업 브랜치: `refactor/web-structure`

## 작업 방식 약속
1. 한 Phase = 변경 → 검증 → 사용자 확인 → 커밋. 한 번에 다 하지 않는다.
2. 대량 자동 변환(스크립트로 대량 삭제 등)은 **실행 전에 먼저 보여주고 승인**받는다.
3. 검증 게이트: 각 Phase 후 `npx tsc --noEmit` + `npx eslint .` 통과. 동작 영향 큰 단계는 docker 앱으로 실제 확인.
4. 커밋/푸시는 사용자가 OK 할 때만. 리스크 낮은 것부터.

## 진행 현황 (멀티라우트 + 공유 셸 — 거의 완료)

거대 `Home()`을 해체하고 권한축 라우트 그룹 + 공유 셸로 전환 완료. 매 단계 tsc 0 / eslint 0 에러 / `next build`(9페이지) / dev 라우트 200 통과.

**라우팅/셸**
- `(guest)/login` — 로그인/승인대기. `(auth)/` — 승인 유저 앱.
- `(auth)/layout.tsx` — **공유 셸**(세션가드 + 헤더 + MarketPulse + nav). 라우트 간 유지. 각 페이지는 콘텐츠만 렌더.
- 뷰 라우트: `/`(종목), `/community`, `/news`, `/admin`, `/profile`. community/news/admin/profile은 `domain/<name>/components/<Name>Page.tsx`를 렌더하는 얇은 Suspense 래퍼.

**스토어 (3개 모두 완료)**
- `session.ts` / `market-data.ts`(시세+`liveSeries`+`applyTrade`, 소켓은 providers) / `preferences.ts`(language·darkMode, **hydrate 패턴**으로 SSR-safe).
- `providers.tsx` — 세션 refresh/verify 폴링 + 마켓 로드/웹소켓 + prefs hydrate를 전역 1회 마운트.

**유틸/타입 추출** (lib = I/O 래퍼, utils = 순수 함수)
- `common/types.ts`(Language/DisplayCurrency/MarketQuote/StockSymbol/TradeTick)
- `common/utils/`: `format.ts`(공유 formatMoney/formatNumber/convertMoneyValue — MarketPulse·StockTagQuote 중복 제거), `stock-search.ts`
- `domain/community/utils.ts`: 커뮤니티 글/에디터/태그 정규화 헬퍼
- `common/lib/api.ts` (기존 `src/lib/api.ts` 이동)

- 종목 뷰 `domain/markets/components/StocksPage.tsx`로 추출 완료 → `(auth)/page.tsx`는 13줄 래퍼. 종목 전용 formatter는 `domain/markets/utils/format.ts`, 타입은 `domain/markets/types.ts`. (데드코드 `convertQuote` 제거)

**남은 것**
- 승인 계정으로 로그인→앱→로그아웃 + 라우트 이동/언어영속 브라우저 QA.
- (선택) `StocksPage.tsx`(901줄) 내 sub-component(StockDetailPanel/RealtimeChart/QuoteCard 등) 개별 파일 분리, 기존 eslint warning(exhaustive-deps) 정리.

## Phase 진행표

- [x] **Phase 0 — 문서화**: `docs/` + AGENTS.md 연결
- [x] **Phase 1 — 순수 유틸/타입 추출** — `common/types.ts`, `common/utils/{stock-search,format}.ts`, `common/lib/api.ts`, `domain/community/utils.ts`, `domain/markets/{types,utils/format}.ts`
- [x] **Phase 2 — leaf/도메인 컴포넌트 추출** — auth/markets/community/news/admin/profile + 공용(StatusBadge/Notice/TextInput/SessionLoading/MarkdownContent)
- [x] **Phase 3 — zustand 스토어 + 상태 리프팅** — session/market-data/preferences 전부, providers로 라이프사이클 일원화
- [x] **Phase 4 — 라우트 분리** — `(guest)/login`, `(auth)/layout` 공유 셸, 뷰 라우트 5개 전부 얇은 래퍼, nav(usePathname)+URL 점프, `Home()` 해체, 종목 `StocksPage` 추출
- [ ] **Phase 5 — 정리 + QA**: 승인 계정 브라우저 QA, sub-component 추가 분리(선택), warning 정리

## 상태 분류 참조 (Phase 3에서 사용)

**🌐 공유 (스토어로)**
- session: `accessToken`, `user`, `authChecking`, (`isAdmin` 파생)
- preferences: `language`, `darkMode`
- marketData: `pulse`, `usStocks`, `usSymbols`, `krStocks`, `krSymbols`, `livePrices`, `marketLoading`
- 전역 알림: `error`, `message`

**📄 라우트 로컬 (각 page/도메인 훅으로)**
- stocks: `stockTab, selectedSymbol, stockDetail, chartPeriod, priceCurrency, candles, chartLoading, search, liveSeries, relatedPosts`
- news: `news, newsPage, newsCategory`
- community: `communityPosts, communityUsers, communityScope, feedSort, editingPostId, selectedCommunityPostId, postTitle, postContent, postBlocks, postImages, postTagQuery, postTags, commentDrafts, replyDrafts, communityLoading`
- admin: `pendingUsers, loading`
- profile: `profileMessage, profileError, profileLoading, nicknameDraft, currentPassword, newPassword, confirmPassword`
- login: `mode, email, password, nickname`

**🔀 라우트 간 점프 → URL**
- `openTaggedStock` (community→stocks): `/stocks?symbol=<>&market=<>`
- `openRelatedPost` (stocks→community): `/community?post=<id>`
