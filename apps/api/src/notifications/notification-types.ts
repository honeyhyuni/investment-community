export const NOTIFICATION_TYPES = [
  'PRICE',
  'EARNINGS',
  'IPO',
  'COMMENT',
  'LIKE',
  'NEW_POST',
  'MARKET_BRIEFING',
  'ACCOUNT',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type NotificationPreferences = {
  priceEnabled: boolean;
  earningsEnabled: boolean;
  ipoEnabled: boolean;
  communityEnabled: boolean;
  newPostEnabled: boolean;
  marketBriefingEnabled: boolean;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  priceEnabled: false,
  earningsEnabled: true,
  ipoEnabled: true,
  communityEnabled: false,
  newPostEnabled: false,
  marketBriefingEnabled: true,
};

export function preferenceKeyForType(
  type: NotificationType,
): keyof NotificationPreferences {
  switch (type) {
    case 'PRICE':
      return 'priceEnabled';
    case 'EARNINGS':
      return 'earningsEnabled';
    case 'IPO':
      return 'ipoEnabled';
    case 'COMMENT':
    case 'LIKE':
      return 'communityEnabled';
    case 'NEW_POST':
      return 'newPostEnabled';
    case 'MARKET_BRIEFING':
      return 'marketBriefingEnabled';
    case 'ACCOUNT':
      return 'communityEnabled';
  }
}
