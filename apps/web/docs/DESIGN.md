# 디자인 시스템 (Foundation)

> 이 문서는 `apps/web`의 **목표 디자인 사양**이다. 새 UI를 만들거나 옮길 때 이 규칙을 따른다.
> 색은 전부 `src/app/globals.css`의 **토큰**을 단일 소스로 삼는다. 컴포넌트에 hex를 직접 박지 않는다.
> 현재 코드는 토큰 마이그레이션 진행 중 — 아직 하드코딩 hex가 남아 있다(아래 §6 참고).

---

## 1. 브랜드 파운데이션

로고는 **상승 차트 라인 + 우상단 화살표**(`public/icons/icon.svg`)로 "성장"을 나타낸다.

- **green(`#22c55e`) → sky(`#38bdf8`) 그라데이션** = 성장(green) + 기술·신뢰(sky)의 결합. 브랜드 시그니처.
- 배경은 네이비 슬레이트(`#0f172a` 계열) — 차분하고 데이터에 집중되는 금융 톤.

**시그니처 그라데이션** — 로고·히어로·강조 영역에만 절제해서 사용:

```
--brand-gradient: linear-gradient(90deg, #22c55e, #38bdf8);
/* 사용: class="bg-[image:var(--brand-gradient)]" */
```

### 앱 아이콘 SVG 규칙 (`public/icons/`)
- `viewBox="0 0 512 512"`, 라인 stroke `30`, 화살표 stroke `24`, baseline stroke `18`, 모두 `round` cap/join.
- 추세선은 화살표 직각을 **정확히 45°로 이등분**하며 들어온다(`dx=dy`). 둥근 끝이 화살표 꼭짓점에 정확히 닿게 — 삐져나오지 않게.
- `icon.svg`는 둥근 사각형 배경, `maskable-icon.svg`는 **풀블리드 정사각형 + safe-zone 원**(PWA 마스킹 대응). 라인 컬러·그라데이션은 둘이 동일하게 유지한다.

---

## 2. 컬러

3층 구조. 정의는 `globals.css`에 있고, 여기서는 **언제 무엇을 쓰는지** 규칙을 둔다.

### 2.1 Primitive (브랜드 고정색, 정적)
로고에서 추출한 원시 스케일. 직접 쓰기보다 semantic을 통해 쓴다.

| 토큰 / 유틸 | 값 |
|---|---|
| `navy-900 / 800 / 700 / 600` | `#0f172a` `#13233d` `#1b2840` `#334155` |
| `brand-green` | `#22c55e` |
| `brand-sky` | `#38bdf8` |

### 2.2 Semantic (의미 토큰 — light/dark 자동 스왑)
`bg-*`, `text-*`, `border-*` 유틸로 쓴다. 다크모드는 `.dark-app`/`.dark`에서 값만 스왑된다.

| 의미 | 유틸 | Light | Dark | 언제 |
|---|---|---|---|---|
| 페이지 배경 | `bg-background` | `#f7f8fb` | `#11151b` | 최상위 바탕 |
| 표면(카드) | `bg-surface` | `#ffffff` | `#11151b` | 카드·패널 |
| 옅은 표면 | `bg-surface-muted` | `#f6f7fb` | `#151b23` | 섹션 구분 바탕 |
| 더 옅은 표면 | `bg-surface-subtle` | `#eef1f6` | `#1b222c` | 코드블록·인셋 |
| 본문 텍스트 | `text-foreground` | `#151923` | `#edf1f7` | 기본 글자 |
| 보조 텍스트 | `text-muted` | `#607086` | `#aeb8c7` | 메타·라벨·placeholder |
| 보더 | `border-border` | `#d9dee8` | `#374151` | 기본 구분선 |
| 강한 보더 | `border-border-strong` | `#c7ceda` | `#4b5563` | 강조 구분선 |
| **주요 액션** | `text-primary` / `bg-primary` | `#0ea5e9` | `#38bdf8` | 링크·버튼·선택 상태 |
| 액션 hover | `bg-primary-hover` | `#0284c7` | `#7dd3fc` | primary hover/active |
| 액션 위 글자 | `text-on-primary` | `#ffffff` | `#ffffff` | `bg-primary` 위 텍스트 |
| 상승(이익) | `text-positive` | `#16a34a` | `#22c55e` | 가격 상승·이익·성공 |
| 상승 바탕 | `bg-positive-surface` | `#ecfdf3` | `#10271b` | 상승 배지 배경 |
| 하락(손실) | `text-negative` | `#b64242` | `#d74848` | 가격 하락·손실·에러 |
| 하락 바탕 | `bg-negative-surface` | `#fff1f1` | `#2a1414` | 하락 배지 배경 |

### 2.3 사용 규칙
- **primary는 sky 계열.** 라이트 배경에선 대비 위해 `#0ea5e9`(한 단계 진한 sky), 다크에선 로고 원본 `#38bdf8`. 클릭 가능한 액션·링크·선택 상태에만.
- **green은 "primary"가 아니라 "상승(positive)"** 의미로만 쓴다. 브랜드 그린(`brand-green`)은 로고·그라데이션 한정.
- **금융 의미는 절대 고정** — 상승=`positive`(녹색 계열), 하락=`negative`(적색 계열). 장식 목적으로 이 색을 쓰지 않는다.
- hex 직접 입력(`text-[#...]`) 금지. 필요한 의미가 없으면 토큰을 먼저 추가한다.

> **Legacy:** 기존 틸 `#1f6f8b`(및 `#195c74`/`#195b72`)는 구 primary다. 신규/이전 코드에서는 `primary`(sky)로 대체한다.

---

## 3. 타이포그래피

폰트: **Geist Sans**(`--font-sans`) 본문, **Geist Mono**(`--font-mono`) 숫자·코드.
숫자(가격·등락률)는 정렬 안정성을 위해 mono 또는 `tabular-nums` 권장.

| 역할 | 유틸 | 비고 |
|---|---|---|
| 본문 기본 | `text-sm` | 앱 전반의 기본 크기 (가장 많이 씀) |
| 메타·캡션 | `text-xs` | 라벨, 타임스탬프, 보조 정보 |
| 강조 본문 | `text-base` | 본문 중 강조, 입력 필드 |
| 소제목 | `text-lg` | 카드 제목 |
| 제목 | `text-xl` | 섹션 제목 |
| 큰 제목 | `text-2xl` / `text-3xl` | 페이지/히어로 (드물게) |

**Weight:** 강조는 `font-semibold`(600)를 표준으로 쓴다. 본문은 기본(400), 약강조 `font-medium`(500). **`font-bold`는 지양** — 코드 전반이 semibold 기조다.

---

## 4. Radius & Elevation

**Radius**

| 유틸 | 용도 |
|---|---|
| `rounded-md` | **기본값.** 버튼·인풋·배지·대부분의 카드 |
| `rounded-lg` | 큰 카드·모달·시트 |
| `rounded-full` | pill 배지·아바타·아이콘 버튼 |

**Elevation (그림자)** — 전반적으로 **플랫**하게. 깊이는 보더+옅은 그림자로.

| 유틸 | 용도 |
|---|---|
| `shadow-sm` | **기본값.** 카드·드롭다운 등 떠 있는 표면 |
| `shadow-md` / `shadow-lg` | 모달·팝오버 등 강하게 떠야 할 때만 (드물게) |

윗방향 그림자(바텀시트·하단 nav)는 `shadow-[0_-8px_24px_rgba(21,25,35,0.08)]` 패턴 유지.

---

## 5. Spacing & Layout

Tailwind 4px 스케일 기준. 자주 쓰는 값으로 통일한다.

**간격(gap / margin)**

| 유틸 | px | 용도 |
|---|---|---|
| `gap-2` | 8 | 인접 요소(아이콘+텍스트, 인라인 그룹) |
| `gap-3` | 12 | 폼 필드·리스트 항목 사이 |
| `gap-4` | 16 | 카드 내부 블록·섹션 내 그룹 |
| `gap-6` | 24 | 큰 섹션 사이 |

**패딩**

| 컨텍스트 | 권장 |
|---|---|
| 카드 내부 | `p-4` ~ `p-5` (16~20) |
| 버튼·인풋 | `px-3 py-2` (수평 12 / 수직 8) 기준 |
| 컴팩트 배지 | `px-2.5 py-1` |

**레이아웃 폭**
- 페이지 콘텐츠 최대 폭: `max-w-7xl` + 좌우 패딩, 가운데 정렬.
- 모바일 안전영역: body에 `env(safe-area-inset-*)` 적용됨(globals.css). 하단 고정 UI는 safe-area 고려.

---

## 6. 토큰 사용 & 마이그레이션 상태

- **단일 소스:** 모든 색은 `globals.css`의 토큰. 컴포넌트는 의미 유틸(`bg-surface`, `text-primary` …)만 사용.
- **다크모드:** `.dark-app`(현 토글) / `.dark`에서 semantic 변수만 스왑. 신규 코드는 hex 직접 다크 분기를 만들지 말 것.
- **진행 상태:** 토큰 레이어는 정의 완료. 컴포넌트(22개 파일)는 아직 하드코딩 hex 사용 중 → 점진 이전 예정. 이전 시 매핑:

| 기존 hex | → 토큰 유틸 |
|---|---|
| `#1f6f8b` (틸 primary) | `primary` |
| `#607086` | `muted` |
| `#344052` `#161a22` `#151923` | `foreground` |
| `#d9dee8` `#d4dae5` | `border` |
| `#c7ceda` | `border-strong` |
| `#f6f7fb` `#f9fafc` `#f6f8fb` | `surface-muted` |
| `#eef1f6` `#f3f5f9` | `surface-subtle` |
| `#2e7d4f` `#27613a` | `positive` |
| `#b64242` `#9a2f2f` `#d74848` | `negative` |
| `#fff1f1` `#fff2f2` | `negative-surface` |
