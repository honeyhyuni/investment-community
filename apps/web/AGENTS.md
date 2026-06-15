# Web Agent Guide

This file describes the current frontend architecture and behavior contracts. Read it before changing `apps/web`.

## Stack And Structure

The Web app is Next.js 16 App Router + React 19 + TypeScript + Tailwind CSS + Zustand + Socket.IO + TipTap + lightweight-charts. It is also installable as a private PWA.

- `src/app`: route shells and thin route pages.
- `src/app/providers.tsx`: global session restore, preferences hydration, market-data loading, Socket.IO, and service-worker registration.
- `src/common/components`: reusable UI components.
- `src/common/lib`: I/O helpers such as `apiRequest`.
- `src/common/stores`: Zustand session/preferences/market-data stores.
- `src/common/utils`: pure shared helpers.
- `src/domain/<feature>`: feature components, hooks, types, and feature-specific utilities.

Keep route `page.tsx` files thin. Put feature behavior under `domain/<feature>`.

## Route Model

Authenticated routes use the `(auth)` layout, which owns the shared header, market pulse, navigation, approval guard, and mobile bottom navigation.

Important shareable routes:

- `/` with `?symbol=<symbol>&market=US|KR`: stock detail.
- `/community`: feed.
- `/community/<postId>`: shareable full post.
- `/community/<postId>/edit`: post editor.
- `/community/users/<userId>`: shareable user feed.
- `/market-briefing/<briefingId>`: shareable briefing.

Use router navigation and URL state for cross-feature navigation. Do not introduce hidden view-only state that prevents menu navigation or link sharing.

## Session Contract

- `useSessionStore` owns `accessToken`, user, and `authChecking`.
- Startup calls `/auth/refresh`; access token is not persisted in localStorage.
- API requests must use credentials so the refresh cookie is sent.
- `/auth/me` verification is focus/visibility aware and throttled to once per five minutes.
- Do not poll `/auth/me` every second.
- Authenticated API requests require both bearer access token and refresh cookie because the API guard validates both.

## Market Data Contract

`useMarketDataStore` owns:

- market pulse
- US/Korean stock lists and symbol lists
- exchange rate
- extra tag quotes
- live prices/series

Socket.IO:

- `market:trade` is primarily Finnhub/global/US live trade data.
- `market:pulse` broadcasts refreshed market pulse.
- Do not send Korean six-digit symbols to Finnhub and call that Korean real-time streaming.

Korean selected-stock behavior:

- `StocksPage` polls `/markets/stocks/quote?...&market=KR` every 15 seconds.
- The polling response includes authoritative `current`, `change`, `percentChange`, and `previousClose`.
- When converting the polling response to `TradeTick`, preserve all four values.
- `applyLiveTrade()` must prefer tick-provided change/percent change instead of recalculating from stale detail data.
- Korean list/detail prices should update through the shared store when a polling tick is applied.

If users see values such as `+(0.0%)` or a wrong sign immediately after selecting a Korean stock, inspect:

1. Whether `StocksPage` passed response change/percent change into the tick.
2. Whether `applyLiveTrade()` preferred the tick values.
3. Whether a stale detail `previousClose` was used for recalculation.

## Stock Symbols And Community Tags

Canonical tag storage:

```ts
// Korean
{ symbol: '000660', name: 'SK하이닉스', market: 'KR' }

// US
{ symbol: 'NVDA', name: 'NVIDIA Corp', market: 'US' }
```

Display rules:

- Korean tags display company names: `#SK하이닉스`, `#기아`, `#삼성전자`.
- US tags display tickers: `#NVDA`, `#AAPL`.
- Tag click routes with canonical symbol and correct market.

Critical invariants:

- Six-digit symbols are Korean stocks even if legacy post data incorrectly says `market: 'US'`.
- `resolveCommunityStockTag()` must repair legacy six-digit tags to `market: 'KR'`.
- `mergePrioritySymbols()` must preserve `quote.currency`; never force quote-derived symbols to USD.
- Tag search can match symbol or company name.
- Keep canonical Korean symbol internally because related-feed API queries use it.

When editing tag behavior, verify:

- Searching `SK하이닉스` suggests `#SK하이닉스` with code `000660`.
- Existing legacy `#000660` posts display as `#SK하이닉스` after symbols load.
- Clicking the tag routes to `/?symbol=000660&market=KR`.
- Related posts still load under stock `000660`.

## Community Editor And Rendering

- TipTap is the long-form WYSIWYG editor.
- Main post HTML is stored in `contentBlocks[0].text`.
- Rendering uses `RichContent`/`.tiptap-content`; preserve paragraph margins, whitespace, images, color, and font-size styles.
- Feed cards show a preview; double-click/open navigates to the full shareable route.
- Full post view supports comments and image expansion.
- Only authors may edit their content; admins may delete all posts/comments.

Do not replace TipTap with ad hoc paragraph/image block controls.

## PWA And Responsive UI

- PWA assets live under `public`.
- Service worker is registered only in production.
- The existing Web UI remains the desktop experience; use responsive CSS/layout for mobile/PWA.
- Do not create a separate app codebase.
- Check safe-area spacing, sticky headers, bottom navigation, text overflow, chart sizing, editor usability, and image behavior on mobile.
- Production PWA may cache old frontend assets. After deployment, a full app close/reopen or service-worker refresh may be required during verification.

## Styling Rules

- Reuse design tokens and existing common components.
- Use Lucide icons where available.
- Preserve cursor/hover/focus feedback on clickable controls.
- Keep cards restrained and avoid nested cards.
- Ensure Korean and English labels both fit.
- Some older source comments/strings contain mojibake. Do not copy corrupted strings into new UI; use valid UTF-8 Korean or ASCII English.

## API And News Expectations

- Korean stock news is requested through:
  `/markets/stocks/news?symbol=<six-digit>&market=KR&language=ko`
- Render the API response; do not independently invent company-name news queries in the Web.
- Stock/news/briefing loading failures should fail visibly or to an intentional empty state, not silently switch to unrelated content.

## Verification

Run from repository root:

```powershell
docker compose exec -T web npm run build
docker compose logs --tail=100 web
```

Before finishing market/community changes, manually verify:

- desktop and mobile routes
- stock tab switching
- Korean and US tag search/click
- Korean quote refresh/change percent
- full community post/comment flow
- PWA installed view when relevant

## Deployment

- Working branch for requested changes: `LSH`.
- Docker image: `honeyhyuni12/investment-community-web:latest`
- Operating VM: `172.16.11.126`
- Deployment directory: `/home/ncloud/investment-community`
- Public site: `https://15f.kro.kr/`

Never commit `.env`, credentials, tokens, passwords, generated logs, or local `.next` output.
