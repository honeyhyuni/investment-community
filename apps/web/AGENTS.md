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
- `/calendar`: calendar shell, defaults to IPO.
- `/calendar/ipo`: shareable IPO subscription/listing calendar.
- `/calendar/earnings`: shareable US earnings calendar.
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

## Push Notification And Mobile Refresh UI

- `NotificationCenter` is rendered in the authenticated header. Device Push permission and notification-type preferences are separate controls.
- Never request notification permission automatically after login. Request it only after an explicit user action such as "Enable on this device".
- Users can independently enable or disable watchlist price bands, earnings, IPO, market briefing, community reactions, and subscribed-author posts.
- `public/sw.js` handles `push` and `notificationclick`. Notification URLs must remain shareable authenticated routes.
- iOS Push requires iOS 16.4+ and an installed Home Screen PWA. Android and desktop Chromium PWAs are also supported.
- Service workers are registered only in production. After changing `sw.js`, bump `CACHE_NAME` and fully close/reopen an installed PWA during verification.
- `PullToRefresh` is mounted in the authenticated layout for screens below 640px. It activates only at page scroll position zero, ignores horizontal gestures and form/open-menu interactions, and reloads after a 72px pull threshold.

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

## Calendar And Earnings UI

- The main navigation label is `캘린더` / `Calendar`.
- Calendar tabs use the same segmented-control style as portfolio dashboard tabs.
- `공모주` shows IPO subscription/listing events.
- `미국실적` shows US earnings events from the API, not from direct browser calls to Alpha Vantage.
- Earnings routes must remain shareable: `/calendar/ipo` and `/calendar/earnings`.
- Earnings views:
  - Daily and weekly views exclude Saturday/Sunday.
  - Monthly view supports search. Searching a ticker/company should keep the calendar layout and show/highlight matching result cards on their report dates.
  - Monthly previous/next buttons must not navigate outside the DB bounds returned by `/markets/calendar/earnings/us/bounds`.
  - The UI should also respect the backend retention model: only the previous month and newer retained data should be reachable.
- US stock detail displays `nextEarnings` near the stock title action area, beside the watchlist/currency controls, not inside the company overview box.
- Hide `nextEarnings` if the report date is before today, even if stale data is accidentally returned.
- Translate earnings time labels in the UI:
  - `pre-market` -> `프리마켓`
  - `post-market` / after-market variants -> `애프터마켓`
  - unknown/missing -> `시간 미정`
- Keep the next-earnings badge responsive; do not truncate the text to `...` when Korean/English labels are longer.

## S&P 500 Financial And Earnings UI

- The stock-detail annual chart is shown only when S&P 500 financial data exists. Its More link routes to `/stocks/US/{symbol}/financials?currency=USD|KRW`.
- The detailed financial page supports annual/quarterly data and USD/KRW conversion.
- The earnings page route is `/stocks/US/{symbol}/earnings`. It displays revenue and EPS actual/estimate, estimate surprise, previous-quarter values/change, and year-ago values/change.
- Positive percentages use `text-positive` (green), and negative percentages use `text-negative` (red). Null comparisons render as `-`.
- Korean-friendly quarter labels are derived from the reporting period/date rather than blindly displaying a provider fiscal-quarter number. This is important for non-calendar fiscal years such as NVIDIA.
- All US-to-KRW values on stock prices, charts, financial details, and earnings use the shared Zustand `exchangeRate` loaded from the market-pulse quote `KIS_FX:USDKRW`. Conversion is USD x rate for KRW and KRW / rate for USD.
- The stock-detail earnings badge is a link to the earnings route. It shows the next scheduled event before release and a recent-period earnings link after actual data arrives.

## Stock Chart And Recent Stocks

- Chart periods include `1D`, `1M`, `3M`, `6M`, `1Y`, `3Y`, `5Y`, and `ALL`, and each selected period displays its return.
- The 20/50/120-day moving averages are calculated from daily history independently of the visible chart range. They are off by default; enabling them requests `indicators=true`, and server-side indicator results are cached.
- Korean 52-week ranges use the quote/detail providers with the Naver fallback. The stock header shows drawdown from the 52-week high and split-adjusted all-time high; 52-week high/low are not duplicated in the valuation panel.
- Stock detail company information intentionally omits open and previous-close boxes; those values remain part of quote calculations but are not displayed there.
- Recent stocks store canonical symbols but display the Korean company name from stock master data. Country-tab defaults must not be added automatically. The whole list and each individual item can be removed; the former recent-search feature is intentionally absent.

## Guru Portfolio UI

- Guru cards, detail headers, and portfolio maps display the report quarter and last collection time in KST. Freshness badges are green through 3 days, blue through 14 days, amber when older, and explicit when no collection history exists.
- Guru detail holdings support text search, sector filtering, activity filtering, and sorting. The full-exit filter uses `activityHoldings`; zero-weight positions display a red `전량매도` badge but are excluded from the current portfolio map.

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

- Working branch for requested changes: `LSH7` unless the user explicitly creates a newer branch.
- Docker image: `honeyhyuni12/investment-community-web:latest`
- Current operating VM: `172.16.11.137` (Ubuntu). The previous Rocky VM `172.16.11.126` was replaced after storage/VM corruption.
- Deployment directory: `/home/ncloud/investment-community`
- Public site: `https://15f.kro.kr/`
- Direct-IP fallback for infrastructure checks: `http://172.16.11.137/`
- Production VM `.env` should use `WEB_ORIGIN=https://15f.kro.kr`, `NEXT_PUBLIC_API_BASE_URL=/api`, and `REFRESH_COOKIE_SECURE=true`.

Never commit `.env`, credentials, tokens, passwords, generated logs, or local `.next` output.
