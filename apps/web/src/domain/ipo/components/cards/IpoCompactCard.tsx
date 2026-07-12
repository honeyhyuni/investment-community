import {
  IpoCalendarEvent,
  getOfferPriceValue,
  getUnderwriterNames,
} from '@/domain/ipo/utils/ipoCalendar';

/** 달력 칸 안에 들어가는 압축 카드. 청약/상장 이벤트 하나를 표시한다. 클릭하면 상세 모달을 띄운다. */
export function IpoCompactCard({
  event,
  language,
  onClick,
}: {
  event: IpoCalendarEvent;
  language: 'en' | 'ko';
  onClick?: () => void;
}) {
  const item = event.item;
  const eventLabel =
    event.type === 'listing'
      ? language === 'ko'
        ? '상장'
        : 'Listing'
      : language === 'ko'
        ? '공모'
        : 'Subscription';
  const eventBadgeClass =
    event.type === 'listing'
      ? 'bg-primary/10 text-primary'
      : 'bg-pink-400/10 text-pink-500 dark:text-pink-300';
  const offerPriceLabel = language === 'ko' ? '공모가' : 'Offer price';
  const underwriters = getUnderwriterNames(item);

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full min-w-0 cursor-pointer rounded-md border border-border bg-surface px-2 py-1.5 text-left transition-colors hover:border-primary"
    >
      <span
        className={`inline-flex max-w-full items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold sm:text-[10px] ${eventBadgeClass}`}
      >
        {eventLabel}
      </span>

      <p className="mt-1 break-all text-xs font-semibold leading-4 text-foreground [overflow-wrap:anywhere] sm:text-sm sm:leading-5">
        {item.corpName}
      </p>

      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1">
        {underwriters.length ? (
          underwriters.map((name) => (
            <span
              key={name}
              className="inline-flex min-w-0 items-center rounded-full bg-surface-subtle px-1.5 py-0.5 text-[9px] font-semibold text-muted sm:text-[10px]"
            >
              {name}
            </span>
          ))
        ) : (
          <span className="inline-flex items-center rounded-full bg-surface-subtle px-1.5 py-0.5 text-[9px] font-semibold text-muted sm:text-[10px]">
            {language === 'ko' ? '주관사 미확정' : 'Underwriter TBD'}
          </span>
        )}
      </div>

      <p className="mt-1 break-words text-[10px] font-semibold leading-4 text-primary sm:text-[11px]">
        {offerPriceLabel}: {getOfferPriceValue(item) ??
          (language === 'ko' ? '미확정' : 'TBD')}
      </p>
    </button>
  );
}
