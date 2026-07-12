export type MonthGridCell = {
  date: Date;
  dateKey: string;
  inCurrentMonth: boolean;
};

/** `YYYY-MM-DD` 로컬 날짜 키. UTC 변환 없이 로컬 기준으로 만든다. */
export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

export function parseDateKey(dateKey: string): Date {
  return new Date(`${dateKey.slice(0, 10)}T00:00:00`);
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function addMonths(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + amount);
  return next;
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function isBeforeMonth(a: Date, b: Date): boolean {
  return (
    a.getFullYear() < b.getFullYear() ||
    (a.getFullYear() === b.getFullYear() && a.getMonth() < b.getMonth())
  );
}

export function isAfterMonth(a: Date, b: Date): boolean {
  return isBeforeMonth(b, a);
}

/** from~to(포함) 사이 날짜 키 목록. 필요하면 주말을 건너뛴다. */
export function dateKeysBetween(
  from: Date,
  to: Date,
  options?: { skipWeekends?: boolean },
): string[] {
  const keys: string[] = [];
  const current = startOfDay(from);
  const end = startOfDay(to);
  while (current <= end) {
    if (!options?.skipWeekends || !isWeekend(current)) {
      keys.push(toDateKey(current));
    }
    current.setDate(current.getDate() + 1);
  }
  return keys;
}

/** anchorDate가 속한 달을 일요일 시작 6주(42칸) 그리드로 만든다. */
export function buildMonthGrid(anchorDate: Date): MonthGridCell[] {
  const first = startOfMonth(anchorDate);
  const start = addDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(start, index);
    return {
      date,
      dateKey: toDateKey(date),
      inCurrentMonth: isSameMonth(date, anchorDate),
    };
  });
}

/** 일~토 요일 라벨. 특정 주(2023-01-01 일요일)를 기준으로 로케일 포맷팅한다. */
export function weekdayLabels(language: 'en' | 'ko'): string[] {
  const sunday = new Date(2023, 0, 1);
  const formatter = new Intl.DateTimeFormat(
    language === 'ko' ? 'ko-KR' : 'en-US',
    { weekday: 'short' },
  );
  return Array.from({ length: 7 }, (_, index) =>
    formatter.format(addDays(sunday, index)),
  );
}

export function formatMonthLabel(date: Date, language: 'en' | 'ko'): string {
  return new Intl.DateTimeFormat(language === 'ko' ? 'ko-KR' : 'en-US', {
    year: 'numeric',
    month: 'long',
  }).format(date);
}

export function formatRangeLabel(
  from: Date,
  to: Date,
  language: 'en' | 'ko',
): string {
  const formatter = new Intl.DateTimeFormat(
    language === 'ko' ? 'ko-KR' : 'en-US',
    { year: 'numeric', month: 'short', day: 'numeric' },
  );
  if (toDateKey(from) === toDateKey(to)) {
    return formatter.format(from);
  }
  return `${formatter.format(from)} - ${formatter.format(to)}`;
}

export function formatDayLabel(date: string, language: 'en' | 'ko'): string {
  return new Intl.DateTimeFormat(language === 'ko' ? 'ko-KR' : 'en-US', {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date(`${date}T00:00:00`));
}

export function getPreviousMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() - 1, 1);
}
