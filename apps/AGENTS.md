# 프론트엔드 작업 전 필독 문서

`apps/web`의 구조/컨벤션과 진행 중인 리팩터는 `apps/web/docs/`에 있다. 프론트 코드를 만들거나 옮기기 전에 확인할 것:

- [`docs/frontend-architecture.md`](./docs/frontend-architecture.md) — 목표 구조(`domain/` + `common/`), 네이밍, 라우팅 모델, 공유 상태(zustand) 전략. **새/이동 코드는 이 규칙을 따른다.**
- [`docs/refactor-plan.md`](./docs/refactor-plan.md) — 거대 `page.tsx` → 멀티라우트 단계별 마이그레이션. **구조 변경 전 현재 Phase/상태를 확인한다.**
