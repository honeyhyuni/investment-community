/** "마켓" 메뉴 하위 서브탭. 라우트는 기존 경로를 그대로 사용한다. */
export const MARKET_TABS: Array<{
  href: string;
  label: { en: string; ko: string };
}> = [
  {
    href: '/market-briefing',
    label: { en: 'Daily Report', ko: '일일 리포트' },
  },
  { href: '/news', label: { en: 'News', ko: '뉴스' } },
  { href: '/calendar', label: { en: 'Calendar', ko: '캘린더' } },
];
