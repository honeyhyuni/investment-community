# API Agent Guide

This file describes the current backend contracts and operational decisions. Read it before changing `apps/api`.

## Scope And Structure

The API is a NestJS + TypeScript service using PostgreSQL, TypeORM, Redis, Socket.IO, and scheduled jobs.

- `src/auth`: login, refresh-cookie sessions, profile/password changes, JWT guards.
- `src/users`: approval workflow and admin user management.
- `src/community`: long-form posts, comments/replies, likes, subscriptions, related-stock feeds.
- `src/markets`: stock master/profile/financial data, quotes, candles, news, market pulse, briefings, and batches.
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

Manual admin endpoints:

- `POST /api/markets/briefings/run?market=US|KR`
- `POST /api/markets/profiles/batch`
- `POST /api/markets/master/batch`
- `POST /api/markets/financials/batch`

Market briefing OpenAI calls use `OPENAI_MODEL` and `service_tier: "flex"`. The text request retries once for timeout/429/resource-unavailable. A failed scheduled generation must skip publishing instead of creating partial data.

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

- Working branch for requested changes: `LSH2`.
- Docker Hub images:
  - `honeyhyuni12/investment-community-api:latest`
  - `honeyhyuni12/investment-community-web:latest`
- Operating VM: `172.16.11.126`
- Deployment directory: `/home/ncloud/investment-community`
- Public site: `https://15f.kro.kr/`

Never place SSH passwords or environment secrets in this file. Build, push, pull, recreate only changed services, then verify `/api/health` and HTTP status through the gateway.

## Markets Service Maintenance

`src/markets/markets.service.ts` is still intentionally broad and contains provider calls, Redis caching, briefings, and quote normalization. Prefer extracting low-risk pure helpers or new provider-specific services gradually, with an API build after each small step. Avoid large mechanical rewrites in this file unless tests/builds are run immediately afterward.
