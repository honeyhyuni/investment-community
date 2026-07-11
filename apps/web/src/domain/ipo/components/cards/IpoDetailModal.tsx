import type { ComponentType } from 'react';
import { CalendarRange, ExternalLink, FileText, Rocket, Users } from 'lucide-react';

import { Modal } from '@/common/components/Modal';
import { IpoCalendarItem } from '@/domain/ipo/types';
import {
  formatListingDate,
  formatSubscription,
  getOfferPriceLabel,
  getOfferPriceValue,
  getUnderwriterNames,
} from '@/domain/ipo/utils/ipoCalendar';

/** 공모주 상세 모달. 달력 카드를 클릭했을 때 뜨는 상세 정보. */
export function IpoDetailModal({
  item,
  language,
  onClose,
}: {
  item: IpoCalendarItem | null;
  language: 'en' | 'ko';
  onClose: () => void;
}) {
  return (
    <Modal
      open={!!item}
      title={language === 'ko' ? '공모주 상세' : 'IPO details'}
      onClose={onClose}
      size="sm"
      footer={
        item ? (
          <a
            href={item.dartUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
          >
            {language === 'ko' ? 'DART 공시 보기' : 'View DART filing'}
            <ExternalLink size={15} />
          </a>
        ) : undefined
      }
    >
      {item ? <IpoDetailBody item={item} language={language} /> : null}
    </Modal>
  );
}

function IpoDetailBody({
  item,
  language,
}: {
  item: IpoCalendarItem;
  language: 'en' | 'ko';
}) {
  const priceLabel = getOfferPriceLabel(item, language);
  const priceValue = getOfferPriceValue(item);
  const underwriters = getUnderwriterNames(item);

  return (
    <div className="grid gap-5">
      <div>
        <p className="text-xl font-bold leading-tight text-foreground [overflow-wrap:anywhere]">
          {item.corpName}
        </p>
        <p className="mt-1.5 text-xs font-semibold text-muted">
          {item.stockCode ? `${item.stockCode} · ` : ''}
          {item.reportName}
        </p>
      </div>

      <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
        <p className="text-xs font-semibold text-primary/80">{priceLabel}</p>
        <p className="mt-1 text-2xl font-bold text-primary">
          {priceValue ?? (language === 'ko' ? '미확정' : 'TBD')}
        </p>
      </div>

      <dl className="grid gap-2.5 sm:grid-cols-2">
        <DetailRow
          icon={CalendarRange}
          label={language === 'ko' ? '청약일' : 'Subscription'}
          value={formatSubscription(item, language)}
        />
        <DetailRow
          icon={Rocket}
          label={language === 'ko' ? '상장일' : 'Listing date'}
          value={formatListingDate(item, language)}
        />
        <DetailRow
          icon={Users}
          label={language === 'ko' ? '주관사' : 'Underwriter'}
          value={
            underwriters.length
              ? underwriters.join(', ')
              : language === 'ko'
                ? '미확정'
                : 'TBD'
          }
        />
        <DetailRow
          icon={FileText}
          label={language === 'ko' ? '공시 접수일' : 'Filed'}
          value={item.receiptDate}
        />
      </dl>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ size?: number }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2.5 rounded-md border border-border bg-surface px-3 py-2.5">
      <div className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-surface-subtle text-muted">
        <Icon size={14} />
      </div>
      <div className="min-w-0">
        <dt className="text-xs font-semibold text-muted">{label}</dt>
        <dd className="mt-0.5 break-words text-sm font-semibold leading-5 text-foreground">
          {value}
        </dd>
      </div>
    </div>
  );
}
