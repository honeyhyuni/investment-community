# Investment Community

Private investment community for tracking US/Korean markets, reading market briefings, and discussing stocks with ticker-aware community posts.

The repository is a TypeScript monorepo with a Next.js web app, a NestJS API, PostgreSQL, Redis, and Docker Compose environments for local development and deployment.

## Features

- Private member access with registration, login, refresh-token cookies, profile updates, password changes, and admin approval.
- Stocks workspace for US and Korean markets with quote lists, search popovers, candles, valuation metrics, company overviews, related posts, and related news.
- URL-driven stock selection with `symbol`, `market`, and `currency` query state, so ticker links from community posts and briefings open the exact selected stock view.
- Market pulse for USD/KRW, KOSPI, KOSDAQ, major US indexes, commodities, and crypto.
- Community feed with TipTap rich-text posts, comments, replies, likes, related stock tags, author pages, following feeds, and admin moderation.
- Market news and stock-specific news with Korean/English language support.
- Market briefings generated from market news and pulse data, including scheduled US/KR briefing jobs and admin-triggered generation.
- Admin tools for approving users and running market/profile/master/financial batches.
- PWA-ready web app with responsive mobile navigation and production service worker registration.

## Tech Stack

| Area | Stack |
| --- | --- |
| Web | Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Zustand, Socket.IO client, TipTap, lightweight-charts, lucide-react |
| API | NestJS 11, TypeScript, TypeORM, PostgreSQL, Redis, Socket.IO, JWT, Passport, Nest Schedule |
| Data providers | KIS, Finnhub, Yahoo Finance fallback, Naver Search/Finance, DART, OpenAI |
| Infrastructure | Docker Compose, PostgreSQL 17, Redis 8, optional nginx gateway for VM deployment |

## Repository Layout

```text
.
├── apps
│   ├── api                 # NestJS API
│   │   └── src
│   │       ├── auth         # login, refresh, JWT guards, profile/password
│   │       ├── community    # posts, comments, likes, subscriptions
│   │       ├── markets      # quotes, news, briefings, batches, WebSocket gateway
│   │       └── users        # approval/admin user management
│   └── web                 # Next.js app
│       └── src
│           ├── app          # App Router routes/layouts/providers
│           ├── common       # shared UI, stores, utils, API client
│           └── domain       # auth, admin, community, markets, news, profile
├── docker-compose.yml       # local development stack
├── docker-compose.prod.yml  # build-and-run production stack
├── docker-compose.vm.yml    # VM stack using prebuilt images + nginx gateway
└── package.json             # workspace scripts
```

## Quick Start

### 1. Configure environment

```bash
cp .env.example .env
```

For a local UI/API/database run, the defaults are enough to boot the stack. External market and AI keys can be added progressively for richer data.

Important local defaults:

```env
WEB_PORT=3000
API_PORT=4000
WEB_ORIGIN=http://localhost:3000
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api
DATABASE_URL=postgresql://invest:change-me@postgres:5432/invest
REDIS_URL=redis://redis:6379
JWT_ACCESS_SECRET=change-me-access
JWT_REFRESH_SECRET=change-me-refresh
```

### 2. Start with Docker Compose

```bash
docker compose up --build
```

Open:

- Web: http://localhost:3000
- API health: http://localhost:4000/api/health

Stop:

```bash
docker compose down
```

### 3. Run without Docker

You still need PostgreSQL and Redis running locally, then set `DATABASE_URL` and `REDIS_URL`.

```bash
npm install
npm run dev:api
npm run dev:web
```

## Scripts

Run from the repository root:

```bash
npm run dev:web       # Next.js dev server
npm run dev:api       # NestJS watch mode
npm run build:web     # production web build
npm run build:api     # production API build
npm run lint:web      # web lint
npm run lint:api      # API lint
npm run test:api      # API unit tests
npm run docker:up     # docker compose up --build
npm run docker:down   # docker compose down
```

App-specific scripts live in `apps/web/package.json` and `apps/api/package.json`.

## Environment Variables

### Core

| Variable | Purpose |
| --- | --- |
| `WEB_ORIGIN` | Allowed web origin for API CORS |
| `NEXT_PUBLIC_API_BASE_URL` | Browser-visible API base URL, usually `/api` or `http://localhost:4000/api` |
| `DATABASE_URL` | PostgreSQL connection string used by TypeORM |
| `REDIS_URL` | Redis connection string for volatile market caches |
| `JWT_ACCESS_SECRET` | JWT access-token signing secret |
| `JWT_REFRESH_SECRET` | JWT refresh-token signing secret |
| `REFRESH_COOKIE_SECURE` | Optional production override for secure refresh cookies |

### Market and AI providers

| Variable | Used for |
| --- | --- |
| `KIS_APP_KEY`, `KIS_APP_SECRET` | Korean quotes, indexes, exchange rate, stock master data |
| `KIS_ACCOUNT_NO`, `KIS_ACCOUNT_PRODUCT_CODE` | KIS account-related configuration |
| `FINNHUB_API_KEY` | US symbols, profiles, quote fallback, live trades over WebSocket |
| `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` | Korean market/stock news search |
| `DART_API_KEY` | Korean company profiles, financials, listed share counts |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Market briefing text generation |
| `OPENAI_IMAGE_MODEL` | Reserved in compose env; current briefing flow does not render generated images |

External keys are optional for local boot, but missing keys reduce data quality or disable provider-specific features.

## API Overview

The API uses a global `/api` prefix and validates request bodies with `ValidationPipe`.

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `PATCH /api/auth/me`
- `PATCH /api/auth/password`

Access tokens are sent as `Authorization: Bearer <token>`. Refresh tokens are stored in the `refresh_token` httpOnly cookie.

### Users/Admin

- `GET /api/users/pending`
- `PATCH /api/users/:id/status`

Admin-only routes use `JwtAuthGuard` and `RolesGuard`.

### Community

- `GET /api/community/feed?scope=all|subscribed|mine|user&sort=latest|popular`
- `GET /api/community/related?symbol=<symbol>`
- `POST /api/community/posts`
- `GET /api/community/posts/:id`
- `PATCH /api/community/posts/:id`
- `DELETE /api/community/posts/:id`
- `POST /api/community/posts/:id/like`
- `POST /api/community/posts/:id/comments`
- `PATCH /api/community/comments/:id`
- `DELETE /api/community/comments/:id`
- `GET /api/community/users`
- `POST /api/community/users/:id/subscribe`

Community stock tags are stored with canonical symbols:

```ts
{ symbol: "000660", name: "SK하이닉스", market: "KR" }
{ symbol: "NVDA", name: "NVIDIA Corp", market: "US" }
```

### Markets

- `GET /api/markets/pulse`
- `GET /api/markets/quotes?symbols=AAPL,MSFT,NVDA`
- `GET /api/markets/stocks/us`
- `GET /api/markets/stocks/kr`
- `GET /api/markets/symbols/us`
- `GET /api/markets/symbols/kr`
- `GET /api/markets/stocks/detail?symbol=AAPL&market=US`
- `GET /api/markets/stocks/quote?symbol=005930&market=KR`
- `GET /api/markets/stocks/news?symbol=005930&market=KR&language=ko`
- `GET /api/markets/news?market=US|KR&language=en|ko`
- `GET /api/markets/candles?symbol=AAPL&period=1M&market=US`
- `GET /api/markets/briefings?market=US|KR`
- `GET /api/markets/briefings/:id`

Admin market operations:

- `PATCH /api/markets/briefings/:id`
- `DELETE /api/markets/briefings/:id`
- `POST /api/markets/briefings/run?market=US|KR`
- `POST /api/markets/profiles/batch`
- `POST /api/markets/master/batch`
- `POST /api/markets/financials/batch?limit=200`

## Web Routes

| Route | Purpose |
| --- | --- |
| `/login` | Login and registration |
| `/` | Stocks workspace |
| `/?symbol=AAPL&market=US&currency=USD` | Shareable selected stock state |
| `/news` | Market news |
| `/market-briefing` | Market briefing list/latest view |
| `/market-briefing/:briefingId` | Shareable briefing detail |
| `/community` | Community feed |
| `/community/new` | New post editor |
| `/community/:postId` | Shareable post detail |
| `/community/:postId/edit` | Edit post |
| `/community/users/:userId` | User feed |
| `/profile` | Profile/password settings |
| `/admin` | User approval and admin batch tools |

Authenticated routes share the shell in `apps/web/src/app/(auth)/layout.tsx`, including market pulse, desktop navigation, and mobile bottom navigation.

## Market Data Behavior

- Redis caches volatile quote, pulse, candle, and news data.
- PostgreSQL stores users, posts, comments, subscriptions, stock master data, profiles, financial rows, and briefings.
- US live trade ticks use Finnhub WebSocket and are emitted to the web app over Socket.IO as `market:trade`.
- Market pulse updates are emitted as `market:pulse`.
- Korean selected-stock quotes are polled by the web app and preserve authoritative `current`, `change`, `percentChange`, and `previousClose` values.
- Korean stock news combines Naver Search, Naver Finance, and mobile stock-code fallback paths.
- Korean stock detail can be enriched from DART company profile and financial data.

## Scheduled Jobs

All cron schedules use `Asia/Seoul`.

| Schedule | Job |
| --- | --- |
| Daily 01:00 | Refresh Korean/US stock master and DART mapping |
| Daily 02:00 | Refresh default stock profiles |
| Tue-Sat 08:25 | Generate previous US-session market briefing |
| Mon-Fri 15:55 | Generate current Korean-session market briefing |

KOSPI 200 financial refresh is exposed through the admin endpoint and is not currently scheduled by cron.

## Deployment Notes

### Build production images locally

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### VM deployment stack

`docker-compose.vm.yml` expects prebuilt images and an nginx gateway:

```env
WEB_IMAGE=honeyhyuni12/investment-community-web:latest
API_IMAGE=honeyhyuni12/investment-community-api:latest
NEXT_PUBLIC_API_BASE_URL=https://your-domain.example/api
WEB_ORIGIN=https://your-domain.example
REFRESH_COOKIE_SECURE=true
```

Then:

```bash
docker compose -f docker-compose.vm.yml up -d
```

Verify:

```bash
curl http://localhost:4000/api/health
```

## Development Notes

- Production sets TypeORM `synchronize: false`; schema changes need explicit migrations or manual DB updates.
- Do not commit `.env`, credentials, tokens, generated logs, `.next`, or local Docker volumes.
- The root `.env` is consumed by Docker Compose. Local non-Docker commands need equivalent environment variables in the shell or app-specific env files.
- The web build uses `next/font`; production builds may need network access to fetch Google fonts unless fonts are vendored or cached.
- Current web lint can surface existing React hook lint rules in older pages. `npx tsc --noEmit` is the quickest type-level verification.

## Useful Verification Commands

```bash
# API
docker compose exec -T api npm run build
docker compose logs --tail=100 api

# Web
docker compose exec -T web npm run build
docker compose logs --tail=100 web

# Local type checks
npm --prefix apps/web exec tsc --noEmit
npm --prefix apps/api run build
```

## Community image backup

Community images are stored in the persistent `community_uploads` Docker volume. Back up and restore it together with PostgreSQL before replacing the server. Keep the named volume during container recreation and do not use `docker compose down -v` for routine deployments.
