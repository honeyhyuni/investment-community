export type NotificationPreferences = {
  priceEnabled: boolean;
  earningsEnabled: boolean;
  ipoEnabled: boolean;
  communityEnabled: boolean;
  newPostEnabled: boolean;
  marketBriefingEnabled: boolean;
};

export type AppNotification = {
  id: string;
  type:
    | "PRICE"
    | "EARNINGS"
    | "IPO"
    | "COMMENT"
    | "LIKE"
    | "NEW_POST"
    | "MARKET_BRIEFING"
    | "ACCOUNT";
  title: string;
  body: string;
  url: string;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

export type NotificationList = {
  items: AppNotification[];
  unreadCount: number;
};
