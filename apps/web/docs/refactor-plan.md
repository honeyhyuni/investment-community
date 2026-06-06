# 프론트 구조화 마이그레이션 플랜

> 거대 `app/page.tsx` → `domain`/`common` + 멀티라우트 전환.
> 규칙은 [`frontend-architecture.md`](./frontend-architecture.md). 이 문서는 **진행 상태 추적용**.

## 결정 로그
- 공유 상태: **zustand** (Context 대신) — prop-drilling 제거, selector 리렌더 최적화
- 서버 상태: **react-query는 이번엔 미도입** — 수동 fetch를 도메인 훅으로 이동만, 전환은 별도 패스
- 라우트 간 점프: **URL 쿼리파라미터** (state 전달 금지)
- 작업 브랜치: `refactor/web-structure`

## 작업 방식 약속
1. 한 Phase = 변경 → 검증 → 사용자 확인 → 커밋. 한 번에 다 하지 않는다.
2. 대량 자동 변환(스크립트로 대량 삭제 등)은 **실행 전에 먼저 보여주고 승인**받는다.
3. 검증 게이트: 각 Phase 후 `npx tsc --noEmit` + `npx eslint .` 통과. 동작 영향 큰 단계는 docker 앱으로 실제 확인.
4. 커밋/푸시는 사용자가 OK 할 때만. 리스크 낮은 것부터.

## Phase 진행표

- [ ] **Phase 0 — 문서화**: `docs/` + AGENTS.md 연결  ← *진행 중*
- [ ] **Phase 1 — 순수 유틸/타입 추출** (무위험, 단일 라우트 유지)
  - `common/types.ts` ← page.tsx의 도메인 타입 선언
  - `common/lib/format.ts` ← formatMoney/convertQuote/buildMetricItems/pickMetric 등
  - `common/lib/stock-search.ts` ← stockSearchScore/editDistance/mergePrioritySymbols
  - `common/lib/community.ts` ← communityBlocksToMarkdown/makeEditorBlockId
  - `common/lib/api.ts` ← 기존 `lib/api.ts` 이동
- [ ] **Phase 2 — leaf 컴포넌트 추출** (낮음, 여전히 Home()이 렌더)
  - `common/components/` ← InfoRow, InfoBox, StatusBadge, Notice, TextInput, MarkdownContent, SessionLoading, Placeholder
  - `domain/*/components/` ← MarketPulse, QuoteCard, AuthForm, CommentThread 등 props-only 컴포넌트부터
- [ ] **Phase 3 — zustand 스토어 + 상태 리프팅** (중간, 단일 라우트 유지)
  - `common/stores/session.ts`, `preferences.ts`, `market-data.ts`
  - `app/providers.tsx` 도입
  - Home()의 **공유** state(세션/언어/다크모드/마켓데이터/웹소켓)를 스토어로 교체
- [ ] **Phase 4 — 라우트 분리** (높음, 멀티 전환)
  - `(app)/layout.tsx` 셸 + 세션가드, `login/page.tsx`
  - 각 뷰 → `stocks|news|community|admin|profile/page.tsx`
  - nav를 `next/navigation`으로, 점프를 URL파라미터로
  - 거대 `Home()` 제거
- [ ] **Phase 5 — 정리 + QA**: 데드코드 제거, docker 앱으로 로그인/종목/커뮤니티/관리자 흐름 확인

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
