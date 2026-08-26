# 15F - Investment Community

미국/한국 주식 시장 정보를 확인하고, 투자자들이 의견을 나눌 수 있는 투자 커뮤니티 웹 서비스입니다.

`15F`는 종목 검색, 시장 지표, 뉴스, 마켓 브리핑, 커뮤니티 피드를 하나의 서비스에서 사용할 수 있도록 구성한 프로젝트입니다. 회원가입 후 승인된 사용자만 서비스를 이용할 수 있으며, 커뮤니티에서는 게시글 작성, 댓글, 좋아요, 북마크, 공개/비공개 게시글 관리 기능을 제공합니다.

## 주요 기능

### 회원 및 인증

- 이메일 기반 회원가입 및 로그인
- Refresh Token 쿠키 기반 로그인 유지
- 프로필 수정 및 비밀번호 변경
- 관리자 승인 기반 회원 접근 제어

### 주식 및 시장 정보

- 미국/한국 주식 종목 목록 조회
- 종목 검색 및 선택
- 종목별 현재가, 차트, 밸류에이션 지표, 기업 개요 제공
- USD/KRW, KOSPI, KOSDAQ, 미국 주요 지수, 원자재, 가상자산 등 시장 지표 확인
- 종목별 관련 뉴스 및 커뮤니티 게시글 연결

### 커뮤니티

- TipTap 기반 리치 텍스트 게시글 작성
- 게시글 목록, 상세 페이지, 사용자별 피드 제공
- 댓글, 대댓글, 좋아요, 북마크
- 종목 태그 기반 관련 게시글 연결
- 팔로우 기반 피드
- 게시글 공개/비공개 설정
- 관리자 게시글 관리

### 마켓 뉴스 및 브리핑

- 한국어/영어 시장 뉴스 제공
- 시장 뉴스와 주요 지표 기반 마켓 브리핑 생성
- 미국장/한국장 브리핑 스케줄링
- 관리자 브리핑 생성 및 관리

### 관리자 기능

- 가입 대기 사용자 승인
- 시장 데이터, 종목 마스터, 기업 프로필, 재무 데이터 배치 실행
- 브리핑 생성 및 수정

## 기술 스택

| 영역 | 기술 |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4, Zustand, TipTap, lightweight-charts, lucide-react |
| Backend | NestJS 11, TypeScript, TypeORM, PostgreSQL, Redis, Socket.IO, JWT, Passport, Nest Schedule |
| Data | KIS, Finnhub, Yahoo Finance fallback, Naver Search/Finance, DART, OpenAI |
| Infra | Docker Compose, PostgreSQL 17, Redis 8, Nginx Gateway |

## 프로젝트 구조

```text
.
├── apps
│   ├── api
│   │   └── src
│   │       ├── auth        # 로그인, 토큰 갱신, JWT Guard, 프로필/비밀번호
│   │       ├── community   # 게시글, 댓글, 좋아요, 구독, 공개/비공개
│   │       ├── markets     # 시세, 뉴스, 브리핑, 배치, WebSocket Gateway
│   │       └── users       # 사용자 승인 및 관리자 사용자 관리
│   └── web
│       └── src
│           ├── app         # Next.js App Router 라우트/레이아웃
│           ├── common      # 공통 UI, store, util, API client
│           └── domain      # auth, admin, community, markets, news, profile
├── docker-compose.yml       # 로컬 개발용 Docker Compose
├── docker-compose.prod.yml  # 프로덕션 빌드/실행용 Compose
├── docker-compose.vm.yml    # VM 배포용 Compose
└── package.json             # Workspace scripts
```

## 실행 방법

### 1. 환경 변수 설정

```bash
cp .env.example .env
```

로컬에서 기본 UI/API/DB를 실행하는 데 필요한 값은 `.env.example`에 포함되어 있습니다. 외부 시장 데이터와 AI 관련 키는 필요에 따라 추가할 수 있습니다.

주요 로컬 기본값은 다음과 같습니다.

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

### 2. Docker Compose로 실행

```bash
docker compose up --build
```

실행 후 아래 주소에서 확인할 수 있습니다.

- Web: http://localhost:3000
- Health Check: http://localhost:4000/api/health

종료:

```bash
docker compose down
```

### 3. Docker 없이 실행

PostgreSQL과 Redis를 로컬에서 먼저 실행한 뒤 `DATABASE_URL`, `REDIS_URL`을 설정해야 합니다.

```bash
npm install
npm run dev:api
npm run dev:web
```

## 주요 스크립트

루트 디렉터리에서 실행합니다.

```bash
npm run dev:web       # Next.js 개발 서버
npm run dev:api       # NestJS watch mode
npm run build:web     # Web 프로덕션 빌드
npm run build:api     # API 프로덕션 빌드
npm run lint:web      # Web lint
npm run lint:api      # API lint
npm run test:api      # API unit test
npm run docker:up     # docker compose up --build
npm run docker:down   # docker compose down
```

앱별 세부 스크립트는 `apps/web/package.json`, `apps/api/package.json`에서 확인할 수 있습니다.

## 화면 구성

| 경로 | 설명 |
| --- | --- |
| `/login` | 로그인 및 회원가입 |
| `/` | 주식/시장 정보 메인 화면 |
| `/news` | 시장 뉴스 |
| `/market-briefing` | 마켓 브리핑 목록 및 최신 브리핑 |
| `/market-briefing/:briefingId` | 브리핑 상세 |
| `/community` | 커뮤니티 피드 |
| `/community/new` | 게시글 작성 |
| `/community/:postId` | 게시글 상세 |
| `/community/:postId/edit` | 게시글 수정 |
| `/community/users/:userId` | 사용자별 피드 |
| `/profile` | 프로필 및 비밀번호 설정 |
| `/admin` | 사용자 승인 및 관리자 배치 도구 |

## 데이터 처리 방식

- Redis는 변동성이 큰 시세, 시장 지표, 차트, 뉴스 데이터를 캐싱합니다.
- PostgreSQL은 사용자, 게시글, 댓글, 구독, 종목 마스터, 기업 프로필, 재무 데이터, 브리핑을 저장합니다.
- 미국 실시간 체결 데이터는 Finnhub WebSocket을 통해 수신하고 Socket.IO로 웹 앱에 전달합니다.
- 시장 지표 변경 사항은 `market:pulse` 이벤트로 웹 앱에 전달됩니다.
- 한국 종목 뉴스는 Naver Search, Naver Finance, 모바일 종목 코드 fallback 경로를 조합해 제공합니다.
- 한국 종목 상세 정보는 DART 기업 정보와 재무 데이터를 통해 보강할 수 있습니다.

## 스케줄 작업

모든 cron 스케줄은 `Asia/Seoul` 기준입니다.

| 스케줄 | 작업 |
| --- | --- |
| 매일 01:00 | 한국/미국 종목 마스터 및 DART 매핑 갱신 |
| 매일 02:00 | 기본 종목 프로필 갱신 |
| 화-토 08:25 | 이전 미국장 마켓 브리핑 생성 |
| 월-금 15:55 | 당일 한국장 마켓 브리핑 생성 |

KOSPI 200 재무 데이터 갱신은 관리자 기능으로 제공되며, 현재 cron에는 등록되어 있지 않습니다.

## 배포 메모

프로덕션 환경에서는 Docker Compose 기반으로 Web, API, PostgreSQL, Redis, Nginx Gateway를 실행합니다.

VM 배포용 compose는 사전에 빌드된 이미지를 사용합니다.

```env
WEB_IMAGE=honeyhyuni12/investment-community-web:latest
API_IMAGE=honeyhyuni12/investment-community-api:latest
NEXT_PUBLIC_API_BASE_URL=https://your-domain.example/api
WEB_ORIGIN=https://your-domain.example
REFRESH_COOKIE_SECURE=true
```

배포 후에는 Health Check와 웹 접속 상태를 확인합니다.

```bash
curl http://localhost:4000/api/health
```

## 개발 메모

- 프로덕션에서는 TypeORM `synchronize`를 사용하지 않으므로 스키마 변경 시 명시적인 마이그레이션이 필요합니다.
- `.env`, 인증 정보, 토큰, 로그, `.next`, 로컬 Docker volume은 커밋하지 않습니다.
- 루트 `.env`는 Docker Compose에서 사용합니다.
- Docker 없이 실행할 경우 각 앱이 필요한 환경 변수를 별도로 설정해야 합니다.
- Web 빌드는 `next/font`를 사용하므로 Google Fonts 접근이 필요할 수 있습니다.
- 타입 검증은 `npm --prefix apps/web exec tsc --noEmit`, API 빌드는 `npm --prefix apps/api run build`로 확인할 수 있습니다.

## 커뮤니티 이미지 백업

커뮤니티 이미지는 `community_uploads` Docker volume에 저장됩니다. 서버 교체나 운영 백업 시 PostgreSQL과 함께 해당 volume도 백업해야 합니다.

일반적인 컨테이너 재생성 과정에서는 named volume을 유지해야 하며, routine deployment에서 `docker compose down -v`는 사용하지 않습니다.
