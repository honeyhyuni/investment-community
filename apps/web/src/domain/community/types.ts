export type CommunityScope = "all" | "subscribed" | "mine" | "bookmarks";

export type FeedSort = "latest" | "popular";

export type StockTag = {
  symbol: string;
  name: string;
  market: "US" | "KR";
};

export type CommunityUser = {
  id: string;
  nickname: string;
  email: string;
  isMe: boolean;
  isSubscribed: boolean;
  subscriberCount: number;
  followingCount: number;
  postCount: number;
};

export type CommunityComment = {
  id: string;
  content: string;
  author: {
    id: string;
    nickname: string;
  };
  createdAt: string;
  replies: CommunityComment[];
};

export type CommunityContentBlock = {
  id: string;
  type: "text" | "image";
  text?: string;
  url?: string;
};

export type CommunityPost = {
  id: string;
  title: string | null;
  content: string;
  contentBlocks: CommunityContentBlock[];
  imageUrls: string[];
  caption: string;
  stockTags: StockTag[];
  author: {
    id: string;
    nickname: string;
  };
  createdAt: string;
  updatedAt: string;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  bookmarkedByMe: boolean;
  comments: CommunityComment[];
};
