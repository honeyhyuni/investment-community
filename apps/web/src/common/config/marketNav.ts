/** Sub tabs shown under the Market menu. */
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
  { href: '/economic-indicators', label: { en: 'Economic Indicators', ko: '경제 지표' } },
];
