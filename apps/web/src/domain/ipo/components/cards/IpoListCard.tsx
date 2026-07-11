// Deprecated: replaced by `IpoDetailModal` (달력 카드 클릭 시 뜨는 상세 모달).
// No longer used anywhere in the app — safe to delete this file. Kept temporarily
// because this session's shell sandbox couldn't run `rm` (no disk space).
import { ExternalLink } from 'lucide-react';

import { IpoCalendarItem } from '@/domain/ipo/types';
import {
  formatListingDate,
  formatSubscription,
  getOfferPriceLabel,
  getOfferPriceValue,
} from '@/domain/ipo/utils/ipoCalendar';

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-surface px-3 py-2">
      <dt className="text-xs font-semibold text-muted">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold leading-5 text-foreground">
        {value}
      </dd>
    </div>
  );
}

/** 상세 목록에 쓰이는 전체 폭 공모주 카드. */
export function IpoListCard({
  item,
  language,
}: {
  item: IpoCalendarItem;
  language: 'en' | 'ko';
}) {
  return (
    <article className="rounded-md border border-border bg-surface-muted p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-lg font-semibold text-foreground">
            {item.corpName}
          </p>
          <p className="mt-1 text-xs font-semibold text-muted">
            {item.stockCode ? `${item.stockCode} · ` : ''}
            {item.reportName}
          </p>
        </div>
        <a
          href={item.dartUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 w-fit cursor-pointer items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-semibold text-foreground transition-colors hover:border-primary hover:text-primary"
        >
          DART
          <ExternalLink size={15} />
        </a>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <InfoCell
          label={language === 'ko' ? '청약일' : 'Subscription'}
          value={formatSubscription(item, language)}
        />
        <InfoCell
          label={language === 'ko' ? '상장일' : 'Listing date'}
          value={formatListingDate(item, language)}
        />
        <InfoCell
          label={getOfferPriceLabel(item, language)}
          value={getOfferPriceValue(item) ?? '-'}
        />
        <InfoCell
          label={language === 'ko' ? '주관사' : 'Underwriter'}
          value={item.underwriter ?? '-'}
        />
        <InfoCell
          label={language === 'ko' ? '공시 접수일' : 'Filed'}
          value={item.receiptDate}
        />
      </dl>
    </article>
  );
}
