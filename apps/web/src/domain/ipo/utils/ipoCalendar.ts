import { IpoCalendarItem } from '@/domain/ipo/types';

export type IpoCalendarEvent = {
  item: IpoCalendarItem;
  type: 'subscription' | 'listing';
};

function isDateInSubscriptionRange(item: IpoCalendarItem, date: string): boolean {
  if (!item.subscriptionStartDate) {
    return false;
  }
  const endDate = item.subscriptionEndDate ?? item.subscriptionStartDate;
  return item.subscriptionStartDate <= date && date <= endDate;
}

export function buildIpoCalendarEvents(
  items: IpoCalendarItem[],
  date: string,
): IpoCalendarEvent[] {
  return items.flatMap((item) => {
    const events: IpoCalendarEvent[] = [];
    if (isDateInSubscriptionRange(item, date)) {
      events.push({ item, type: 'subscription' });
    }
    if (item.listingDate === date) {
      events.push({ item, type: 'listing' });
    }
    return events;
  });
}

/** 공동 주관사가 있으면 ", "로 이어져 오는 문자열이라 배열로 쪼갠다. */
export function getUnderwriterNames(item: IpoCalendarItem): string[] {
  if (!item.underwriter) {
    return [];
  }
  return item.underwriter
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
}

export function getOfferPriceValue(item: IpoCalendarItem): string | null {
  return item.confirmedOfferPrice ?? item.expectedOfferPrice;
}

export function getOfferPriceLabel(
  item: IpoCalendarItem,
  language: 'en' | 'ko',
): string {
  if (item.confirmedOfferPrice) {
    return language === 'ko' ? '확정공모가' : 'Confirmed price';
  }
  return language === 'ko' ? '희망공모가' : 'Expected price';
}

export function formatSubscription(
  item: IpoCalendarItem,
  language: 'en' | 'ko',
): string {
  if (item.subscriptionDateText) {
    return item.subscriptionDateText;
  }
  if (item.subscriptionStartDate) {
    return item.subscriptionStartDate;
  }
  return language === 'ko' ? '문서 확인 필요' : 'Check DART filing';
}

export function formatListingDate(
  item: IpoCalendarItem,
  language: 'en' | 'ko',
): string {
  if (item.listingDateText) {
    return item.listingDateText;
  }
  if (item.listingDate) {
    return item.listingDate;
  }
  return language === 'ko' ? '상장일 미정' : 'Listing date TBD';
}
