# 프론트엔드 작업 전 필독 문서

`apps/web`의 구조/컨벤션과 진행 중인 리팩터는 `apps/web/docs/`에 있다. 프론트 코드를 만들거나 옮기기 전에 확인할 것:

- [`docs/frontend-architecture.md`](./docs/frontend-architecture.md) — 목표 구조(`domain/` + `common/`), 네이밍, 라우팅 모델, 공유 상태(zustand) 전략. **새/이동 코드는 이 규칙을 따른다.**
- [`docs/refactor-plan.md`](./docs/refactor-plan.md) — 거대 `page.tsx` → 멀티라우트 단계별 마이그레이션. **구조 변경 전 현재 Phase/상태를 확인한다.**

## 2026-07-07 작업 기록

- 커뮤니티 신규 이미지는 Base64 JSON 저장 대신 `/uploads/community/...` URL 저장 흐름을 사용한다.
- 게시글 이미지 업로드는 인증된 단일 multipart API로 처리하며, 브라우저 리사이즈/압축 후 업로드된 URL만 `contentBlocks`에 저장한다.
- 게시글 북마크 저장소 `community_post_bookmarks`를 추가했고, 커뮤니티 목록 `scope=bookmarks`를 지원한다.
- 포트폴리오 일별 성과 스냅샷과 S&P 500, KOSPI, Nasdaq 100 비교 기준 데이터를 추가했다.
- 마켓 탭의 일일리포트/뉴스/캘린더 옆에 `경제 지표` 메뉴를 추가했고, FRED 기반 경제지표 추이 차트를 제공한다.
- 경제 지표에는 GDP, 기준금리, CPI/PCE, 실업률, M0/M1/M2, TGA 잔고 등 주요 시계열을 포함한다.
- 거장 메뉴의 `합의 종목` 명칭은 `거장 매매`로 통일하고 `/gurus/trading` 라우팅을 유지한다.
- 거장 매매 표에는 TOP 매수 기관, TOP 매도 기관, 총 보유액/이번분기 매수 많은순/매도 많은순 정렬을 제공한다.
- 운영 배포 시 `FRED_API_KEY`가 API 컨테이너 환경변수로 주입되어야 하며, 2026-07-07 SQL 파일 3개를 적용해야 한다.
