# 캘린더(달력) UI 통합 리팩토링

- 작업일: 2026-07-11
- 대상 페이지: `/calendar` (`공모주 달력`, `미국 실적 발표`)
- 작업자: Claude (Cowork)

## 1. 배경 및 목표

기존에는 `/calendar` 페이지의 두 탭(공모주 달력, 실적 발표)이 완전히 다른 UI로 구현되어 있었다.

- **공모주 달력**: 오늘부터 32일을 주말을 건너뛰며 나열하는 "롤링 리스트" 형태. 요일 정렬이 안 된 2/3/5열 반응형 그리드였고, disabled(비활성) 개념 자체가 없었다.
- **실적 발표**: 데일리·주간은 카드 리스트, 월간은 요일 정렬된 6주(42칸) 달력 그리드. 월간 뷰만 놓고 보면 이미 "진짜 달력"에 가까웠다.

두 UI가 같은 페이지 안에서 완전히 다른 룩앤필을 가지고 있어 통일성이 떨어졌고, 컴포넌트도 공유되지 않아 유지보수가 어려웠다. 이번 작업의 목표는 다음과 같다.

1. 하나의 `Calendar` 컴포넌트로 두 화면의 달력 UI를 통일한다.
2. 달력 내부에 들어가는 "카드"만 공모주/실적 발표로 다르게 끼워 넣을 수 있도록(`children`/render-prop 패턴) 설계한다. 이렇게 하면 나중에 필터로 한 달력에서 두 종류를 동시에 보여주는 것도 쉬워진다. (이번 작업 범위는 아니고, 확장 여지만 남겨둠)
3. 공모주 달력은 오늘부터 32일만 데이터가 존재하므로, 그 밖의 날짜는 disabled 처리하고 달력 위에 안내 문구(Notice)를 노출한다.
4. 실적 발표는 데일리·주간은 카드 리스트, 월간은 달력 그리드를 유지하되, 그리드 부분의 디자인은 공모주와 완전히 동일한 컴포넌트를 쓰도록 한다.
5. 1091줄짜리 단일 파일(`IpoCalendarPage.tsx`)에 몰려있던 코드를 기능 단위로 분리한다.

## 2. Before → After 요약

| 항목 | Before | After |
|---|---|---|
| 파일 구조 | `IpoCalendarPage.tsx` 1091줄 하나에 페이지, 두 섹션, 카드, 날짜 유틸 전부 포함 | 역할별로 12개 파일로 분리 (아래 3장 참고) |
| 공모주 달력 UI | 요일 정렬 없는 32일 롤링 flat 그리드 | 요일 정렬된 월 달력, 범위 밖 날짜는 disabled |
| 공모주 데이터 범위 안내 | `className="hidden"`으로 숨겨진 죽은 문구 | 달력 위에 실제로 보이는 안내 배너(Notice info) |
| 실적 발표 월간 UI | 자체 구현 6주 그리드 (`EventCalendarGrid` 사용) | 공모주와 동일한 `Calendar` 컴포넌트 사용 |
| 날짜 헤더 스타일 | 두 탭이 각자 다른 헤더/뱃지 스타일 구현 | `Calendar` 컴포넌트가 헤더·뱃지·카드 노출개수 규칙을 전담해 100% 동일 |
| 카드 노출 개수 | 공모주는 무제한 나열, 실적은 3개+`+N` | 두 탭 모두 기본 3개 + `+N` (실적 검색 중에는 30개까지 예외) |
| 카운트 뱃지 색상 | 공모주 초록(positive), 실적 파랑(primary) | 둘 다 `primary` 색상으로 통일 |
| 월 이동 | 실적만 이전/다음 버튼 존재, 공모주는 없음 | 공모주도 월 이동 버튼 추가 (현재 달 ~ 32일이 끝나는 달까지만 이동 가능) |
| 오늘 날짜 강조 | 없음 | 오늘 칸은 테두리 강조 + 날짜 숫자를 원형 배지로 표시 |
| 네비게이션 레이아웃 | 라벨 작게, 버튼은 반대편 끝에 분리 | 월/기간 라벨을 크게 키우고 바로 옆에 이전/다음 버튼 배치 |
| 알려진 버그 | `buildRollingCalendar`에서 정의되지 않은 `CalendarDay` 타입 참조 | 제거됨 (새 구조로 대체) |

## 3. 새 파일 구조

```
apps/web/src/domain/calendar/                     ← 공모주/실적 공용 달력 모듈 (신규)
├── components/
│   ├── Calendar.tsx            신규  두 달력이 공유하는 핵심 컴포넌트
│   ├── CalendarRangeNav.tsx    신규  이전/다음 네비게이션 + 범위 라벨
│   ├── CalendarSkeleton.tsx    신규  달력형/리스트형 로딩 스켈레톤
│   └── EventCalendarGrid.tsx   deprecated  더 이상 사용되지 않음 (4장 참고)
└── utils/
    └── date.ts                 신규  buildMonthGrid, toDateKey, isWeekend 등 공용 날짜 유틸

apps/web/src/domain/ipo/
├── components/
│   ├── IpoCalendarPage.tsx     축소  탭 전환 셸만 남김 (기존 1091줄 → 79줄)
│   ├── IpoCalendarSection.tsx  신규  공모주 달력 섹션 전체 로직
│   ├── UsEarningsSection.tsx   신규  실적 발표 섹션 전체 로직
│   ├── EarningsList.tsx        신규  실적 데일리/주간 카드 리스트
│   └── cards/
│       ├── IpoCompactCard.tsx      신규  달력 칸 안에 들어가는 공모주 카드
│       ├── IpoListCard.tsx         신규  하단 상세 목록용 공모주 카드
│       ├── EarningsCard.tsx        신규  데일리/주간용 실적 카드
│       └── EarningsCompactCard.tsx 신규  월간 달력 칸용 실적 카드
├── utils/
│   ├── ipoCalendar.ts           신규  공모주 이벤트 계산, 공모가/청약일 포맷 함수
│   └── earningsCalendar.ts      신규  실적 뷰(일/주/월) 범위 계산, 네비게이션 가능여부 계산
└── types.ts                     기존 유지 (IpoCalendarItem, UsEarningsCalendarItem 등)

apps/web/src/common/components/Notice.tsx   수정  info(안내) 배너 variant 추가
```

라우트 파일들(`app/(auth)/(market)/calendar/*`, `app/(auth)/ipo/page.tsx`)은 여전히 `IpoCalendarPage`를 그대로 import하므로 변경하지 않았다.

## 4. 핵심 컴포넌트

### 4.1 `Calendar.tsx`

두 탭이 100% 동일한 규칙으로 그리는 요일 정렬 월간 그리드. 이벤트 타입을 모르는 제네릭 컴포넌트라 카드 디자인만 호출부(`renderEvent`)가 결정한다.

```ts
type CalendarDay<TEvent> = MonthGridCell & {
  disabled?: boolean;   // true면 카드가 렌더링되지 않고 회색으로 비활성 표시
  events: TEvent[];
};

type CalendarProps<TEvent, TDay> = {
  days: TDay[];
  weekdayLabels: string[];
  notice?: ReactNode;                 // 달력 위 안내 배너
  nav?: ReactNode;                    // 달력 위 네비게이션 영역
  getEventKey: (event, day) => string;
  renderEvent: (event, day) => ReactNode;   // 카드 하나 렌더링 — 여기만 탭마다 다름
  maxVisibleEvents?: number | ((day) => number);  // 기본 3, 초과분은 "+N"
  emptyLabel?: string | ((day) => string | null);
  countClassName?: string;            // 기본 'bg-primary/10 text-primary'
};
```

컴포넌트가 자체적으로 처리하는 것 (두 탭이 절대 다를 수 없는 부분):
- 요일 헤더 행 (일~토)
- 날짜 숫자 표시, disabled/dimmed(다른 달) 스타일
- **오늘 날짜 강조**: `toDateKey(new Date())`와 비교해서 오늘 칸은 `border-primary` 테두리 + 날짜 숫자를 흰 글씨의 원형 primary 배지로 표시. disabled(예: 공모주 달력에서 오늘이 주말)여도 강조는 유지된다.
- 카운트 뱃지 (이벤트 개수, primary 색 고정)
- `maxVisibleEvents` 초과 시 "+N" 표시
- 이벤트 0개일 때 `emptyLabel` 표시 여부

### 4.2 `CalendarRangeNav.tsx`

이전/다음 버튼 + 현재 범위 라벨. 공모주 월 이동, 실적 일/주/월 이동에서 모두 재사용한다.

- 라벨을 `text-lg sm:text-xl font-bold`로 크게 키움 (기존 `text-xs` 대비 강조)
- 이전/다음 버튼을 라벨 바로 옆(`flex items-center gap-3`)에 배치 (기존에는 `justify-between`으로 양 끝에 분리되어 있었음)

### 4.3 `CalendarSkeleton.tsx`

- `CalendarSkeleton`: 42칸 그리드 로딩 스켈레톤 (월간/공모주 달력용)
- `CalendarListSkeleton`: 카드 리스트 로딩 스켈레톤 (실적 데일리/주간용)

### 4.4 `Notice.tsx` (수정)

기존에는 `message`(성공, 초록)와 `error`(에러, 빨강)만 있었다. `info`(안내, primary 색) variant를 추가해서 "이 달력은 32일치만 제공합니다" 같은 설명 배너로 재사용한다. `message`/`error`도 optional로 변경했지만 기존 호출부(`<Notice message="" error={...} />` 형태)는 그대로 동작한다.

### 4.5 `domain/calendar/utils/date.ts`

두 탭이 각자 구현했던 날짜 계산을 하나로 통합했다.

- `buildMonthGrid(anchorDate)`: 일요일 시작 6주(42칸) 그리드 생성
- `toDateKey` / `parseDateKey`: `YYYY-MM-DD` 로컬 날짜 키 변환
- `isWeekend`, `isSameMonth`, `isBeforeMonth`, `isAfterMonth`
- `weekdayLabels(language)`: 로케일에 맞는 일~토 라벨
- `formatMonthLabel`, `formatRangeLabel`, `formatDayLabel`
- `addDays`, `addMonths`, `startOfDay`, `startOfMonth`, `getPreviousMonthStart`

## 5. 공모주 달력 (`IpoCalendarSection.tsx`)

- 데이터는 기존과 동일하게 `/markets/ipos`에서 전체를 받아온 뒤 클라이언트에서 날짜별로 매핑한다.
- **32일 윈도우**: `오늘(windowStart) ~ 오늘+31일(windowEnd)`. 이 범위 밖 날짜 또는 주말은 `disabled = true`로 표시되어 카드가 렌더링되지 않고 회색 비활성 칸으로 보인다.
- **월 이동**: `anchorMonth` 상태로 관리. 이동 가능 범위는 `현재 달(minMonth)` ~ `windowEnd가 속한 달(maxMonth)`로 제한된다. 그 이전/이후로는 이동할 수 없다.
- **안내 배너**: 달력 바로 위에 "오늘부터 32일간의 공모주 청약·상장 일정만 제공합니다. 그 밖의 날짜는 비활성 처리됩니다. DART 공시 기준으로 매일 새벽 3시에 갱신됩니다." 문구를 `Notice info`로 노출한다. (기존에는 `className="hidden"`으로 숨겨져 있던 문구를 되살리고 범위 설명을 추가함)
- **상단 총 건수 뱃지**: 달력 위 `CalendarDays` 아이콘 + 숫자는 `/markets/ipos` 응답 전체 건수(`items.length`)를 보여준다. 32일 윈도우 안에서 실제로 보이는 이벤트 수와는 다를 수 있음 (후속 논의 항목, 7장 참고).
- 달력 아래에는 기존과 동일하게 전체 공모주 상세 목록(`IpoListCard`)이 남아있다.

## 6. 실적 발표 (`UsEarningsSection.tsx`)

- 데이터 소스(`/markets/calendar/earnings/us`, `/mine`, `/bounds`), 검색/자동완성, "내 관심종목만" 체크박스, 날짜 범위 계산(`getEarningsRange`), bounds 기반 이동 가능 여부(`canMoveEarningsRange`) 로직은 기존과 동일하게 유지했다.
- **월간 뷰**: `Calendar` 컴포넌트로 교체. 검색 중일 때는 `maxVisibleEvents={30}`, 아닐 때는 `3`으로 설정. 검색 중이고 결과가 없는 날짜에는 "검색 결과 없음" 표시.
- **데일리/주간 뷰**: 기존과 동일하게 `EarningsList`(날짜별 섹션 + 카드 그리드) 유지. 다만 네비게이션은 공용 `CalendarRangeNav`로 교체해서 스타일을 통일했다.

## 7. 알려진 이슈 / 후속 작업

1. **타입체크 미실행**: 이번 세션의 셸 샌드박스가 디스크 부족으로 기동에 실패해 `tsc --noEmit` / `npm run build`를 직접 돌리지 못했다. 코드는 꼼꼼히 재검토했지만, 로컬에서 빌드 한 번 확인해보는 것을 권장한다.
2. **`EventCalendarGrid.tsx` 수동 삭제 필요**: 같은 이유로 `rm` 명령을 실행하지 못해 파일을 완전히 지우지 못했다. 현재는 파일 상단에 deprecated 주석만 남겨뒀고, 아무 곳에서도 import하지 않으므로 안전하게 수동 삭제 가능하다. (`apps/web/src/domain/calendar/components/EventCalendarGrid.tsx`)
3. **공모주 총 건수 뱃지의 의미**: `items.length`는 서버가 내려주는 전체 공모주 레코드 수이고, 화면에 보이는 32일 달력 범위와 정확히 일치하지 않을 수 있다. "32일 윈도우 안에 실제로 표시된 이벤트 수"로 바꿀지는 아직 결정하지 않았다.
4. **확장 여지**: `Calendar`는 이벤트 타입을 모르는 제네릭 컴포넌트라, 나중에 "필터로 공모주+실적을 한 달력에 같이 보기" 기능을 추가할 때 `renderEvent`에서 이벤트 종류에 따라 다른 카드를 그리도록 확장하면 된다. 이번 작업 범위에는 포함하지 않았다.
5. **레거시 라우트**: `app/(auth)/ipo/page.tsx`가 `app/(auth)/(market)/calendar/ipo/page.tsx`와 동일하게 `IpoCalendarPage`를 렌더링하는 중복 라우트로 남아있다 (이번 리팩토링 이전부터 존재하던 것으로 손대지 않았다).

## 8. 사용자 확인 후 확정한 설계 결정

리팩토링 시작 전 아래 3가지를 사용자에게 확인하고 진행했다.

- 공모주 달력에 월 이동 버튼을 추가한다 (실적 캘린더와 동일한 네비게이션).
- 공모주 달력에서 주말 칸도 disabled 스타일로 표시한다.
- 파일 분리 리팩토링까지 함께 진행한다 (기존 구조 유지가 아닌 다중 파일 구조로 재구성).
