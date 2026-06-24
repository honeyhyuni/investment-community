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
In(['KR:KOSPI', 'KR:KOSDAQ'])
```

`stock_master` is the source of truth for stock names and market classification. Prefer its Korean trading name, such as `SK하이닉스`, over DART legal names, such as `에스케이하이닉스`, for user-facing search and news queries.

Production sets TypeORM `synchronize: false`. Entity changes require an explicit production migration/manual schema update.

`favorite_stocks` stores each user's watchlist. It is keyed by `(user_id, market, symbol)` and uses public market values `US` and `KR`. Keep this table as user-owned metadata only; live prices still come from quote APIs/Redis when the watchlist is read.

## Korean Quote Contract

- Korean current price/change/percent change come from Naver/KIS quote output.
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
{ symbol: '000660', name: 'SK하이닉스', market: 'KR' }
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
- Tue-Sat `08:25`: previous US-session market briefing.
- Mon-Fri `15:55`: current Korean-session market briefing.
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

## IPO Calendar Batch

`IpoCalendarBatchService` keeps the IPO calendar focused on the next month plus near-past active rows.

- DART remains the primary source for subscription date, expected/confirmed offer price, underwriter, receipt number, and original document URL.
- KIND remains the primary source for listing dates when the official listing calendar exposes them.
- 38 Communications is a fallback only for rows that are currently in the subscription window and still have no `listingDate`.
- The 38 fallback must not replace a listing date already supplied by KIND.
- The 38 fallback reads `http://www.38.co.kr/html/fund/?o=k` and then the matching detail page, because Node/OpenSSL can reject that site's HTTPS handshake with `ERR_SSL_DH_KEY_TOO_SMALL`.
- If 38 scraping fails, skip the fallback and keep the batch successful; do not let a non-official fallback fail the full IPO batch.
- Store fallback provenance in `raw.listingSource`, for example `38_communications`, so UI/debugging can distinguish official and fallback listing dates.

## US Earnings Calendar Batch

`UsEarningsCalendarBatchService` stores Alpha Vantage `EARNINGS_CALENDAR` rows in `us_earnings_calendar`.

- Source: Alpha Vantage `EARNINGS_CALENDAR` with `horizon=3month`.
- Required environment variable: `ALPHA_VANTAGE_API_KEY`.
- Public read endpoints:
  - `GET /api/markets/calendar/earnings/us?from=YYYY-MM-DD&to=YYYY-MM-DD&query=...`
  - `GET /api/markets/calendar/earnings/us/bounds`
- Admin refresh endpoint: `POST /api/markets/calendar/earnings/us/batch`
- Stock detail includes `nextEarnings` from the nearest `report_date >= today` row for US stocks.
- Each refresh deletes the currently refreshed report-date range before inserting the latest provider rows. This prevents stale future rows when Alpha Vantage changes a report date, EPS estimate, or time-of-day.
- After refreshing the latest provider range, the batch deletes rows older than the first day of the previous month. Example: when the batch runs in August, rows before July 1 are removed, so June data no longer remains.
- Production uses `synchronize: false`; create `us_earnings_calendar` manually or via migration before enabling the feature on a fresh DB.
- The current VM `docker-compose.yml` is separate from the repository compose files. If adding `ALPHA_VANTAGE_API_KEY` locally, also ensure the VM compose maps `ALPHA_VANTAGE_API_KEY: ${ALPHA_VANTAGE_API_KEY}` into the API service.

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
- Price-band checks run every minute during each market's regular session. Favorites are deduplicated by market/symbol before quote lookup. A user receives each direction/5-percent band at most once per trading date.
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

- Working branch for requested changes: `LSH6` unless the user explicitly creates a newer branch.
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
