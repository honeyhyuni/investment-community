# 프로젝트 구조 정리 (investment-community)

투자 정보 + 커뮤니티 서비스. 미국/한국 주식 시세·차트·뉴스·기업정보를 외부 API에서 모아서 보여주고, 가입 승인제 기반의 글/댓글/좋아요/구독 커뮤니티를 제공한다.

---

## 1. 모노레포 레이아웃

```
invest/
├── apps/
│   ├── api/          # NestJS 11 백엔드 (REST + WebSocket)
│   └── web/          # Next.js 16 프론트엔드 (React 19)
├── docker-compose.yml        # 개발용 (web/api/postgres/redis 전부 컨테이너)
├── docker-compose.prod.yml   # 운영용
├── .env / .env.example       # 환경변수 (compose가 .env를 읽어 주입)
└── package.json              # npm workspaces 루트
```

- **패키지 매니저**: npm workspaces (`apps/*`, `packages/*`)
- **실행**: `docker compose up` 하나로 전체 스택 기동. 컨테이너가 소스를 볼륨 마운트해서 hot-reload까지 처리하므로 로컬에서 `npm run dev:*` 따로 돌릴 필요 없음.

| 서비스 | 포트 | 비고 |
|---|---|---|
| web (Next.js) | 3000 | |
| api (NestJS) | 4000 | 전역 prefix `/api` |
| postgres 17 | 5432 (내부) | host로 미공개 |
| redis | 6379 (내부) | 시세 캐시 |

---

## 2. 백엔드 (apps/api) — NestJS

`main.ts` 부트스트랩: 전역 prefix `/api`, helmet, cookie-parser, compression, CORS(`WEB_ORIGIN`, credentials 허용), 전역 `ValidationPipe`(whitelist + forbidNonWhitelisted + transform).

`app.module.ts`에서 묶는 것:
- `ConfigModule`(전역) — 환경변수
- `ScheduleModule` — cron 배치
- `TypeOrmModule`(postgres) — `DATABASE_URL`, `autoLoadEntities`, `synchronize`(비-prod에서만 ON → 개발 중엔 스키마 자동 생성)
- 기능 모듈 4개: **Users / Auth / Markets / Community**

### 모듈별 책임

#### Auth (`src/auth`)
JWT 기반 인증. **access token(Bearer 헤더) + refresh token(httpOnly 쿠키)** 이중 구조.

| 메서드 | 라우트 | 설명 |
|---|---|---|
| POST | `/api/auth/register` | 가입. **첫 유저는 자동 ADMIN+APPROVED**, 이후는 PENDING(관리자 승인 필요) |
| POST | `/api/auth/login` | accessToken 반환 + refresh_token 쿠키 세팅. 승인 안 된 계정은 403 |
| POST | `/api/auth/refresh` | 쿠키의 refresh로 토큰 재발급 (15분 만료 대응) |
| POST | `/api/auth/logout` | refresh 해시 무효화 |
| GET | `/api/auth/me` | 내 정보 |
| PATCH | `/api/auth/me` | 닉네임 변경 |
| PATCH | `/api/auth/password` | 비번 변경 |

- 비번 해시: **bcrypt** (cost 12)
- access 15분 / refresh 30일, refresh 해시는 DB 저장 후 대조
- **주의**: `jwt.strategy.ts`의 `validate`가 payload + **`refresh_token` 쿠키 존재**까지 검사함 → 보호된 API는 Bearer 헤더만으론 통과 안 됨(브라우저는 쿠키 자동 전송이라 정상 동작, curl 테스트 시 쿠키 jar 필요)
- 가드: `JwtAuthGuard`(인증), `RolesGuard`+`@Roles(ADMIN)`(권한)

#### Users (`src/users`)
가입 승인 워크플로우 + 프로필. 컨트롤러는 **전체 ADMIN 전용**.

| 메서드 | 라우트 | 설명 |
|---|---|---|
| GET | `/api/users/pending` | 승인 대기 목록 |
| PATCH | `/api/users/:id/status` | 승인/거절 |

- 엔티티 `users`: email(unique), passwordHash, refreshTokenHash, nickname, role(ADMIN/USER), status(PENDING/APPROVED/REJECTED), approvedAt

#### Markets (`src/markets`) — 핵심, 가장 복잡
주식 시세/차트/뉴스/기업정보. **여러 외부 API를 폴백 체인 + Redis 캐시**로 묶음. 전체 라우트 `JwtAuthGuard`로 보호.

| 메서드 | 라우트 | 설명 |
|---|---|---|
| GET | `/api/markets/quotes?symbols=` | 심볼 다건 시세 |
| GET | `/api/markets/pulse` | 시장 지표(미국 ETF+크립토+KOSPI/KOSDAQ), 20초 캐시 |
| GET | `/api/markets/stocks/us` | 미국 기본 종목 시세, 60초 캐시 |
| GET | `/api/markets/stocks/kr` | 한국 기본 종목 시세, 60초 캐시 |
| GET | `/api/markets/symbols/us` `…/kr` | 종목 마스터 목록(DB) |
| GET | `/api/markets/stocks/detail?symbol=&market=` | 종목 상세(프로필+지표+시세+개요) |
| GET | `/api/markets/news?category=&market=` | 뉴스 (Yahoo/Naver) |
| GET | `/api/markets/candles?symbol=&period=` | 캔들 차트 (1D~ALL) |
| POST | `/api/markets/profiles/batch` | **ADMIN** 기본종목 프로필 갱신 |
| POST | `/api/markets/master/batch` | **ADMIN** 종목 마스터 전체 갱신 |

**실시간 WebSocket** (`markets.gateway.ts`):
- socket.io 게이트웨이. 프론트가 `market:subscribe`로 심볼 구독
- 서버는 **Finnhub WebSocket**(`wss://ws.finnhub.io`)에 붙어 trade 수신 → 클라이언트로 `market:trade` 브로드캐스트

**일일 배치** (`stock-master-batch.service.ts`):
- `@Cron` 매일 새벽 1시(Asia/Seoul)
- KIS 마스터 파일(kospi/kosdaq `.mst.zip`) 다운로드·파싱 + 미국 종목 + DART 기업개황 → `stock_master`/`stock_profiles` 테이블 갱신

엔티티: `stock_master`(종목 마스터), `stock_profiles`(기업 프로필/개요 캐시)

#### Community (`src/community`)
글/댓글/좋아요/구독 피드. 전체 `JwtAuthGuard` 보호.

| 메서드 | 라우트 | 설명 |
|---|---|---|
| GET | `/api/community/feed?scope=&userId=&sort=` | 피드 (all/subscribed/mine/user, latest/popular) |
| GET | `/api/community/related?symbol=` | 특정 종목 태그된 글 |
| POST | `/api/community/posts` | 글 작성 (텍스트/이미지 블록, 종목 태그) |
| PATCH/DELETE | `/api/community/posts/:id` | 수정/삭제 |
| POST | `/api/community/posts/:id/like` | 좋아요 토글 |
| POST | `/api/community/posts/:id/comments` | 댓글(대댓글 지원) |
| PATCH/DELETE | `/api/community/comments/:id` | 댓글 수정/삭제 |
| GET | `/api/community/users` | 유저 목록 |
| POST | `/api/community/users/:id/subscribe` | 구독 토글 |

엔티티: `community_posts`(이미지/콘텐츠블록/종목태그 포함), `community_post_comments`, `community_post_likes`, `community_user_subscriptions`

---

## 3. 외부 API 의존성 (어떤 API를 쓰나)

| API | 용도 | 인증 | 코드 위치 |
|---|---|---|---|
| **Finnhub** | 미국 시세, 기업 프로필/지표, 실시간 WebSocket | `FINNHUB_API_KEY` | `markets.service`, `markets.gateway` |
| **Yahoo Finance** (비공식) | 캔들 차트, 뉴스, 미국 시세 폴백 | 없음 | `markets.service` (`query1.finance.yahoo.com`) |
| **KIS** 한국투자증권 OpenAPI | 한국 시세/지수/재무비율/배당/일봉, 종목 마스터 | `KIS_APP_KEY/SECRET` (OAuth 토큰) | `markets.service`, `stock-master-batch` |
| **Naver** (비공식) | 한국 시세/지수 1차 소스, 한국 뉴스 크롤링 | 없음 | `m.stock.naver.com`, `finance.naver.com` |
| **DART** 전자공시 | 한국 기업개황(대표자/설립일/주소) | `DART_API_KEY` | `opendart.fss.or.kr` |

**폴백/캐시 전략** (markets.service의 핵심 설계):
- 미국 시세: Finnhub → 실패 시 Yahoo → 실패 시 0값
- 한국 시세: Naver + KIS 동시 시도(`Promise.any`) → Redis 20초~24h 캐시
- KIS는 rate limit이 빡빡해서 **요청 직렬화 + 550ms 간격 + 토큰 캐시** 적용
- 종목 상세/지표는 DB(`stock_profiles`) 캐시 우선, 없으면 런타임 폴백

---

## 4. 프론트엔드 (apps/web) — Next.js 16 / React 19

> ⚠️ `apps/web/AGENTS.md` 경고: 이 Next.js 16은 학습 데이터와 다른 breaking change가 있으니, 코드 작성 전 `node_modules/next/dist/docs/`를 먼저 읽으라고 명시돼 있음.

- **구조가 단순**: `src/app/layout.tsx`(33줄) + `src/app/page.tsx`(약 3800줄) — 사실상 한 페이지에 다 들어있는 SPA 스타일
- **상태/데이터**: `@tanstack/react-query`(서버 상태), `zustand`(클라 상태)
- **실시간**: `socket.io-client` → 백엔드 게이트웨이 구독
- **차트**: `lightweight-charts`
- **스타일**: Tailwind v4
- **API 클라이언트**: `src/lib/api.ts` — `apiRequest()` 하나로 통일. `credentials: "include"`로 refresh 쿠키 자동 전송, accessToken은 Bearer 헤더로

---

## 5. 환경변수 (.env)

compose가 `.env`를 읽어 컨테이너에 주입한다 (`.env.local` 아님 — compose는 `.env`만 자동 인식).

| 그룹 | 변수 |
|---|---|
| 공통 | `NODE_ENV`, `WEB_PORT`, `API_PORT`, `WEB_ORIGIN`, `NEXT_PUBLIC_API_BASE_URL` |
| DB | `POSTGRES_*`, `DATABASE_URL` |
| 캐시 | `REDIS_*`, `REDIS_URL` |
| 인증 | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` |
| 외부 API | `FINNHUB_API_KEY`, `KIS_APP_KEY/SECRET/ACCOUNT_*`, `NAVER_CLIENT_ID/SECRET`, `DART_API_KEY` |

> 참고: `app.module.ts`의 `DATABASE_URL`은 `getOrThrow`라서 **값이 없으면 부팅 즉시 죽는다**. 외부 API 키들은 대부분 `get`이라 없어도 부팅은 되고, 해당 기능만 폴백/비활성으로 동작.

---

## 6. 데이터 흐름 한눈에

```
[브라우저 web:3000]
   │  REST (Bearer + refresh 쿠키, credentials:include)
   │  WebSocket (socket.io)
   ▼
[NestJS api:4000  /api]
   ├─ Auth/Users ─────────► Postgres (users, 승인제)
   ├─ Community ──────────► Postgres (posts/comments/likes/subs)
   └─ Markets
        ├─ Redis (시세 캐시 20s~24h)
        ├─ Finnhub (REST 시세/프로필 + WS 실시간)
        ├─ Yahoo (차트/뉴스/폴백)
        ├─ KIS (한국 시세/재무/마스터)
        ├─ Naver (한국 시세/뉴스)
        ├─ DART (한국 기업개황)
        └─ @Cron 매일 1AM → stock_master/stock_profiles 갱신
```

---

## 7. 테이블 요약

| 테이블 | 용도 |
|---|---|
| `users` | 계정(승인제, 역할) |
| `community_posts` | 글(이미지/콘텐츠블록/종목태그) |
| `community_post_comments` | 댓글(대댓글) |
| `community_post_likes` | 좋아요 |
| `community_user_subscriptions` | 유저 구독 |
| `stock_master` | 종목 마스터(KR/US, 일배치 갱신) |
| `stock_profiles` | 기업 프로필/개요 캐시 |

> 개발 환경은 `synchronize: true`라 엔티티 변경 시 스키마가 자동 반영됨. 운영에선 꺼야 함(마이그레이션 필요).
