# API Agent Notes

This NestJS app owns backend auth, community, market data, batch jobs, and external API integration.

## Structure
- `src/auth`: login, refresh-token cookie flow, password/profile updates, JWT guards.
- `src/users`: user approval/admin status management.
- `src/community`: posts, comments, likes, subscriptions, related stock feeds.
- `src/markets`: quotes, symbols, candles, stock profiles, news, market briefings, scheduled batches.
- TypeORM entities live beside their feature services. Keep DTO changes aligned with frontend types when API responses change.

## Market Briefing Rules
- Scheduled jobs are in `markets.service.ts`.
- US briefing runs Tue-Sat at `08:25` Asia/Seoul for the previous US session.
- KR briefing runs Mon-Fri at `15:55` Asia/Seoul for the current Korean session.
- OpenAI text generation uses `OPENAI_MODEL` with `service_tier: "flex"`.
- Retry policy: first OpenAI text request timeout is 120s; retry once on timeout/429/resource-unavailable with 300s timeout. If it still fails, the batch should skip publishing for that run.
- If OpenAI returns exactly `휴장이었습니다.`, do not create a market briefing record.
- `market_briefings.macro_lines` is part of the current response shape. Production databases need a migration/manual column if `synchronize` is disabled.
- Generated images must not contain readable Korean text, titles, tickers, or numeric labels because image text can render incorrectly.

## External API Notes
- Keep API keys only in environment variables. Do not hardcode keys or commit `.env`.
- KIS, Finnhub, Naver, DART, and OpenAI calls should fail soft where possible for scheduled jobs.
- Redis caches volatile market data. Basic stock lists/profiles should come from DB where available.

## Verification
- API build: `npm.cmd run build` from `apps/api`.
- Local dev stack: `docker compose up -d --build api web` from repo root.
- Admin-only manual market briefing endpoint: `POST /api/markets/briefings/run?market=US|KR`.
