'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { SegmentedControl } from '@/common/components/SegmentedControl';
import { usePreferencesStore } from '@/common/stores/preferences';
import { useSessionStore } from '@/common/stores/session';

import { IpoCalendarSection } from '@/domain/ipo/components/IpoCalendarSection';
import { UsEarningsSection } from '@/domain/ipo/components/UsEarningsSection';

type CalendarTab = 'ipo' | 'earnings';

export function IpoCalendarPage({
  initialTab = 'ipo',
}: {
  initialTab?: CalendarTab;
}) {
  const router = useRouter();
  const accessToken = useSessionStore((s) => s.accessToken);
  const language = usePreferencesStore((s) => s.language);
  const [activeTab, setActiveTab] = useState<CalendarTab>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  function switchTab(tab: CalendarTab) {
    setActiveTab(tab);
    router.push(tab === 'earnings' ? '/calendar/earnings' : '/calendar/ipo');
  }

  return (
    <div className="grid min-w-0 flex-1 gap-4 py-4 sm:gap-6 sm:py-6">
      <section className="min-w-0">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <SegmentedControl<CalendarTab>
            className="w-full sm:inline-flex sm:w-auto"
            aria-label={language === 'ko' ? '캘린더 선택' : 'Calendar view'}
            options={[
              {
                value: 'ipo',
                label: (
                  <span className="flex flex-col items-center leading-tight">
                    <span>{language === 'ko' ? '공모주' : 'IPO'}</span>
                    <span className="text-[11px] font-medium opacity-80">
                      {language === 'ko' ? '청약/상장' : 'Subscription'}
                    </span>
                  </span>
                ),
              },
              {
                value: 'earnings',
                label: (
                  <span className="flex flex-col items-center leading-tight">
                    <span>
                      {language === 'ko' ? '미국실적' : 'US Earnings'}
                    </span>
                    <span className="text-[11px] font-medium opacity-80">
                      {language === 'ko' ? '발표 일정' : 'Calendar'}
                    </span>
                  </span>
                ),
              },
            ]}
            value={activeTab}
            onChange={switchTab}
          />
        </div>

        {activeTab === 'ipo' ? (
          <IpoCalendarSection accessToken={accessToken} language={language} />
        ) : (
          <UsEarningsSection accessToken={accessToken} language={language} />
        )}
      </section>
    </div>
  );
}
