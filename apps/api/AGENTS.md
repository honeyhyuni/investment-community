# API Agent Guide

This file describes the current backend contracts and operational decisions. Read it before changing `apps/api`.

## Scope And Structure

The API is a NestJS + TypeScript service using PostgreSQL, TypeORM, Redis, Socket.IO, and scheduled jobs.

- `src/auth`: login, refresh-cookie sessions, profile/password changes, JWT guards.
- `src/users`: approval workflow and admin user management.
- `src/community`: long-form posts, comments/replies, likes, subscriptions, related-stock feeds.
- `src/markets`: stock master/profile/financial data, quotes, candles, news, market pulse, IPO/earnings calendars, briefings, and batches.
- Entities live beside their feature service.
- API response changes must be reflected in matching Web types.

## Authentication Contract

- Access tokens are sent as `Authorization: Bearer ...`.
- Refresh tokens are stored in the `refresh_token` httpOnly cookie.
- `JwtStrategy.validate()` requires both a valid access-token payload and the refresh cookie.
- A test that sends only a bearer token will receive `401`; preserve cookies when testing authenticated routes.
- The frontend calls `/auth/refresh` once on startup and verifies `/auth/me` at most every five minutes while visible.
- Admins must be allowed to delete any community post or comment. Authors may delete their own content.

## Database And Market Identifiers

Important identifiers:

- US stock master market: `US`
- Korean stock master markets: `KR:KOSPI` and `KR:KOSDAQ`
- Public API market parameter for Korean stocks: `KR`
- Korean stock symbol: six-digit code such as `005930` or `000660`

Never query `stock_master.market = 'KR'`; use:

```ts
In(['KR:KOSPI', 'KR:KOSDAQ']);
```

`stock_master` is the source of truth for stock names and market classification. Prefer its Korean trading name, such as `SK?섏씠?됱뒪`, over DART legal names, such as `?먯뒪耳?댄븯?대땳??, for user-facing search and news queries.

Production sets TypeORM `synchronize: false`. Entity changes require an explicit production migration/manual schema update.

`favorite_stocks` stores each user's watchlist. It is keyed by `(user_id, market, symbol)` and uses public market values `US` and `KR`. Keep this table as user-owned metadata only; live prices still come from quote APIs/Redis when the watchlist is read.

## Korean Quote Contract

- Korean current price/change/percent change come from Naver/KIS quote output.
- Korean stock detail valuation prefers KIS live fields when present. When the faster Naver basic quote wins without them, read market capitalization, PER, PBR, EPS, and BPS together from Naver's integration endpoint and cache the combined result for 60 seconds. Keep this fallback out of the 15-second quote polling path. ROE remains based on stored DART financials.
- `/markets/stocks/quote?symbol=<code>&market=KR` is polled by the selected-stock screen.
- Selected Korean stock polling currently runs every 15 seconds.
- A selected quote waits for refresh when its Redis value is older than five seconds.
- General Korean quote reads may return cached data and trigger a background refresh after 20 seconds.
- Concurrent refreshes for the same Korean symbol are deduplicated.
- Return `change`, `percentChange`, and `previousClose` together. The frontend must not invent Korean percent change from unrelated/stale detail data.
- Korean individual-stock streaming is not implemented through Finnhub WebSocket. Do not describe polling as true exchange WebSocket streaming.

Volatile data belongs in Redis. Basic symbol/profile/financial data belongs in PostgreSQL.

## Korean Stock News Contract

`GET /api/markets/stocks/news?symbol=<code>&market=KR&language=ko` combines:

1. Naver Search API when `NAVER_CLIENT_ID` and `NAVER_CLIENT_SECRET` exist.
2. Naver Finance desktop stock-news HTML fallback.
3. Naver mobile stock-code endpoint fallback:
   `https://m.stock.naver.com/api/news/stock/<symbol>`

The mobile stock-code fallback is important because Naver Search keys may be absent and desktop pages may return no articles for stocks such as SK Hynix.

- Prefer `stock_master.name` for the Korean search query.
- Keep `related` as the six-digit symbol.
- Deduplicate by URL and return at most five latest items.
- Bump the Redis cache version when changing news lookup/filter behavior so stale empty results do not remain.
- Do not assume every item returned by a stock-code page directly mentions the company; improve relevance carefully without making empty-result regressions.

## Community Stock Tag Contract

Community tags are stored as:

```ts
{ symbol: '000660', name: 'SK?섏씠?됱뒪', market: 'KR' }
```

- Always store the canonical symbol internally.
- Korean related-feed queries match the six-digit symbol.
- The Web displays Korean tags by company name but routes using the canonical symbol and `market=KR`.
- US tags display and route by ticker.
- Do not replace Korean tag symbols with company names in the database; that breaks related-feed queries.

## External Data Responsibilities

- KIS: Korean quotes/indexes/exchange-rate data and stock-master files.
- Finnhub: US symbols/profiles/quotes where available.
- Yahoo: global quote/news fallback.
- Naver: Korean market news and stock-code news fallback.
- DART: Korean company profiles and financial statements.
- Alpha Vantage: US earnings calendar only.
- OpenAI: market briefing generation only.

Keys must remain in environment variables. Never commit `.env`, credentials, tokens, or user passwords.

## Batch Schedule

All cron times use `Asia/Seoul`.

Scheduled market-briefing cron jobs must not run in local/dev containers. `ENABLE_SCHEDULED_JOBS=false` is the local default. Production should set `ENABLE_SCHEDULED_JOBS=true`; if the flag is absent, `MarketsService` enables schedules only when `NODE_ENV=production`.

- Daily `01:00`: refresh Korean/US stock master and DART profile mapping.
- Daily `02:00`: refresh default stock profiles.
- Tue-Sat `08:25`: previous US-session market briefing; retry at `08:40`, `09:00`, and `09:30` only while no US briefing exists for the current KST date.
- Mon-Fri `15:55`: current Korean-session market briefing; retry at `16:10`, `16:30`, and `17:00` only while no KR briefing exists for the current KST date.
- KOSPI 200 five-year financial refresh is currently manual through the admin endpoint; `StockFinancialBatchService` has no cron decorator.
- Daily `03:00`: IPO calendar refresh through DART/KIND, with a limited 38 Communications fallback.
- Daily `03:20`: US earnings calendar refresh through Alpha Vantage.

Manual admin endpoints:

- `POST /api/markets/briefings/run?market=US|KR`
- `POST /api/markets/profiles/batch`
- `POST /api/markets/master/batch`
- `POST /api/markets/financials/batch`
- `POST /api/markets/ipos/batch`
- `POST /api/markets/calendar/earnings/us/batch`

Market briefing OpenAI calls use `OPENAI_MODEL` and `service_tier: "flex"`. The text request retries once for timeout/429/resource-unavailable. A failed scheduled generation must skip publishing instead of creating partial data.
For market briefing text only, a Flex 429 retry switches to `service_tier: "default"`; a successful Flex request never incurs the default-tier call. Other OpenAI requests keep their existing retry tier.
Every scheduled attempt checks PostgreSQL before collecting news or calling OpenAI. Once that market has a briefing for the current KST date, later retry cron executions return immediately and must not incur another OpenAI call or send another notification.

## IPO Calendar Batch

`IpoCalendarBatchService` keeps the IPO calendar focused on the next month plus near-past active rows.

- DART remains the primary source for subscription date, expected/confirmed offer price, underwriter, receipt number, and original document URL.
- KIND remains the primary source for listing dates when the official listing calendar exposes them.
- 38 Communications is a fallback only for rows that are currently in the subscription window and still have no `listingDate`.
- The 38 fallback must not replace a listing date already supplied by KIND.
- The 38 fallback reads `http://www.38.co.kr/html/fund/?o=k` and then the matching detail page, because Node/OpenSSL can reject that site's HTTPS handshake with `ERR_SSL_DH_KEY_TOO_SMALL`.
- If 38 scraping fails, skip the fallback and keep the batch successful; do not let a non-official fallback fail the full IPO batch.
- Store fallback provenance in `raw.listingSource`, for example `38_communications`, so UI/debugging can distinguish official and fallback listing dates.

## US Earnings And S&P 500 Financials

US earnings automation is limited to S&P 500 symbols for Finnhub estimates/actuals and SEC financial confirmation.

- Alpha Vantage remains the broad earnings-calendar source and runs daily at 03:20 Asia/Seoul.
- The same 03:20 batch augments S&P 500 rows from Finnhub for today-7 days through today+60 days.
- Finnhub calendar responses can truncate near 1,500 rows. The batch therefore splits the date range into consecutive seven-day API requests during one batch run, combines the responses, then filters to S&P 500 symbols. This is not a seven-day delayed job.
- Finnhub supplies EPS/revenue estimates and preliminary EPS/revenue actuals when available.
- Alpha Vantage and Finnhub can disagree on the report date by one day. Finnhub data is merged into an existing same-symbol row within +/-1 day, preferring the Alpha Vantage row and deleting duplicate nearby rows.
- Preliminary actual checks are scheduled every 15 minutes but only perform provider calls in KST windows relevant to US releases: 06:00-09:59 for the prior US report date after-market/unknown events, and 20:00-23:30 for same-date pre-market/unknown events.
- SEC confirmation runs daily at 04:00 Asia/Seoul for unconfirmed events from the previous 30 days that already have a preliminary actual. Once a matching SEC quarterly row is confirmed, it is not checked again by the confirmation batch.
- Opening an S&P 500 financial or earnings page also uses SEC cache-aside refresh, so actively viewed symbols may confirm earlier.
- When Finnhub first supplies an actual, send an EARNINGS notification only to users who favorited that US ticker and enabled earnings notifications. Title format is `MU ?ㅼ쟻 蹂닿린`; the URL is `/stocks/US/MU/earnings`. Notification failure must not fail the batch.
- The stock-detail header shows the next event while no recent actual exists. For up to 15 days after an actual, it shows a link such as `2026 Q2 ?ㅼ쟻 蹂닿린`; a newer Alpha event naturally switches it back to the next scheduled earnings label.
- Public/read routes:
  - `GET /api/markets/calendar/earnings/us?from=YYYY-MM-DD&to=YYYY-MM-DD&query=...`
  - `GET /api/markets/calendar/earnings/us/bounds`
  - `GET /api/markets/stocks/earnings/us?symbol=MU`
- Admin routes:
  - `POST /api/markets/calendar/earnings/us/batch`
  - `POST /api/markets/calendar/earnings/us/actuals`
  - `POST /api/markets/calendar/earnings/us/sec-confirmations`
- Production uses `synchronize: false`. Apply `sql/20260624_us_stock_financials.sql` for the SEC financial cache table and `sql/20260624_us_earnings_estimates.sql` for earnings estimate/actual columns before deploying the entity changes.

S&P 500 financial statements are stored in PostgreSQL from SEC Company Facts. Annual and quarterly results are not Redis-owned data. The stock-detail chart remains annual; `/stocks/US/{symbol}/financials` provides the detailed annual/quarterly view, and `/stocks/US/{symbol}/earnings` provides estimate-versus-actual and historical comparisons.

## Guru 13F Portfolios

The Guru/13F feature lives in `src/markets/guru-portfolios.service.ts` and exposes:

- `GET /api/markets/gurus`
- `GET /api/markets/gurus/:slug`
- Admin manual batch: `POST /api/markets/gurus/batch`

Guru summaries expose `lastCollectedAt`. Detail responses keep active positions in `holdings` for current-portfolio calculations and expose `activityHoldings` for the holdings table; `activityHoldings` includes prior positions whose current weight is zero so full exits remain searchable. The collection timestamp comes from the matching applied EDGAR filing, falling back to the manager update timestamp.
Known CUSIP-to-ticker overrides must be applied both while storing new holdings and while serializing existing holdings. This keeps unchanged-accession skips from leaving previously stored null tickers visible in the UI; `92206C870` is Vanguard Intermediate-Term Corporate Bond ETF (`VCIT`).
Ticker enrichment is independent of accession replacement. Weekly and manual guru batches backfill null holding tickers from the US stock master/name matcher first, then OpenFIGI CUSIP mapping, and persist successful mappings in `guru_security_master`. `OPENFIGI_API_KEY` is optional; unauthenticated requests use smaller throttled batches. Securities with no valid listed ticker remain unresolved and the Web displays their issuer name rather than a raw CUSIP as the primary label.

Operational schedule uses `Asia/Seoul` and respects `ENABLE_SCHEDULED_JOBS` like other market jobs.

- Fast EDGAR 13F refresh: February/May/August/November 10-25 at `07:00`, `13:00`, and `21:00`. It queries each tracked manager's latest filing and downloads/parses the filing information table directly; the slower SEC quarterly ZIP is not used by this cron.
- Weekly fallback: Sunday `06:10` runs the fast EDGAR collector first and uses the SEC quarterly dataset only when EDGAR produced no holdings. An already-applied SEC dataset file is reused unless a force run is requested.
- Nasdaq price/industry refresh: weekly Sunday `04:30`. It updates `guru_security_master.current_price`, `price_updated_at`, sector, industry, and name from the Nasdaq screener payload.
- The manual admin endpoint runs the EDGAR collector, conditional SEC-dataset fallback, and Nasdaq classification/price refresh. `force=true` bypasses accession/applied-file skips for an intentional full reload.

For normal EDGAR and seed application, an unchanged manager accession skips manager holding deletion/insertion. A changed accession replaces only that manager's holdings. Nasdaq enrichment remains independent and continues on scheduled/manual batches.

Production has `synchronize: false`. Before deploying the price-aware guru batch, apply `sql/20260625_guru_security_master_prices.sql`.

Do not hard-delete existing guru data before a new batch is known good. For a future full SEC downloader, write into staging or skip unchanged accessions, then atomically swap/update manager holdings only after the download and normalization succeed.

## PWA Push Notifications

Push notifications use `web-push` with VAPID and are implemented under `src/notifications`.

- Production schema is created by `sql/20260624_notifications.sql`. Production has `synchronize: false`, so apply this SQL before deploying the notification-enabled API.
- Tables store device subscriptions, per-user preferences, in-app notification history/read state, and deduplication delivery keys.
- VAPID secrets stay in the API environment only: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT`.
- `ENABLE_WEB_PUSH=true` enables real delivery. `ENABLE_PUSH_TEST_API=true` exposes authenticated `POST /api/notifications/test` and should normally remain false in production.
- Expired subscriptions returning HTTP 404/410 are deleted automatically. Notification failures must be logged without failing the user action that triggered them.
- Preference defaults: earnings, IPO, and market briefing enabled; price, community reactions, and subscribed-author posts disabled.
- Earnings notifications run daily at 09:00 Asia/Seoul and send only on the report date, only to users who favorited the US symbol and enabled earnings notifications.
- IPO notifications run daily at 09:00 Asia/Seoul and send only on the subscription start date or listing date, to approved users who enabled IPO notifications. D-1 notifications are intentionally not sent.
- Price-band checks run every minute after a five-minute market-open warm-up (KR 09:05 KST, US 09:35 America/New_York). The job bypasses Redis quote caches and requires a provider timestamp from today's regular session; KR additionally requires Naver `marketStatus=OPEN`. Stale prior-session values are skipped. Favorites are deduplicated by market/symbol, and a user receives each direction/5-percent band at most once per trading date.
- Comments/replies and first publication of subscribed-author posts notify immediately after DB save. Self-reactions are excluded.
- Likes are grouped by post every 15 minutes.
- Market briefings notify only after a briefing row is successfully saved.
- Development Compose mounts the named volume `api_node_modules` over image dependencies. After adding API packages, update both root and `apps/api/package-lock.json` and run `docker compose run --rm --no-deps api npm ci` or recreate that dependency volume.

Notification API routes include VAPID public config, subscribe/unsubscribe, preference get/update, in-app list/read, and the optional test endpoint.

## Community Content

- Posts are long-form TipTap HTML stored in `contentBlocks`.
- Preserve paragraph spacing and inline styling through save/render paths.
- Related-stock feed endpoint queries `stock_tags` JSON by canonical symbol.
- Preserve author/admin authorization checks on edit/delete operations.

## Verification

Run from repository root unless specified:

```powershell
docker compose exec -T api npm run build
docker compose logs --tail=100 api
```

Useful authenticated test sequence:

1. Login with a cookie-preserving HTTP session.
2. Send both the returned access token and session cookie.
3. Test health, quote, news, and relevant feature endpoints.

Local dev uses `docker-compose.yml`. The current operating VM deploy directory also has its own `/home/ncloud/investment-community/docker-compose.yml`, so do not assume local compose files are automatically reflected there.

## Deployment

- Working branch for requested changes: `LSH8` unless the user explicitly creates a newer branch.
- Docker Hub images:
  - `honeyhyuni12/investment-community-api:latest`
  - `honeyhyuni12/investment-community-web:latest`
- Current operating VM: `172.16.11.137` (Ubuntu). The previous Rocky VM `172.16.11.126` was replaced after storage/VM corruption.
- Deployment directory: `/home/ncloud/investment-community`
- Public site: `https://15f.kro.kr/`
- Direct-IP fallback for infrastructure checks: `http://172.16.11.137/`
- Production VM `.env` should use `WEB_ORIGIN=https://15f.kro.kr`, `NEXT_PUBLIC_API_BASE_URL=/api`, and `REFRESH_COOKIE_SECURE=true`.
- Fresh VM deployments start with an empty PostgreSQL volume. This project currently has no migration files; if the DB is blank, either restore the previous DB backup or run a one-time schema sync with the API in non-production mode while scheduled jobs are disabled, then return the API to production mode.

Never place SSH passwords or environment secrets in this file. Build, push, pull, recreate only changed services, then verify `/api/health` and HTTP status through the gateway.

## Markets Service Maintenance

`src/markets/markets.service.ts` is still intentionally broad and contains provider calls, Redis caching, briefings, and quote normalization. Prefer extracting low-risk pure helpers or new provider-specific services gradually, with an API build after each small step. Avoid large mechanical rewrites in this file unless tests/builds are run immediately afterward.

## 2026-07-07 Feature Contracts

Community images and bookmarks:

- New community images must be uploaded as authenticated multipart files through `POST /api/community/images`; posts should store `/uploads/community/...` URLs, not new Base64 payloads. Legacy Base64 posts remain display-compatible.
- Uploaded community images are validated by MIME/extension/decoding, stored under the community uploads volume, and exposed by the web/nginx static uploads path in production.
- `DELETE /api/community/images/:id` may delete only the requesting user's unused upload.
- Community bookmarks use `PostBookmark`; include the repository in `CommunityModule` TypeORM imports whenever `CommunityService` injects it.
- Bookmark list access uses `scope=bookmarks`; post responses expose `bookmarkedByMe` for the current user.
- Production schema requires `sql/20260707_community_bookmarks.sql` and upload-volume/static-serving configuration before deploying image/bookmark features.

Portfolio performance snapshots:

- Portfolio positions include `startedAt`; snapshots are stored in `portfolio_daily_snapshots` and exposed through `GET /api/markets/portfolios/:id/performance?period=...`.
- Performance responses include portfolio return plus S&P 500/SPY, KOSPI, and Nasdaq 100/QQQ comparison returns.
- Production schema requires `sql/20260707_portfolio_snapshots.sql`; keep snapshot rows in PostgreSQL, not Redis.

Economic indicators:

- FRED indicators are stored in `economic_indicators` and served through `GET /api/markets/calendar/economic/us` with `latest=true`, `seriesId`, `start`, `end`, and `limit` support.
- Admin manual refresh route: `POST /api/markets/calendar/economic/us/batch`. The scheduled refresh runs Mon-Fri `07:15` Asia/Seoul.
- Tracked FRED series: `CPIAUCSL`, `PCEPI`, `PCEPILFE`, `PPIACO`, `UNRATE`, `PAYEMS`, `GDPC1`, `FEDFUNDS`, `DGS10`, `T10Y2Y`, `M1SL`, `M2SL`, `BOGMBASE`, `WALCL`, and `D2WLTGAL`.
- `BOGMBASE` is the M0/monetary-base proxy. `D2WLTGAL` is the Treasury General Account balance; FRED history starts in 2002.
- Production schema requires `sql/20260707_economic_indicators.sql`; `FRED_API_KEY` must be configured in the API environment and never committed.

Guru 13F trading:

- `GET /api/markets/gurus/consensus` now powers the Web "嫄곗옣 留ㅻℓ" view. It accepts `sort=managerCount|totalValue|buyValue|sellValue` and `limit`.
- Consensus responses include `buyValue`, `sellValue`, `netValueChange`, `topBuyManager`, and `topSellManager` in addition to holding count/value fields.
- Buy/sell value is calculated from current versus previous 13F value: buy is positive value change, sell is absolute negative value change. New buys and full exits are naturally included.
- Keep the existing guru detail routes and manager routes shareable; `/gurus/trading` is a Web route only and still calls the consensus API.
