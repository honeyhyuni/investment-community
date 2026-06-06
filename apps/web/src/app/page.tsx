"use client";

import {
  Dispatch,
  FormEvent,
  SetStateAction,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Check,
  Heart,
  Image as ImageIcon,
  Loader2,
  LogOut,
  MessageCircle,
  Moon,
  Pencil,
  Plus,
  Send,
  Sun,
  Trash2,
  UserPen,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import {
  BusinessDay,
  CandlestickData,
  CandlestickSeries,
  createChart,
  IChartApi,
  ISeriesApi,
  Time,
} from "lightweight-charts";
import { useRouter } from "next/navigation";
import {
  apiRequest,
  User,
  UserStatus,
} from "@/lib/api";
import { Notice } from "@/common/components/Notice";
import { TextInput } from "@/common/components/TextInput";
import { statusLabel } from "@/common/components/StatusBadge";
import { SessionLoading } from "@/common/components/SessionLoading";
import { useSessionStore } from "@/common/stores/session";
import { useMarketDataStore } from "@/common/stores/market-data";
import {
  DisplayCurrency,
  MarketQuote,
  StockSymbol,
  TradeTick,
} from "@/common/types";

type View = "stocks" | "news" | "community" | "admin" | "profile";
type Language = "en" | "ko";
type StockTab = "US" | "KR";
type NewsCategory = "us" | "kr";
type CommunityScope = "all" | "subscribed" | "mine";
type FeedSort = "latest" | "popular";

type MarketNews = {
  category: string;
  datetime: number;
  headline: string;
  id: number;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
};

type StockDetail = {
  symbol: string;
  profile: {
    name?: string;
    exchange?: string;
    currency?: string;
    logo?: string;
    weburl?: string;
    finnhubIndustry?: string;
    marketCapitalization?: number;
    ipo?: string;
    country?: string;
    shareOutstanding?: number;
  };
  metrics: Record<string, number | string | null | undefined> | null;
  overview: {
    en: string;
    ko: string;
    source: string;
    fetchedAt: string | null;
  };
  quote: MarketQuote;
};

type ChartPeriod = "1D" | "1M" | "1Y" | "3Y" | "5Y" | "ALL";

type CandlePoint = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type CommunityUser = {
  id: string;
  nickname: string;
  email: string;
  isMe: boolean;
  isSubscribed: boolean;
  subscriberCount: number;
  followingCount: number;
};

type CommunityComment = {
  id: string;
  content: string;
  author: {
    id: string;
    nickname: string;
  };
  createdAt: string;
  replies: CommunityComment[];
};

type CommunityContentBlock = {
  id: string;
  type: "text" | "image";
  text?: string;
  url?: string;
};

type CommunityPost = {
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
  comments: CommunityComment[];
};

type StockTag = {
  symbol: string;
  name: string;
  market: StockTab;
};

const chartPeriods: ChartPeriod[] = ["1D", "1M", "1Y", "3Y", "5Y", "ALL"];
const newsCategories: Array<{ id: NewsCategory; label: string }> = [
  { id: "us", label: "미국뉴스" },
  { id: "kr", label: "한국뉴스" },
];

function makeEditorBlockId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const menus: Array<{ id: View; label: string }> = [
  { id: "stocks", label: "Stocks" },
  { id: "news", label: "News" },
  { id: "community", label: "Community" },
  { id: "admin", label: "Admin" },
];

const copy = {
  en: {
    translate: "한국어",
    logout: "Logout",
    stocks: "Stocks",
    news: "News",
    community: "Community",
    admin: "Admin",
    marketPulse: "Market pulse",
    refresh: "Refresh",
    stockList: "Stock list",
    stockHint: "US list is filtered to major exchanges first.",
    korea: "Korea",
    us: "United States",
    search: "Search symbol or company",
    overview: "Company overview",
    showOther: "Show Korean",
    access: "Access approvals",
  },
  ko: {
    translate: "English",
    logout: "로그아웃",
    stocks: "종목",
    news: "뉴스",
    community: "커뮤니티",
    admin: "관리자",
    marketPulse: "시장 지표",
    refresh: "새로고침",
    stockList: "종목 리스트",
    stockHint: "미국 종목은 주요 거래소를 우선 표시합니다.",
    korea: "한국주식",
    us: "미국주식",
    search: "종목명 또는 심볼 검색",
    overview: "기업 개요",
    showOther: "영어 보기",
    access: "가입 승인",
  },
};

export default function Home() {
  const [view, setView] = useState<View>("stocks");
  const [language, setLanguage] = useState<Language>("en");
  const [stockTab, setStockTab] = useState<StockTab>("US");
  const accessToken = useSessionStore((s) => s.accessToken);
  const user = useSessionStore((s) => s.user);
  const authChecking = useSessionStore((s) => s.authChecking);
  const setUser = useSessionStore((s) => s.setUser);
  const logoutSession = useSessionStore((s) => s.logout);
  const pulse = useMarketDataStore((s) => s.pulse);
  const usStocks = useMarketDataStore((s) => s.usStocks);
  const usSymbols = useMarketDataStore((s) => s.usSymbols);
  const krStocks = useMarketDataStore((s) => s.krStocks);
  const krSymbols = useMarketDataStore((s) => s.krSymbols);
  const livePrices = useMarketDataStore((s) => s.livePrices);
  const liveSeries = useMarketDataStore((s) => s.liveSeries);
  const marketLoading = useMarketDataStore((s) => s.marketLoading);
  const loadMarketData = useMarketDataStore((s) => s.loadMarketData);
  const router = useRouter();
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [news, setNews] = useState<MarketNews[]>([]);
  const [newsPage, setNewsPage] = useState(1);
  const [newsCategory, setNewsCategory] = useState<NewsCategory>("us");
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([]);
  const [communityUsers, setCommunityUsers] = useState<CommunityUser[]>([]);
  const [communityScope, setCommunityScope] = useState<CommunityScope>("all");
  const [feedSort, setFeedSort] = useState<FeedSort>("latest");
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [selectedCommunityPostId, setSelectedCommunityPostId] = useState<string | null>(null);
  const [postTitle, setPostTitle] = useState("");
  const [postContent, setPostContent] = useState("");
  const [postBlocks, setPostBlocks] = useState<CommunityContentBlock[]>([
    { id: makeEditorBlockId(), type: "text", text: "" },
  ]);
  const [postImages, setPostImages] = useState<string[]>([]);
  const [postTagQuery, setPostTagQuery] = useState("");
  const [postTags, setPostTags] = useState<StockTag[]>([]);
  const [relatedPosts, setRelatedPosts] = useState<CommunityPost[]>([]);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [communityLoading, setCommunityLoading] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState("AAPL");
  const [stockDetail, setStockDetail] = useState<StockDetail | null>(null);
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>("1M");
  const [priceCurrency, setPriceCurrency] = useState<DisplayCurrency>("USD");
  const [candles, setCandles] = useState<CandlePoint[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [darkMode, setDarkMode] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem("darkMode") === "true",
  );
  const [loading, setLoading] = useState(false);

  const isAdmin = user?.role === "ADMIN";

  useEffect(() => {
    if (!authChecking && user?.status !== "APPROVED") {
      router.replace("/login");
    }
  }, [authChecking, user?.status, router]);

  useEffect(() => {
    window.localStorage.setItem("darkMode", String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    if (user) {
      queueMicrotask(() => setNicknameDraft(user.nickname));
    }
  }, [user]);

  useEffect(() => {
    if (stockTab === "KR") {
      queueMicrotask(() => {
        setPriceCurrency("KRW");
        if (krSymbols.length > 0 && !krSymbols.some((item) => item.symbol === selectedSymbol)) {
          setSelectedSymbol(krSymbols[0].symbol);
        }
      });
    } else {
      queueMicrotask(() => {
        setPriceCurrency("USD");
        if (usSymbols.length > 0 && !usSymbols.some((item) => item.symbol === selectedSymbol)) {
          setSelectedSymbol(usSymbols[0].symbol);
        }
      });
    }
  }, [stockTab, krSymbols, usSymbols, selectedSymbol]);

  useEffect(() => {
    if (!accessToken || !isAdmin) {
      queueMicrotask(() => setPendingUsers([]));
      return;
    }

    loadPendingUsers(accessToken);
  }, [accessToken, isAdmin]);

  useEffect(() => {
    if (!accessToken || user?.status !== "APPROVED" || !selectedSymbol) {
      return;
    }

    loadStockDetail(selectedSymbol, accessToken);
    loadCandles(selectedSymbol, chartPeriod, accessToken);
    loadRelatedPosts(selectedSymbol, accessToken);
  }, [accessToken, selectedSymbol, chartPeriod, user?.status]);

  const visibleSymbols = useMemo(() => {
    const query = search.trim().toLowerCase();
    const source = usSymbols.length
      ? usSymbols
      : usStocks.map((stock) => ({
          symbol: stock.symbol,
          displaySymbol: stock.symbol,
          description: stock.name ?? stock.symbol,
          type: "Common Stock",
        }));

    if (!query) {
      return source.slice(0, 80);
    }

    return source
      .filter(
        (item) =>
          item.symbol.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query),
      )
      .slice(0, 120);
  }, [search, usStocks, usSymbols]);

  async function loadNews(
    token = accessToken,
    category: NewsCategory = newsCategory,
  ) {
    if (!token) {
      return;
    }

    try {
      const nextNews = await apiRequest<MarketNews[]>(
        `/markets/news?market=${category === "kr" ? "KR" : "US"}`,
        "GET",
        { accessToken: token },
      );
      setNews(nextNews.slice(0, 100));
      setNewsPage(1);
    } catch (newsError) {
      setError(
        newsError instanceof Error ? newsError.message : "Could not load news.",
      );
    }
  }

  async function loadCommunity(
    token = accessToken,
    scope: CommunityScope = communityScope,
    sort: FeedSort = feedSort,
  ) {
    if (!token) {
      return;
    }

    setCommunityLoading(true);
    try {
      const [postsResult, usersResult] = await Promise.all([
        apiRequest<CommunityPost[]>(
          `/community/feed?scope=${scope}&sort=${sort}`,
          "GET",
          { accessToken: token },
        ),
        apiRequest<CommunityUser[]>("/community/users", "GET", {
          accessToken: token,
        }),
      ]);
      setCommunityPosts(postsResult);
      setCommunityUsers(usersResult);
    } catch (communityError) {
      setError(
        communityError instanceof Error
          ? communityError.message
          : "Could not load community.",
      );
    } finally {
      setCommunityLoading(false);
    }
  }

  async function loadRelatedPosts(symbol: string, token = accessToken) {
    if (!token || !symbol) {
      return;
    }
    const posts = await apiRequest<CommunityPost[]>(
      `/community/related?symbol=${encodeURIComponent(symbol)}`,
      "GET",
      { accessToken: token },
    ).catch(() => []);
    setRelatedPosts(posts);
  }

  async function createCommunityPost() {
    const normalizedBlocks = postBlocks.filter((block) =>
      block.type === "image" ? !!block.url : !!block.text?.trim(),
    );
    const plainContent = normalizedBlocks
      .filter((block) => block.type === "text")
      .map((block) =>
        block.text
          ?.replace(/!\[[^\]]*\]\(data:image\/[^)]+\)/g, "[image]")
          .trim(),
      )
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 50000);

    if (
      !accessToken ||
      (!postTitle.trim() && normalizedBlocks.length === 0)
    ) {
      return;
    }

    setCommunityLoading(true);
    try {
      const post = await apiRequest<CommunityPost>(
        editingPostId ? `/community/posts/${editingPostId}` : "/community/posts",
        editingPostId ? "PATCH" : "POST",
        {
        accessToken,
        body: {
          title: postTitle,
          content: plainContent,
          contentBlocks: normalizedBlocks,
          stockTags: postTags,
          imageUrls: normalizedBlocks
            .filter((block) => block.type === "image" && block.url)
            .map((block) => block.url),
        },
      });
      setPostTitle("");
      setPostContent("");
      setPostImages([]);
      setPostBlocks([{ id: makeEditorBlockId(), type: "text", text: "" }]);
      setPostTagQuery("");
      setPostTags([]);
      setEditingPostId(null);
      setCommunityPosts((posts) => [post, ...posts]);
      await loadCommunity(accessToken, communityScope);
      await loadRelatedPosts(selectedSymbol, accessToken);
    } catch (postError) {
      setError(postError instanceof Error ? postError.message : "Could not post.");
    } finally {
      setCommunityLoading(false);
    }
  }

  function editCommunityPost(post: CommunityPost) {
    setEditingPostId(post.id);
    setPostTitle(post.title ?? "");
    setPostBlocks([
      {
        id: makeEditorBlockId(),
        type: "text",
        text: communityBlocksToMarkdown(post),
      },
    ]);
    setPostTags(post.stockTags);
  }

  function resetCommunityEditor() {
    setEditingPostId(null);
    setPostTitle("");
    setPostContent("");
    setPostImages([]);
    setPostBlocks([{ id: makeEditorBlockId(), type: "text", text: "" }]);
    setPostTagQuery("");
    setPostTags([]);
  }

  function openRelatedPost(postId: string) {
    setSelectedCommunityPostId(null);
    window.setTimeout(() => setSelectedCommunityPostId(postId), 0);
    setCommunityScope("all");
    setView("community");
    loadCommunity(accessToken, "all", feedSort);
  }

  function openTaggedStock(tag: StockTag) {
    setStockTab(tag.market);
    setSelectedSymbol(tag.symbol);
    setPriceCurrency(tag.market === "KR" ? "KRW" : "USD");
    setSearch("");
    setView("stocks");
  }

  async function deleteCommunityPost(postId: string) {
    if (!accessToken || !window.confirm("이 게시글을 삭제할까요?")) return;
    await apiRequest<{ ok: true }>(`/community/posts/${postId}`, "DELETE", { accessToken });
    setCommunityPosts((posts) => posts.filter((post) => post.id !== postId));
  }

  async function editCommunityComment(commentId: string, content: string) {
    if (!accessToken) return;
    const next = window.prompt("댓글 수정", content);
    if (!next?.trim()) return;
    const post = await apiRequest<CommunityPost>(`/community/comments/${commentId}`, "PATCH", {
      accessToken,
      body: { content: next },
    });
    setCommunityPosts((posts) => posts.map((item) => item.id === post.id ? post : item));
  }

  async function deleteCommunityComment(commentId: string) {
    if (!accessToken || !window.confirm("이 댓글을 삭제할까요?")) return;
    const post = await apiRequest<CommunityPost>(`/community/comments/${commentId}`, "DELETE", {
      accessToken,
    });
    setCommunityPosts((posts) => posts.map((item) => item.id === post.id ? post : item));
  }

  async function togglePostLike(postId: string) {
    if (!accessToken) {
      return;
    }

    try {
      const result = await apiRequest<{ liked: boolean; likeCount: number }>(
        `/community/posts/${postId}/like`,
        "POST",
        { accessToken },
      );
      setCommunityPosts((posts) =>
        posts.map((post) =>
          post.id === postId
            ? { ...post, likedByMe: result.liked, likeCount: result.likeCount }
            : post,
        ),
      );
    } catch (likeError) {
      setError(likeError instanceof Error ? likeError.message : "Could not like.");
    }
  }

  async function createCommunityComment(postId: string, parentId?: string) {
    if (!accessToken) {
      return;
    }

    const draftKey = parentId ?? postId;
    const content = parentId ? replyDrafts[draftKey] : commentDrafts[draftKey];
    if (!content?.trim()) {
      return;
    }

    try {
      const post = await apiRequest<CommunityPost>(
        `/community/posts/${postId}/comments`,
        "POST",
        {
          accessToken,
          body: { content, parentId },
        },
      );
      setCommunityPosts((posts) =>
        posts.map((item) => (item.id === post.id ? post : item)),
      );
      if (parentId) {
        setReplyDrafts((drafts) => ({ ...drafts, [draftKey]: "" }));
      } else {
        setCommentDrafts((drafts) => ({ ...drafts, [draftKey]: "" }));
      }
    } catch (commentError) {
      setError(
        commentError instanceof Error
          ? commentError.message
          : "Could not comment.",
      );
    }
  }

  async function toggleSubscription(userId: string) {
    if (!accessToken) {
      return;
    }

    try {
      await apiRequest<{ subscribed: boolean }>(
        `/community/users/${userId}/subscribe`,
        "POST",
        { accessToken },
      );
      await loadCommunity(accessToken, communityScope);
    } catch (subscribeError) {
      setError(
        subscribeError instanceof Error
          ? subscribeError.message
          : "Could not update subscription.",
      );
    }
  }

  async function handlePostImages(
    files: FileList | null,
    anchorBlockId?: string,
    position: "before" | "after" = "after",
  ) {
    if (!files) {
      return;
    }

    const selected = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, 8);
    if (selected.length === 0) {
      return;
    }
    const encoded = await Promise.all(
      selected.map((file) => encodeImageForPost(file)),
    );
    const imageBlocks = encoded.map((url) => ({
      id: makeEditorBlockId(),
      type: "image" as const,
      url,
    }));
    setPostBlocks((blocks) => {
      const index = anchorBlockId
        ? blocks.findIndex((block) => block.id === anchorBlockId)
        : blocks.length - 1;
      const insertAt =
        index >= 0 ? index + (position === "after" ? 1 : 0) : blocks.length;
      return [
        ...blocks.slice(0, insertAt),
        ...imageBlocks,
        ...blocks.slice(insertAt),
      ];
    });
  }

  async function loadStockDetail(symbol: string, token = accessToken) {
    if (!token) {
      return;
    }

    try {
      const detail = await apiRequest<StockDetail>(
        `/markets/stocks/detail?symbol=${encodeURIComponent(symbol)}&market=${stockTab === "KR" ? "KR" : "US"}`,
        "GET",
        { accessToken: token },
      );
      setStockDetail(detail);
    } catch (detailError) {
      setError(
        detailError instanceof Error
          ? detailError.message
          : "Could not load stock detail.",
      );
    }
  }

  async function loadCandles(
    symbol: string,
    period: ChartPeriod,
    token = accessToken,
  ) {
    if (!token) {
      return;
    }

    setChartLoading(true);
    try {
      const nextCandles = await apiRequest<CandlePoint[]>(
        `/markets/candles?symbol=${encodeURIComponent(symbol)}&period=${period}&market=${stockTab === "KR" ? "KR" : "US"}`,
        "GET",
        { accessToken: token },
      );
      setCandles(nextCandles);
    } catch (candleError) {
      setError(
        candleError instanceof Error
          ? candleError.message
          : "Could not load chart candles.",
      );
    } finally {
      setChartLoading(false);
    }
  }

  async function loadPendingUsers(token = accessToken) {
    if (!token) {
      return;
    }

    try {
      const users = await apiRequest<User[]>("/users/pending", "GET", {
        accessToken: token,
      });
      setPendingUsers(users);
    } catch (pendingError) {
      setError(
        pendingError instanceof Error
          ? pendingError.message
          : "Could not load pending users.",
      );
    }
  }

  async function updateUserStatus(id: string, status: UserStatus) {
    if (!accessToken) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      await apiRequest<User>(`/users/${id}/status`, "PATCH", {
        accessToken,
        body: { status },
      });
      await loadPendingUsers(accessToken);
    } catch (statusError) {
      setError(
        statusError instanceof Error
          ? statusError.message
          : "Could not update user status.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken) {
      return;
    }

    setProfileLoading(true);
    setProfileError("");
    setProfileMessage("");

    try {
      const updatedUser = await apiRequest<User>("/auth/me", "PATCH", {
        accessToken,
        body: { nickname: nicknameDraft },
      });
      setUser(updatedUser);
      setProfileMessage("Profile updated.");
    } catch (profileUpdateError) {
      setProfileError(
        profileUpdateError instanceof Error
          ? profileUpdateError.message
          : "Could not update profile.",
      );
    } finally {
      setProfileLoading(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) {
      return;
    }
    if (newPassword !== confirmPassword) {
      setProfileError("New passwords do not match.");
      return;
    }

    setProfileLoading(true);
    setProfileError("");
    setProfileMessage("");
    try {
      await apiRequest<{ ok: true }>("/auth/password", "PATCH", {
        accessToken,
        body: { currentPassword, newPassword },
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setProfileMessage("Password changed. Sign in again when this session expires.");
    } catch (passwordError) {
      setProfileError(
        passwordError instanceof Error
          ? passwordError.message
          : "Could not change password.",
      );
    } finally {
      setProfileLoading(false);
    }
  }

  async function logout() {
    // 세션 클리어 → user=null → 리다이렉트 가드가 /login으로 보냄(이 컴포넌트 언마운트되며 로컬 state 초기화).
    await logoutSession();
  }

  // 승인 전(로딩/비로그인/대기/거절)에는 로딩만 보여주고, 가드 effect가 /login으로 보냄.
  if (authChecking || user?.status !== "APPROVED") {
    return (
      <main
        className={`min-h-screen bg-[#f6f7fb] text-[#161a22] ${
          darkMode ? "dark-app" : ""
        }`}
      >
        <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-6 sm:px-8">
          <SessionLoading />
        </section>
      </main>
    );
  }

  return (
    <main
      className={`min-h-screen bg-[#f6f7fb] text-[#161a22] ${
        darkMode ? "dark-app" : ""
      }`}
    >
      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-6 sm:px-8">
        <header className="flex items-center justify-between border-b border-[#d9dee8] pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#607086]">
              Private
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal">
              Investment Community
            </h1>
          </div>
          {user ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setLanguage(language === "en" ? "ko" : "en")}
                className="h-10 rounded-md border border-[#c7ceda] bg-white px-3 text-sm font-semibold text-[#1f6f8b] shadow-sm hover:bg-[#eef1f6]"
              >
                {copy[language].translate}
              </button>
              <button
                onClick={() => setDarkMode((current) => !current)}
                title={darkMode ? "Light mode" : "Dark mode"}
                aria-label={darkMode ? "Light mode" : "Dark mode"}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#c7ceda] bg-white text-[#344052] shadow-sm hover:bg-[#eef1f6]"
              >
                {darkMode ? <Sun size={17} /> : <Moon size={17} />}
              </button>
              <button
                onClick={() => setView("profile")}
                className={`inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-semibold shadow-sm hover:bg-[#eef1f6] ${
                  view === "profile"
                    ? "border-[#1f6f8b] bg-[#eef6f9] text-[#1f6f8b]"
                    : "border-[#c7ceda] bg-white text-[#344052]"
                }`}
              >
                <UserPen size={16} />
                {language === "ko" ? "프로필 수정" : "Profile"}
              </button>
              <button
                onClick={logout}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-[#c7ceda] bg-white px-3 text-sm font-medium shadow-sm hover:bg-[#eef1f6]"
              >
                <LogOut size={16} />
                {copy[language].logout}
              </button>
            </div>
          ) : null}
        </header>

        <>
            {error ? <Notice message="" error={error} /> : null}
            <MarketPulse
              pulse={pulse}
              livePrices={livePrices}
              loading={marketLoading}
              refresh={() => {
                if (accessToken) {
                  loadMarketData(accessToken);
                }
              }}
              language={language}
            />
            <nav className="mt-4 flex gap-2 border-b border-[#d9dee8]">
              {menus
                .filter((menu) => menu.id !== "admin" || isAdmin)
                .map((menu) => (
                  <button
                    key={menu.id}
                    onClick={() => {
                      setView(menu.id);
                      if (menu.id === "news") {
                        loadNews(accessToken, newsCategory);
                      }
                      if (menu.id === "community") {
                        loadCommunity(accessToken, communityScope);
                      }
                    }}
                    className={`h-11 border-b-2 px-3 text-sm font-semibold ${
                      view === menu.id
                        ? "border-[#1f6f8b] text-[#1f6f8b]"
                        : "border-transparent text-[#607086]"
                    }`}
                  >
                    {copy[language][menu.id as keyof (typeof copy)["en"]] ??
                      menu.label}
                  </button>
                ))}
            </nav>
            {view === "profile" ? (
              <div className="flex-1 py-6">
                <ProfilePanel
                  user={user}
                  nicknameDraft={nicknameDraft}
                  setNicknameDraft={setNicknameDraft}
                  loading={profileLoading}
                  message={profileMessage}
                  error={profileError}
                  onSubmit={updateProfile}
                  currentPassword={currentPassword}
                  setCurrentPassword={setCurrentPassword}
                  newPassword={newPassword}
                  setNewPassword={setNewPassword}
                  confirmPassword={confirmPassword}
                  setConfirmPassword={setConfirmPassword}
                  onPasswordSubmit={changePassword}
                  onBack={() => setView("stocks")}
                />
              </div>
            ) : (
              <div className="grid flex-1 gap-6 py-6 lg:grid-cols-[1fr]">
                {view === "stocks" ? (
                  <StocksView
                    stockTab={stockTab}
                    setStockTab={setStockTab}
                    visibleSymbols={visibleSymbols}
                    usStocks={usStocks}
                    krStocks={krStocks}
                    krSymbols={krSymbols}
                    selectedSymbol={selectedSymbol}
                    setSelectedSymbol={setSelectedSymbol}
                    stockDetail={stockDetail}
                    livePrices={livePrices}
                    liveSeries={liveSeries}
                    candles={candles}
                    chartPeriod={chartPeriod}
                    setChartPeriod={setChartPeriod}
                    chartLoading={chartLoading}
                    language={language}
                    search={search}
                    setSearch={setSearch}
                    priceCurrency={priceCurrency}
                    setPriceCurrency={setPriceCurrency}
                    relatedPosts={relatedPosts}
                    onRelatedPostClick={openRelatedPost}
                  />
                ) : view === "community" ? (
                  <CommunityView
                    posts={communityPosts}
                    users={communityUsers}
                    scope={communityScope}
                    sort={feedSort}
                    setSort={(sort) => {
                      setFeedSort(sort);
                      loadCommunity(accessToken, communityScope, sort);
                    }}
                    setScope={(scope) => {
                      setCommunityScope(scope);
                      loadCommunity(accessToken, scope);
                    }}
                    postTitle={postTitle}
                    setPostTitle={setPostTitle}
                    postContent={postContent}
                    setPostContent={setPostContent}
                    postBlocks={postBlocks}
                    setPostBlocks={setPostBlocks}
                    postImages={postImages}
                    setPostImages={setPostImages}
                    postTagQuery={postTagQuery}
                    setPostTagQuery={setPostTagQuery}
                    postTags={postTags}
                    setPostTags={setPostTags}
                    stockSymbols={[...krSymbols, ...usSymbols]}
                    onImages={handlePostImages}
                    onPost={createCommunityPost}
                    editingPostId={editingPostId}
                    onEditPost={editCommunityPost}
                    onDeletePost={deleteCommunityPost}
                    onEditComment={editCommunityComment}
                    onDeleteComment={deleteCommunityComment}
                    currentUserId={user.id}
                    onStockTagClick={openTaggedStock}
                    initialDetailPostId={selectedCommunityPostId}
                    onResetEditor={resetCommunityEditor}
                    onLike={togglePostLike}
                    commentDrafts={commentDrafts}
                    setCommentDrafts={setCommentDrafts}
                    replyDrafts={replyDrafts}
                    setReplyDrafts={setReplyDrafts}
                    onComment={createCommunityComment}
                    onSubscribe={toggleSubscription}
                    loading={communityLoading}
                    usStocks={usStocks}
                    krStocks={krStocks}
                    livePrices={livePrices}
                  />
                ) : view === "admin" ? (
                  <AdminPanel
                    pendingUsers={pendingUsers}
                    loading={loading}
                    updateUserStatus={updateUserStatus}
                  />
                ) : (
                  <NewsOrPlaceholder
                    view={view}
                    news={news}
                    language={language}
                    page={newsPage}
                    setPage={setNewsPage}
                    category={newsCategory}
                    setCategory={(category) => {
                      setNewsCategory(category);
                      loadNews(accessToken, category);
                    }}
                  />
                )}
              </div>
            )}
          </>
      </section>
    </main>
  );
}

function MarketPulse({
  pulse,
  livePrices,
  loading,
  refresh,
  language,
}: {
  pulse: MarketQuote[];
  livePrices: Record<string, TradeTick>;
  loading: boolean;
  refresh: () => void;
  language: Language;
}) {
  return (
    <section className="mt-5 rounded-lg border border-[#d9dee8] bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#344052]">
          {copy[language].marketPulse}
        </h2>
        <button
          onClick={refresh}
          className="inline-flex h-8 items-center gap-2 rounded-md border border-[#c7ceda] px-2.5 text-xs font-medium hover:bg-[#eef1f6]"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          {copy[language].refresh}
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        {pulse.map((item) => {
          const live = livePrices[item.symbol];
          const current = live?.price ?? item.current;
          return (
            <QuoteCard
              key={item.symbol}
              quote={{ ...item, current }}
              compact
              live={!!live}
            />
          );
        })}
      </div>
    </section>
  );
}

function ProfilePanel({
  user,
  nicknameDraft,
  setNicknameDraft,
  loading,
  message,
  error,
  onSubmit,
  currentPassword,
  setCurrentPassword,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  onPasswordSubmit,
  onBack,
}: {
  user: User;
  nicknameDraft: string;
  setNicknameDraft: (value: string) => void;
  loading: boolean;
  message: string;
  error: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  currentPassword: string;
  setCurrentPassword: (value: string) => void;
  newPassword: string;
  setNewPassword: (value: string) => void;
  confirmPassword: string;
  setConfirmPassword: (value: string) => void;
  onPasswordSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onBack: () => void;
}) {
  return (
    <section className="rounded-lg border border-[#d9dee8] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#607086]">
            Profile
          </p>
          <h2 className="mt-1 text-xl font-semibold">Edit profile</h2>
        </div>
        <button
          onClick={onBack}
          className="rounded-md border border-[#c7ceda] bg-white px-3 py-2 text-sm font-semibold text-[#344052] hover:bg-[#eef1f6]"
        >
          Back
        </button>
      </div>

      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-[#344052]">Nickname</span>
          <input
            value={nicknameDraft}
            onChange={(event) => setNicknameDraft(event.target.value)}
            type="text"
            minLength={2}
            maxLength={24}
            required
            className="mt-1 h-11 w-full rounded-md border border-[#c7ceda] px-3 outline-none focus:border-[#1f6f8b]"
          />
        </label>

        <div className="grid gap-3 md:grid-cols-2">
          <InfoBox label="Email" value={user.email} />
          <InfoBox label="Role" value={user.role} />
          <InfoBox label="Status" value={statusLabel[user.status]} />
          <InfoBox
            label="Joined"
            value={new Date(user.createdAt).toLocaleDateString()}
          />
        </div>

        <button
          disabled={loading}
          className="inline-flex h-11 items-center gap-2 rounded-md bg-[#1f6f8b] px-4 text-sm font-semibold text-white hover:bg-[#195b72] disabled:opacity-60"
        >
          <UserPen size={16} />
          {loading ? "Saving" : "Save profile"}
        </button>
      </form>

      <form
        onSubmit={onPasswordSubmit}
        className="mt-6 space-y-4 border-t border-[#eef1f6] pt-5"
      >
        <h3 className="text-base font-semibold">Change password</h3>
        <TextInput
          label="Current password"
          value={currentPassword}
          setValue={setCurrentPassword}
          type="password"
          minLength={8}
        />
        <TextInput
          label="New password"
          value={newPassword}
          setValue={setNewPassword}
          type="password"
          minLength={8}
        />
        <TextInput
          label="Confirm new password"
          value={confirmPassword}
          setValue={setConfirmPassword}
          type="password"
          minLength={8}
        />
        <button
          disabled={loading}
          className="inline-flex h-11 items-center rounded-md bg-[#1f6f8b] px-4 text-sm font-semibold text-white hover:bg-[#195b72] disabled:opacity-60"
        >
          {loading ? "Saving" : "Change password"}
        </button>
      </form>

      <Notice message={message} error={error} />
    </section>
  );
}

function StocksView({
  stockTab,
  setStockTab,
  visibleSymbols,
  usStocks,
  krStocks,
  krSymbols,
  selectedSymbol,
  setSelectedSymbol,
  stockDetail,
  livePrices,
  liveSeries,
  candles,
  chartPeriod,
  setChartPeriod,
  chartLoading,
  search,
  setSearch,
  language,
  priceCurrency,
  setPriceCurrency,
  relatedPosts,
  onRelatedPostClick,
}: {
  stockTab: StockTab;
  setStockTab: (tab: StockTab) => void;
  visibleSymbols: StockSymbol[];
  usStocks: MarketQuote[];
  krStocks: MarketQuote[];
  krSymbols: StockSymbol[];
  selectedSymbol: string;
  setSelectedSymbol: (symbol: string) => void;
  stockDetail: StockDetail | null;
  livePrices: Record<string, TradeTick>;
  liveSeries: Record<string, TradeTick[]>;
  candles: CandlePoint[];
  chartPeriod: ChartPeriod;
  setChartPeriod: (period: ChartPeriod) => void;
  chartLoading: boolean;
  search: string;
  setSearch: (value: string) => void;
  language: Language;
  priceCurrency: DisplayCurrency;
  setPriceCurrency: (currency: DisplayCurrency) => void;
  relatedPosts: CommunityPost[];
  onRelatedPostClick: (postId: string) => void;
}) {
  return (
    <section className="rounded-lg border border-[#d9dee8] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-[#eef1f6] pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">{copy[language].stockList}</h2>
          <p className="mt-1 text-sm text-[#607086]">
            {copy[language].stockHint}
          </p>
        </div>
        <div className="grid grid-cols-2 rounded-md border border-[#d4dae5] bg-[#f3f5f9] p-1">
          <button
            onClick={() => {
              setStockTab("KR");
              setSelectedSymbol("005930");
              setPriceCurrency("KRW");
              setSearch("");
            }}
            className={`h-9 rounded px-3 text-sm font-semibold ${
              stockTab === "KR" ? "bg-white shadow-sm" : "text-[#607086]"
            }`}
          >
            {copy[language].korea}
          </button>
          <button
            onClick={() => {
              setStockTab("US");
              setSelectedSymbol("AAPL");
              setPriceCurrency("USD");
              setSearch("");
            }}
            className={`h-9 rounded px-3 text-sm font-semibold ${
              stockTab === "US" ? "bg-white shadow-sm" : "text-[#607086]"
            }`}
          >
            {copy[language].us}
          </button>
        </div>
      </div>

      {stockTab === "KR" ? (
        <div className="mt-5 grid gap-5 xl:grid-cols-[360px_1fr]">
          <div>
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#607086]"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={copy[language].search}
                className="h-10 w-full rounded-md border border-[#c7ceda] pl-9 pr-3 text-sm outline-none focus:border-[#1f6f8b]"
              />
            </div>
            <div className="mt-3 max-h-[560px] overflow-auto rounded-md border border-[#d9dee8]">
              {krSymbols
                .filter((item) => {
                  const query = search.trim().toLowerCase();
                  if (!query) {
                    return true;
                  }
                  return (
                    item.symbol.toLowerCase().includes(query) ||
                    item.description.toLowerCase().includes(query)
                  );
                })
                .map((item) => {
                  const quote = krStocks.find((stock) => stock.symbol === item.symbol);
                  return (
                    <button
                      key={item.symbol}
                      onClick={() => setSelectedSymbol(item.symbol)}
                      className={`block w-full border-b border-[#eef1f6] px-3 py-3 text-left last:border-b-0 hover:bg-[#f6f8fb] ${
                        selectedSymbol === item.symbol ? "bg-[#eef6f8]" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold">{item.description}</p>
                          <p className="truncate text-xs text-[#607086]">{item.symbol}</p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold">
                          {quote ? formatMoney(quote.current, "KRW", quote.currency) : ""}
                        </p>
                      </div>
                    </button>
                  );
                })}
            </div>
            <RelatedPosts posts={relatedPosts} onPostClick={onRelatedPostClick} />
          </div>
          <StockDetailPanel
            detail={stockDetail}
            live={livePrices[selectedSymbol]}
            series={liveSeries[selectedSymbol] ?? []}
            candles={candles}
            chartPeriod={chartPeriod}
            setChartPeriod={setChartPeriod}
            chartLoading={chartLoading}
            language={language}
            priceCurrency="KRW"
            setPriceCurrency={setPriceCurrency}
          />
        </div>
      ) : (
        <div className="mt-5 grid gap-5 xl:grid-cols-[360px_1fr]">
          <div>
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#607086]"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={copy[language].search}
                className="h-10 w-full rounded-md border border-[#c7ceda] pl-9 pr-3 text-sm outline-none focus:border-[#1f6f8b]"
              />
            </div>
            <div className="mt-3 max-h-[560px] overflow-auto rounded-md border border-[#d9dee8]">
              {visibleSymbols.map((item) => {
                const quote = usStocks.find((stock) => stock.symbol === item.symbol);
                const live = livePrices[item.symbol];
                return (
                  <button
                    key={item.symbol}
                    onClick={() => setSelectedSymbol(item.symbol)}
                    className={`block w-full border-b border-[#eef1f6] px-3 py-3 text-left last:border-b-0 hover:bg-[#f6f8fb] ${
                      selectedSymbol === item.symbol ? "bg-[#eef6f8]" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold">{item.symbol}</p>
                        <p className="truncate text-xs text-[#607086]">
                          {item.description}
                        </p>
                      </div>
                        <p className="shrink-0 text-sm font-semibold">
                          {live
                            ? formatMoney(
                                live.price,
                                priceCurrency,
                                item.currency === "KRW" ? "KRW" : "USD",
                              )
                            : quote
                              ? formatMoney(
                                  quote.current,
                                  priceCurrency,
                                  quote.currency ?? "USD",
                                )
                              : ""}
                        </p>
                    </div>
                  </button>
                );
              })}
            </div>
            <RelatedPosts posts={relatedPosts} onPostClick={onRelatedPostClick} />
          </div>
          <StockDetailPanel
            detail={stockDetail}
            live={livePrices[selectedSymbol]}
            series={liveSeries[selectedSymbol] ?? []}
            candles={candles}
            chartPeriod={chartPeriod}
            setChartPeriod={setChartPeriod}
            chartLoading={chartLoading}
            language={language}
            priceCurrency={priceCurrency}
            setPriceCurrency={setPriceCurrency}
          />
        </div>
      )}
    </section>
  );
}

function StockDetailPanel({
  detail,
  live,
  series,
  candles,
  chartPeriod,
  setChartPeriod,
  chartLoading,
  language,
  priceCurrency,
  setPriceCurrency,
}: {
  detail: StockDetail | null;
  live?: TradeTick;
  series: TradeTick[];
  candles: CandlePoint[];
  chartPeriod: ChartPeriod;
  setChartPeriod: (period: ChartPeriod) => void;
  chartLoading: boolean;
  language: Language;
  priceCurrency: DisplayCurrency;
  setPriceCurrency: (currency: DisplayCurrency) => void;
}) {
  if (!detail) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-md border border-[#d9dee8] text-sm text-[#607086]">
        Select a stock.
      </div>
    );
  }

  const quote = live
    ? { ...detail.quote, current: live.price, timestamp: Math.floor(live.timestamp / 1000) }
    : detail.quote;
    const detailSourceCurrency = detail.profile.currency === "KRW" ? "KRW" : (detail.quote.currency ?? "USD");
    const displayMarketCap = detail.profile.marketCapitalization
    ? formatMarketCap(detail.profile.marketCapitalization, priceCurrency, detailSourceCurrency)
      : "-";
    const metricItems = buildMetricItems(detail.metrics, language, priceCurrency, detailSourceCurrency);
    const isKoreanMarket =
      detail.profile.currency === "KRW" && detail.profile.country === "대한민국";
    const valuationItems = [
    {
      label: translateDetailLabel(language, "marketCap"),
      value: displayMarketCap,
    },
    ...metricItems,
  ];

  return (
    <div className="rounded-md border border-[#d9dee8] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-[#607086]">{detail.profile.exchange}</p>
          <h3 className="mt-1 text-2xl font-semibold">
            {detail.profile.name || detail.symbol}
          </h3>
          <p className="mt-1 text-sm text-[#607086]">
            {detail.symbol} · {detail.profile.finnhubIndustry || "Unknown sector"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isKoreanMarket ? (
            <button
              onClick={() =>
                setPriceCurrency(priceCurrency === "USD" ? "KRW" : "USD")
              }
              className="h-10 rounded-md border border-[#c7ceda] bg-white px-3 text-sm font-semibold text-[#344052] hover:bg-[#eef1f6]"
            >
              {priceCurrency === "USD" ? "원" : "$"}
            </button>
          ) : null}
          {detail.profile.logo ? (
            <img
              src={detail.profile.logo}
              alt=""
              className="h-12 w-12 rounded-md border border-[#d9dee8] object-contain"
            />
          ) : null}
        </div>
      </div>
      <div className="mt-6">
        <QuoteCard quote={quote} live={!!live} displayCurrency={priceCurrency} />
      </div>
      <div className="mt-5 rounded-md border border-[#d9dee8] bg-[#f9fafc] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-[#344052]">
            {translateDetailLabel(language, "realtimeChart")}
          </p>
          <div className="flex flex-wrap gap-1">
            {chartPeriods.map((period) => (
              <button
                key={period}
                onClick={() => setChartPeriod(period)}
                className={`h-8 rounded-md px-2.5 text-xs font-semibold ${
                  chartPeriod === period
                    ? "bg-[#1f6f8b] text-white"
                    : "border border-[#c7ceda] bg-white text-[#344052]"
                }`}
              >
                {period}
              </button>
            ))}
          </div>
        </div>
        <>
          <RealtimeChart
            candles={candles}
            live={live}
            loading={chartLoading}
            period={chartPeriod}
          />
          <p className="mt-2 text-xs text-[#607086]">
            {series.length
              ? `${series.length} live ticks received`
              : "Live ticks update the last candle when available."}
          </p>
        </>
      </div>
      <div className="mt-5 rounded-md border border-[#d9dee8] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#344052]">
              {translateDetailLabel(language, "companyOverview")}
            </p>
            <p className="mt-1 text-xs text-[#607086]">
              {translateDetailLabel(language, "source")}: {detail.overview.source}
              {detail.overview.fetchedAt
                ? ` · ${new Date(detail.overview.fetchedAt).toLocaleDateString()}`
                : ""}
            </p>
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-[#344052]">
          {language === "en" ? detail.overview.en : detail.overview.ko}
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <InfoBox
            label={translateDetailLabel(language, "country")}
            value={detail.profile.country || "-"}
          />
          <InfoBox
            label={translateDetailLabel(language, "ipo")}
            value={detail.profile.ipo || "-"}
          />
          <InfoBox
            label={translateDetailLabel(language, "website")}
            value={detail.profile.weburl || "-"}
          />
          <InfoBox
            label={translateDetailLabel(language, "sharesOutstanding")}
            value={
              detail.profile.shareOutstanding
                ? `${formatNumber(detail.profile.shareOutstanding)}M`
                : "-"
            }
          />
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
            <InfoBox
              label={translateDetailLabel(language, "open")}
              value={formatMoney(quote.open, priceCurrency, quote.currency)}
            />
            <InfoBox
              label={translateDetailLabel(language, "previousClose")}
              value={formatMoney(quote.previousClose, priceCurrency, quote.currency)}
            />
        </div>
      </div>
      <div className="mt-5 rounded-md border border-[#d9dee8] p-4">
        <p className="text-sm font-semibold text-[#344052]">
          {translateDetailLabel(language, "metrics")}
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {valuationItems.map((item) => (
            <InfoBox key={item.label} label={item.label} value={item.value} />
          ))}
        </div>
      </div>
    </div>
  );
}

function RealtimeChart({
  candles,
  live,
  loading,
  period,
}: {
  candles: CandlePoint[];
  live?: TradeTick;
  loading: boolean;
  period: ChartPeriod;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    if (!containerRef.current || chartRef.current) {
      return;
    }

    const chart = createChart(containerRef.current, {
      height: 220,
      layout: {
        background: { color: "#f9fafc" },
        textColor: "#344052",
      },
      grid: {
        vertLines: { color: "#edf0f5" },
        horzLines: { color: "#edf0f5" },
      },
      rightPriceScale: {
        borderColor: "#d9dee8",
      },
      timeScale: {
        borderColor: "#d9dee8",
        timeVisible: period === "1D",
        secondsVisible: false,
      },
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#2e7d4f",
      downColor: "#b64242",
      borderVisible: false,
      wickUpColor: "#2e7d4f",
      wickDownColor: "#b64242",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const resize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };

    resize();
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current) {
      return;
    }

    const data: CandlestickData<Time>[] = [...candles]
      .sort((a, b) => a.time - b.time)
      .map((candle) => ({
      time: toChartTime(candle.time, period),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    }));
    seriesRef.current.setData(data);
    chartRef.current?.timeScale().fitContent();
    chartRef.current?.applyOptions({
      timeScale: {
        timeVisible: period === "1D",
        secondsVisible: false,
      },
    });
  }, [candles, period]);

  useEffect(() => {
    if (!seriesRef.current || !live || candles.length === 0) {
      return;
    }

    const last = candles[candles.length - 1];
    const price = live.price;
    seriesRef.current.update({
      time: toChartTime(last.time, period),
      open: last.open,
      high: Math.max(last.high, price),
      low: Math.min(last.low, price),
      close: price,
    });
  }, [candles, live, period]);

  return (
    <div className="relative mt-3">
      {loading ? (
        <div className="absolute right-3 top-3 z-10 rounded-md bg-white/90 px-2 py-1 text-xs font-semibold text-[#607086]">
          Loading
        </div>
      ) : null}
      <div ref={containerRef} className="h-[260px] w-full" />
    </div>
  );
}

function toChartTime(timestamp: number, period: ChartPeriod): Time {
  if (period === "1D") {
    return timestamp as Time;
  }

  const date = new Date(timestamp * 1000);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  } as BusinessDay;
}

async function encodeImageForPost(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = reject;
    element.src = dataUrl;
  });
  const maxSize = 1400;
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");

  if (!context) {
    return dataUrl;
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

function QuoteCard({
  quote,
  compact = false,
  live = false,
  displayCurrency = "USD",
}: {
  quote: MarketQuote;
  compact?: boolean;
  live?: boolean;
  displayCurrency?: DisplayCurrency;
}) {
  const positive = quote.change >= 0;
  const isIndex = quote.symbol.startsWith("KIS_INDEX:");
  const currentText = isIndex
    ? formatNumber(quote.current)
    : formatMoney(quote.current, displayCurrency, quote.currency);
  const changeText = isIndex
    ? formatNumber(quote.change)
    : formatMoney(quote.change, displayCurrency, quote.currency);
  return (
    <div className="rounded-md border border-[#d9dee8] bg-[#f9fafc] p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold">{quote.name || quote.symbol}</p>
          <p className="text-xs text-[#607086]">{quote.symbol}</p>
        </div>
        {positive ? (
          <TrendingUp size={18} className="text-[#2e7d4f]" />
        ) : (
          <TrendingDown size={18} className="text-[#b64242]" />
        )}
      </div>
      <p className={compact ? "mt-2 text-xl font-semibold" : "mt-3 text-3xl font-semibold"}>
        {currentText}
      </p>
      <p
        className={`mt-1 text-sm font-medium ${
          positive ? "text-[#2e7d4f]" : "text-[#b64242]"
        }`}
      >
        {positive ? "+" : ""}
        {changeText} ({positive ? "+" : ""}
        {formatNumber(quote.percentChange)}%)
      </p>
      {live ? (
        <p className="mt-2 text-xs font-medium text-[#1f6f8b]">Live tick</p>
      ) : null}
    </div>
  );
}

function AdminPanel({
  pendingUsers,
  loading,
  updateUserStatus,
}: {
  pendingUsers: User[];
  loading: boolean;
  updateUserStatus: (id: string, status: UserStatus) => Promise<void>;
}) {
  return (
    <section className="rounded-lg border border-[#d9dee8] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Access approvals</h2>
        <span className="rounded-md bg-[#eef3f8] px-2.5 py-1 text-xs font-semibold text-[#344052]">
          {pendingUsers.length}
        </span>
      </div>
      <div className="mt-4 overflow-hidden rounded-md border border-[#d9dee8]">
        {pendingUsers.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-[#607086]">
            No pending accounts.
          </div>
        ) : (
          pendingUsers.map((pendingUser) => (
            <div
              key={pendingUser.id}
              className="flex flex-col gap-3 border-b border-[#eef1f6] px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium">{pendingUser.nickname}</p>
                <p className="text-sm text-[#607086]">{pendingUser.email}</p>
              </div>
              <div className="flex gap-2">
                <button
                  disabled={loading}
                  onClick={() => updateUserStatus(pendingUser.id, "APPROVED")}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#2e7d4f] px-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  <Check size={15} />
                  Approve
                </button>
                <button
                  disabled={loading}
                  onClick={() => updateUserStatus(pendingUser.id, "REJECTED")}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#d3a1a1] bg-white px-3 text-sm font-semibold text-[#9a2f2f] disabled:opacity-60"
                >
                  <X size={15} />
                  Reject
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function RelatedPosts({
  posts,
  onPostClick,
}: {
  posts: CommunityPost[];
  onPostClick: (postId: string) => void;
}) {
  return (
    <div className="mt-3 rounded-md border border-[#d9dee8] bg-[#f9fafc] p-3">
      <p className="text-xs font-semibold text-[#344052]">이 종목과 관련된 피드</p>
      <div className="mt-2 space-y-2">
        {posts.length ? (
          posts.slice(0, 3).map((post) => (
            <button
              key={post.id}
              onClick={() => onPostClick(post.id)}
              className="block w-full cursor-pointer border-t border-[#eef1f6] pt-2 text-left first:border-0 first:pt-0"
            >
              <div className="flex items-baseline gap-2">
                <p className="max-w-[45%] truncate text-sm font-semibold">
                  {post.title || post.content}
                </p>
                <p className="min-w-0 flex-1 truncate text-[11px] text-[#607086]">
                  {post.contentBlocks.find((block) => block.type === "text")?.text || post.content}
                </p>
              </div>
              <p className="mt-0.5 text-xs text-[#607086]">
                {post.author.nickname} · {new Date(post.createdAt).toLocaleDateString()}
              </p>
            </button>
          ))
        ) : (
          <p className="text-xs text-[#607086]">아직 관련 게시글이 없습니다.</p>
        )}
      </div>
    </div>
  );
}

function CommunityView({
  posts,
  users,
  scope,
  setScope,
  sort,
  setSort,
  postTitle,
  setPostTitle,
  postContent,
  setPostContent,
  postBlocks,
  setPostBlocks,
  postImages,
  setPostImages,
  postTagQuery,
  setPostTagQuery,
  postTags,
  setPostTags,
  stockSymbols,
  onImages,
  onPost,
  editingPostId,
  onEditPost,
  onDeletePost,
  onEditComment,
  onDeleteComment,
  currentUserId,
  onStockTagClick,
  initialDetailPostId,
  onResetEditor,
  onLike,
  commentDrafts,
  setCommentDrafts,
  replyDrafts,
  setReplyDrafts,
  onComment,
  onSubscribe,
  loading,
  usStocks,
  krStocks,
  livePrices,
}: {
  posts: CommunityPost[];
  users: CommunityUser[];
  scope: CommunityScope;
  setScope: (scope: CommunityScope) => void;
  sort: FeedSort;
  setSort: (sort: FeedSort) => void;
  postTitle: string;
  setPostTitle: (value: string) => void;
  postContent: string;
  setPostContent: (value: string) => void;
  postBlocks: CommunityContentBlock[];
  setPostBlocks: Dispatch<SetStateAction<CommunityContentBlock[]>>;
  postImages: string[];
  setPostImages: (value: string[]) => void;
  postTagQuery: string;
  setPostTagQuery: (value: string) => void;
  postTags: StockTag[];
  setPostTags: Dispatch<SetStateAction<StockTag[]>>;
  stockSymbols: StockSymbol[];
  onImages: (
    files: FileList | null,
    anchorBlockId?: string,
    position?: "before" | "after",
  ) => void;
  onPost: () => Promise<void>;
  editingPostId: string | null;
  onEditPost: (post: CommunityPost) => void;
  onDeletePost: (postId: string) => void;
  onEditComment: (commentId: string, content: string) => void;
  onDeleteComment: (commentId: string) => void;
  currentUserId: string;
  onStockTagClick: (tag: StockTag) => void;
  initialDetailPostId: string | null;
  onResetEditor: () => void;
  onLike: (postId: string) => void;
  commentDrafts: Record<string, string>;
  setCommentDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  replyDrafts: Record<string, string>;
  setReplyDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  onComment: (postId: string, parentId?: string) => void;
  onSubscribe: (userId: string) => void;
  loading: boolean;
  usStocks: MarketQuote[];
  krStocks: MarketQuote[];
  livePrices: Record<string, TradeTick>;
}) {
  const [expandedPosts, setExpandedPosts] = useState<Record<string, boolean>>({});
  const [editorOpen, setEditorOpen] = useState(false);
  const [detailPostId, setDetailPostId] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<"write" | "preview">("write");
  const scopeOptions: Array<{ id: CommunityScope; label: string }> = [
    { id: "all", label: "전체 피드" },
    { id: "subscribed", label: "구독 피드" },
    { id: "mine", label: "내 피드" },
  ];

  useEffect(() => {
    if (initialDetailPostId) {
      queueMicrotask(() => {
        setDetailPostId(initialDetailPostId);
        setEditorOpen(false);
      });
    }
  }, [initialDetailPostId]);

  function insertTextBlock(blockId: string, position: "before" | "after") {
    setPostBlocks((blocks) => {
      const index = blocks.findIndex((block) => block.id === blockId);
      const insertAt = index + (position === "after" ? 1 : 0);
      return [
        ...blocks.slice(0, insertAt),
        { id: makeEditorBlockId(), type: "text", text: "" },
        ...blocks.slice(insertAt),
      ];
    });
  }

  function moveEditorBlock(blockId: string, direction: -1 | 1) {
    setPostBlocks((blocks) => {
      const index = blocks.findIndex((block) => block.id === blockId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= blocks.length) return blocks;
      const next = [...blocks];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function getTagQuote(tag: StockTag) {
    const quote = (tag.market === "KR" ? krStocks : usStocks).find(
      (item) => item.symbol === tag.symbol,
    );
    const live = livePrices[tag.symbol];
    return quote
      ? { ...quote, current: live?.price ?? quote.current }
      : null;
  }

  const markdownText =
    postBlocks.find((block) => block.type === "text")?.text ?? "";

  function setMarkdownText(text: string) {
    setPostBlocks([{ id: postBlocks[0]?.id ?? makeEditorBlockId(), type: "text", text }]);
  }

  async function insertMarkdownImages(files: FileList | null) {
    if (!files) return;
    const selected = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, 8);
    const urls = await Promise.all(selected.map((file) => encodeImageForPost(file)));
    const markdown = urls.map((url) => `![image](${url})`).join("\n\n");
    setMarkdownText(`${markdownText}${markdownText ? "\n\n" : ""}${markdown}`);
  }

  return (
    <section className={detailPostId ? "w-full" : "grid gap-5 lg:grid-cols-[1fr_320px]"}>
      <div className="space-y-4">
        {!editorOpen ? (
          <div className="flex items-center gap-3">
            {detailPostId ? (
              <button
                onClick={() => setDetailPostId(null)}
                className="inline-flex h-10 w-36 items-center justify-center rounded-md border border-[#c7ceda] bg-white px-4 text-sm font-semibold"
              >
                피드 목록으로
              </button>
            ) : null}
            <button
              onClick={() => {
                onResetEditor();
                setEditorOpen(true);
              }}
              className="inline-flex h-10 w-36 items-center justify-center gap-2 rounded-md bg-[#1f6f8b] px-4 text-sm font-semibold text-white"
            >
              <Plus size={17} />
              피드 글 쓰기
            </button>
          </div>
        ) : (
        <div className="rounded-lg border border-[#d9dee8] bg-white p-5 shadow-sm">
          <div className="border-b border-[#eef1f6] pb-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[#344052]">
                {editingPostId ? "피드 수정" : "투자 글쓰기"}
              </p>
              <button
                onClick={() => {
                  onResetEditor();
                  setEditorOpen(false);
                }}
                className="grid h-8 w-8 place-items-center rounded-md border border-[#c7ceda]"
                title="닫기"
              >
                <X size={15} />
              </button>
            </div>
            <input
              value={postTitle}
              onChange={(event) => setPostTitle(event.target.value)}
              placeholder="제목: 예) 엔비디아 실적 이후 반도체 사이클 점검"
              className="mt-3 h-12 w-full rounded-md border border-[#c7ceda] px-3 text-lg font-semibold outline-none focus:border-[#1f6f8b]"
            />
          </div>
          <div className="mt-4 overflow-hidden rounded-md border border-[#d9dee8] bg-white">
            <div className="flex items-center justify-between border-b border-[#d9dee8] bg-[#f9fafc] p-2">
              <div className="grid grid-cols-2 rounded-md border border-[#c7ceda] bg-white p-1">
                {(["write", "preview"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setEditorMode(mode)}
                    className={`h-8 rounded px-3 text-xs font-semibold ${
                      editorMode === mode ? "bg-[#1f6f8b] text-white" : "text-[#607086]"
                    }`}
                  >
                    {mode === "write" ? "Markdown 작성" : "미리보기"}
                  </button>
                ))}
              </div>
              <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-[#c7ceda] bg-white px-3 text-sm font-semibold">
                <ImageIcon size={15} />
                사진 삽입
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    insertMarkdownImages(event.target.files);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
            </div>
            {editorMode === "write" ? (
              <textarea
                value={markdownText}
                onChange={(event) => setMarkdownText(event.target.value)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  insertMarkdownImages(event.dataTransfer.files);
                }}
                placeholder={"# 제목\n\n자유롭게 글을 작성하세요.\n\n## 투자 근거\n- 항목 1\n- 항목 2\n\n사진은 위의 사진 삽입 버튼이나 드래그로 추가할 수 있습니다."}
                className="min-h-[720px] w-full resize-y bg-white p-6 font-mono text-sm leading-7 text-[#344052] outline-none"
              />
            ) : (
              <div className="min-h-[720px] bg-white p-8">
                <MarkdownContent markdown={markdownText} />
              </div>
            )}
          </div>
          <div
            className="hidden"
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
            }}
            onDrop={(event) => {
              event.preventDefault();
              onImages(event.dataTransfer.files);
            }}
          >
            <div className="sticky top-2 z-10 flex flex-wrap gap-2 rounded-md border border-[#d9dee8] bg-white p-2 shadow-sm">
              <button
                onClick={() =>
                  setPostBlocks((blocks) => [
                    ...blocks,
                    { id: makeEditorBlockId(), type: "text", text: "" },
                  ])
                }
                className="h-9 rounded-md border border-[#c7ceda] px-3 text-sm font-semibold"
              >
                글 추가
              </button>
              <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-[#c7ceda] px-3 text-sm font-semibold">
                <ImageIcon size={15} />
                사진 추가
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    onImages(event.target.files);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
            </div>
            {postBlocks.map((block, index) =>
              block.type === "image" ? (
                <div key={block.id} className="rounded-md border border-[#d9dee8] bg-white p-3">
                  <img
                    src={block.url}
                    alt=""
                    className="max-h-[520px] w-full rounded-md object-contain"
                  />
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-[#eef1f6] pt-3">
                    <button onClick={() => insertTextBlock(block.id, "before")} className="h-8 rounded-md border border-[#c7ceda] px-2.5 text-xs font-semibold">위에 글</button>
                    <button onClick={() => insertTextBlock(block.id, "after")} className="h-8 rounded-md border border-[#c7ceda] px-2.5 text-xs font-semibold">아래에 글</button>
                    <label className="inline-flex h-8 cursor-pointer items-center rounded-md border border-[#c7ceda] px-2.5 text-xs font-semibold">
                      위에 사진
                      <input type="file" accept="image/*" multiple className="hidden" onChange={(event) => { onImages(event.target.files, block.id, "before"); event.currentTarget.value = ""; }} />
                    </label>
                    <label className="inline-flex h-8 cursor-pointer items-center rounded-md border border-[#c7ceda] px-2.5 text-xs font-semibold">
                      아래에 사진
                      <input type="file" accept="image/*" multiple className="hidden" onChange={(event) => { onImages(event.target.files, block.id, "after"); event.currentTarget.value = ""; }} />
                    </label>
                    <button disabled={index === 0} onClick={() => moveEditorBlock(block.id, -1)} className="h-8 rounded-md border border-[#c7ceda] px-2.5 text-xs font-semibold disabled:opacity-40">위로</button>
                    <button disabled={index === postBlocks.length - 1} onClick={() => moveEditorBlock(block.id, 1)} className="h-8 rounded-md border border-[#c7ceda] px-2.5 text-xs font-semibold disabled:opacity-40">아래로</button>
                    <button onClick={() => setPostBlocks((blocks) => blocks.filter((item) => item.id !== block.id))} className="h-8 rounded-md border border-[#d3a1a1] px-2.5 text-xs font-semibold text-[#9a2f2f]">삭제</button>
                  </div>
                </div>
              ) : (
                <div
                  key={block.id}
                  className="rounded-md border border-[#d9dee8] bg-[#f9fafc] p-3"
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "copy";
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onImages(event.dataTransfer.files, block.id);
                  }}
                >
                  <textarea
                    value={block.text ?? ""}
                    onChange={(event) =>
                      setPostBlocks((blocks) =>
                        blocks.map((item) =>
                          item.id === block.id
                            ? { ...item, text: event.target.value }
                            : item,
                        ),
                      )
                    }
                    placeholder={
                      index === 0
                        ? "투자 아이디어, 근거, 리스크, 체크할 지표를 긴 글로 정리하세요."
                        : "문단을 이어서 작성하세요."
                    }
                    className="min-h-40 w-full resize-y bg-transparent text-sm leading-7 text-[#344052] outline-none"
                  />
                  <div className="mt-2 flex flex-wrap gap-2 border-t border-[#eef1f6] pt-2">
                    <button
                      onClick={() => insertTextBlock(block.id, "before")}
                      className="h-8 rounded-md border border-[#c7ceda] bg-white px-2.5 text-xs font-semibold"
                    >
                      위에 글
                    </button>
                    <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border border-[#c7ceda] bg-white px-2.5 text-xs font-semibold">
                      <ImageIcon size={14} />
                      위에 사진
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(event) => {
                          onImages(event.target.files, block.id, "before");
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                    <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border border-[#c7ceda] bg-white px-2.5 text-xs font-semibold text-[#344052] hover:bg-[#eef1f6]">
                      <ImageIcon size={14} />
                      아래에 사진 넣기
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(event) => {
                          onImages(event.target.files, block.id);
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                    <button
                      onClick={() => insertTextBlock(block.id, "after")}
                      className="h-8 rounded-md border border-[#c7ceda] bg-white px-2.5 text-xs font-semibold text-[#344052] hover:bg-[#eef1f6]"
                    >
                      아래에 문단 추가
                    </button>
                    <button disabled={index === 0} onClick={() => moveEditorBlock(block.id, -1)} className="h-8 rounded-md border border-[#c7ceda] bg-white px-2.5 text-xs font-semibold disabled:opacity-40">위로</button>
                    <button disabled={index === postBlocks.length - 1} onClick={() => moveEditorBlock(block.id, 1)} className="h-8 rounded-md border border-[#c7ceda] bg-white px-2.5 text-xs font-semibold disabled:opacity-40">아래로</button>
                    {postBlocks.length > 1 ? (
                      <button
                        onClick={() =>
                          setPostBlocks((blocks) =>
                            blocks.filter((item) => item.id !== block.id),
                          )
                        }
                        className="h-8 rounded-md border border-[#d3a1a1] bg-white px-2.5 text-xs font-semibold text-[#9a2f2f]"
                      >
                        문단 삭제
                      </button>
                    ) : null}
                  </div>
                </div>
              ),
            )}
          </div>
          <div className="mt-4 border-t border-[#eef1f6] pt-4">
            <div className="relative">
              <div className="flex items-center rounded-md border border-[#c7ceda] px-3">
                <span className="font-semibold text-[#1f6f8b]">#</span>
                <input
                  value={postTagQuery}
                  onChange={(event) => setPostTagQuery(event.target.value.replace(/^#/, ""))}
                  placeholder="기업명 또는 종목코드 검색"
                  className="h-10 flex-1 border-0 bg-transparent px-1 text-sm outline-none"
                />
              </div>
              {postTagQuery.trim() ? (
                <div className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded-md border border-[#d9dee8] bg-white shadow-lg">
                  {stockSymbols
                    .map((item) => ({
                      item,
                      score: stockSearchScore(item, postTagQuery),
                    }))
                    .filter(({ score }) => score > 0)
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 8)
                    .map(({ item }) => (
                      <button
                        key={`${item.currency}-${item.symbol}`}
                        onClick={() => {
                          setPostTags((tags) =>
                            tags.some((tag) => tag.symbol === item.symbol)
                              ? tags
                              : [
                                  ...tags,
                                  {
                                    symbol: item.symbol,
                                    name: item.description,
                                    market: item.currency === "KRW" ? "KR" : "US",
                                  },
                                ],
                          );
                          setPostTagQuery("");
                        }}
                        className="flex w-full items-center justify-between border-b border-[#eef1f6] px-3 py-2 text-left text-sm last:border-0 hover:bg-[#f6f8fb]"
                      >
                        <span>{item.description}</span>
                        <span className="text-xs text-[#607086]">{item.symbol}</span>
                      </button>
                    ))}
                </div>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {postTags.map((tag) => (
                <button
                  key={tag.symbol}
                  onClick={() => setPostTags((tags) => tags.filter((item) => item.symbol !== tag.symbol))}
                  className="rounded-md bg-[#eef6f9] px-2.5 py-1 text-xs font-semibold text-[#1f6f8b]"
                >
                  #{tag.name} <X size={12} className="ml-1 inline" />
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#eef1f6] pt-4">
            <button
              onClick={() =>
                setPostBlocks((blocks) => [
                  ...blocks,
                  { id: makeEditorBlockId(), type: "text", text: "" },
                ])
              }
              className="h-9 rounded-md border border-[#c7ceda] px-3 text-sm font-semibold text-[#344052] hover:bg-[#eef1f6]"
            >
              문단 추가
            </button>
            <button
              onClick={async () => {
                await onPost();
                setEditorOpen(false);
              }}
              disabled={
                loading ||
                (!postTitle.trim() &&
                  !postBlocks.some((block) =>
                    block.type === "image" ? !!block.url : !!block.text?.trim(),
                  ))
              }
              className="inline-flex h-9 items-center gap-2 rounded-md bg-[#1f6f8b] px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {editingPostId ? "수정 완료" : "게시"}
            </button>
          </div>
        </div>
        )}

        {!editorOpen && !detailPostId ? <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
          {scopeOptions.map((item) => (
            <button
              key={item.id}
              onClick={() => setScope(item.id)}
              className={`h-9 rounded-md px-3 text-sm font-semibold ${
                scope === item.id
                  ? "bg-[#1f6f8b] text-white"
                  : "border border-[#c7ceda] bg-white text-[#344052]"
              }`}
            >
              {item.label}
            </button>
          ))}
          </div>
          <div className="grid grid-cols-2 rounded-md border border-[#c7ceda] bg-white p-1">
            {(["latest", "popular"] as FeedSort[]).map((item) => (
              <button
                key={item}
                onClick={() => setSort(item)}
                className={`h-8 rounded px-3 text-xs font-semibold ${
                  sort === item ? "bg-[#1f6f8b] text-white" : "text-[#607086]"
                }`}
              >
                {item === "latest" ? "최신순" : "인기순"}
              </button>
            ))}
          </div>
        </div>
        : null}

        {!editorOpen ? <div className="space-y-4">
          {posts.length === 0 ? (
            <p className="rounded-lg border border-[#d9dee8] bg-white p-6 text-center text-sm text-[#607086]">
              표시할 게시글이 없습니다.
            </p>
          ) : (
            posts.filter((post) => !detailPostId || post.id === detailPostId).map((post) => {
              const expanded = detailPostId === post.id || (expandedPosts[post.id] ?? false);
              const blocks = post.contentBlocks?.length
                ? post.contentBlocks
                : [
                    ...(post.content
                      ? [{ id: `${post.id}-text`, type: "text" as const, text: post.content }]
                      : []),
                    ...post.imageUrls.map((url, index) => ({
                      id: `${post.id}-image-${index}`,
                      type: "image" as const,
                      url,
                    })),
                  ];
              return (
              <article
                key={post.id}
                onDoubleClick={() => setDetailPostId(post.id)}
                className={`rounded-lg border border-[#d9dee8] bg-white shadow-sm ${
                  detailPostId ? "p-8 md:p-12" : "p-4"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{post.author.nickname}</p>
                    <p className="text-xs text-[#607086]">
                      {new Date(post.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {post.author.id === currentUserId ? (
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          onEditPost(post);
                          setEditorOpen(true);
                          setDetailPostId(null);
                        }}
                        className="grid h-8 w-8 place-items-center rounded-md border border-[#c7ceda]"
                        title="수정"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => onDeletePost(post.id)}
                        className="grid h-8 w-8 place-items-center rounded-md border border-[#d3a1a1] text-[#9a2f2f]"
                        title="삭제"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ) : null}
                </div>
                {post.title ? (
                  <h2 className="mt-3 text-xl font-semibold leading-8">
                    {post.title}
                  </h2>
                ) : null}
                <div className={`mt-3 space-y-4 ${expanded ? "" : "max-h-56 overflow-hidden"}`}>
                  {blocks.map((block) =>
                    block.type === "image" ? (
                      <img
                        key={block.id}
                        src={block.url}
                        alt=""
                        onClick={() => {
                          if (detailPostId && block.url) setImagePreview(block.url);
                        }}
                        className={`max-h-[720px] w-full rounded-md border border-[#eef1f6] object-contain ${
                          detailPostId ? "cursor-zoom-in" : ""
                        }`}
                      />
                    ) : (
                      <MarkdownContent
                        key={block.id}
                        markdown={block.text ?? ""}
                        onImageClick={
                          detailPostId ? (url) => setImagePreview(url) : undefined
                        }
                      />
                    ),
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {post.stockTags.map((tag) => {
                    const quote = getTagQuote(tag);
                    return (
                      <span key={tag.symbol} className="group relative">
                        <button
                          onClick={() => onStockTagClick(tag)}
                          className="cursor-pointer text-xs font-semibold text-[#1f6f8b] hover:underline"
                        >
                          #{tag.name}
                        </button>
                        {quote ? (
                          <span className="pointer-events-none absolute bottom-full left-0 z-30 mb-2 hidden w-48 rounded-md border border-[#d9dee8] bg-white p-3 text-left shadow-lg group-hover:block">
                            <span className="block text-sm font-semibold text-[#161a22]">{tag.name}</span>
                            <span className="mt-0.5 block text-xs text-[#607086]">{tag.symbol}</span>
                            <span className="mt-2 block text-base font-semibold text-[#161a22]">
                              {formatMoney(quote.current, tag.market === "KR" ? "KRW" : "USD", quote.currency)}
                            </span>
                            <span className={`mt-0.5 block text-xs font-semibold ${quote.change >= 0 ? "text-[#2e7d4f]" : "text-[#b64242]"}`}>
                              {quote.change >= 0 ? "+" : ""}
                              {formatMoney(quote.change, tag.market === "KR" ? "KRW" : "USD", quote.currency)}
                              {" "}({quote.percentChange >= 0 ? "+" : ""}{formatNumber(quote.percentChange)}%)
                            </span>
                          </span>
                        ) : null}
                      </span>
                    );
                  })}
                </div>
                {!detailPostId ? <button
                  onClick={() =>
                    setExpandedPosts((items) => ({ ...items, [post.id]: !expanded }))
                  }
                  className="mt-3 text-sm font-semibold text-[#1f6f8b]"
                >
                  {expanded ? "접기" : "전체 글 보기"}
                </button> : null}
                <div className="mt-4 flex items-center gap-2 border-t border-[#eef1f6] pt-3">
                  <button
                    onClick={() => onLike(post.id)}
                    className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-semibold ${
                      post.likedByMe
                        ? "border-[#b64242] bg-[#fff1f1] text-[#b64242]"
                        : "border-[#c7ceda] text-[#344052]"
                    }`}
                  >
                    <Heart size={16} fill={post.likedByMe ? "currentColor" : "none"} />
                    {post.likeCount}
                  </button>
                  <span className="inline-flex h-9 items-center gap-2 rounded-md border border-[#c7ceda] px-3 text-sm font-semibold text-[#344052]">
                    <MessageCircle size={16} />
                    {post.commentCount}
                  </span>
                </div>
                {expanded ? <div className="mt-4 space-y-3">
                  {post.comments.map((comment) => (
                    <CommentThread
                      key={comment.id}
                      postId={post.id}
                      comment={comment}
                      replyDrafts={replyDrafts}
                      setReplyDrafts={setReplyDrafts}
                      onComment={onComment}
                      currentUserId={currentUserId}
                      onEditComment={onEditComment}
                      onDeleteComment={onDeleteComment}
                    />
                  ))}
                  <div className="flex gap-2">
                    <input
                      value={commentDrafts[post.id] ?? ""}
                      onChange={(event) =>
                        setCommentDrafts((drafts) => ({
                          ...drafts,
                          [post.id]: event.target.value,
                        }))
                      }
                      placeholder="댓글 작성"
                      className="h-10 flex-1 rounded-md border border-[#c7ceda] px-3 text-sm outline-none focus:border-[#1f6f8b]"
                    />
                    <button
                      onClick={() => onComment(post.id)}
                      className="grid h-10 w-10 place-items-center rounded-md bg-[#1f6f8b] text-white"
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </div> : null}
              </article>
              );
            })
          )}
        </div> : null}
      </div>
      {!detailPostId && !editorOpen ? <aside className="rounded-lg border border-[#d9dee8] bg-white p-4 shadow-sm lg:sticky lg:top-4 lg:self-start">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#344052]">구독</h2>
          <Users size={16} className="text-[#607086]" />
        </div>
        <div className="mt-3 space-y-2">
          {users.slice(0, 3).map((communityUser) => (
            <div
              key={communityUser.id}
              className="rounded-md border border-[#eef1f6] p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {communityUser.nickname}
                    {communityUser.isMe ? " · 나" : ""}
                  </p>
                  <p className="truncate text-xs text-[#607086]">
                    구독자 {communityUser.subscriberCount} · 구독중{" "}
                    {communityUser.followingCount}
                  </p>
                </div>
                {!communityUser.isMe ? (
                  <button
                    onClick={() => onSubscribe(communityUser.id)}
                    className={`h-8 rounded-md px-2.5 text-xs font-semibold ${
                      communityUser.isSubscribed
                        ? "border border-[#c7ceda] text-[#344052]"
                        : "bg-[#1f6f8b] text-white"
                    }`}
                  >
                    {communityUser.isSubscribed ? "구독중" : "구독"}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </aside> : null}
      {imagePreview ? (
        <div
          onClick={() => setImagePreview(null)}
          className="fixed inset-0 z-50 grid cursor-zoom-out place-items-center bg-black/85 p-4"
        >
          <img src={imagePreview} alt="" className="max-h-[94vh] max-w-[96vw] object-contain" />
        </div>
      ) : null}
    </section>
  );
}

function CommentThread({
  postId,
  comment,
  replyDrafts,
  setReplyDrafts,
  onComment,
  currentUserId,
  onEditComment,
  onDeleteComment,
}: {
  postId: string;
  comment: CommunityComment;
  replyDrafts: Record<string, string>;
  setReplyDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  onComment: (postId: string, parentId?: string) => void;
  currentUserId: string;
  onEditComment: (commentId: string, content: string) => void;
  onDeleteComment: (commentId: string) => void;
}) {
  return (
    <div className="rounded-md bg-[#f6f8fb] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{comment.author.nickname}</p>
        {comment.author.id === currentUserId ? (
          <div className="flex gap-1">
            <button onClick={() => onEditComment(comment.id, comment.content)} title="수정">
              <Pencil size={13} />
            </button>
            <button onClick={() => onDeleteComment(comment.id)} title="삭제" className="text-[#9a2f2f]">
              <Trash2 size={13} />
            </button>
          </div>
        ) : null}
      </div>
      <p className="mt-1 whitespace-pre-wrap text-sm text-[#344052]">
        {comment.content}
      </p>
      {comment.replies.length > 0 ? (
        <div className="mt-3 space-y-2 border-l-2 border-[#d9dee8] pl-3">
          {comment.replies.map((reply) => (
            <div key={reply.id} className="rounded-md bg-white p-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold">{reply.author.nickname}</p>
                {reply.author.id === currentUserId ? (
                  <div className="flex gap-1">
                    <button onClick={() => onEditComment(reply.id, reply.content)} title="수정">
                      <Pencil size={12} />
                    </button>
                    <button onClick={() => onDeleteComment(reply.id)} title="삭제" className="text-[#9a2f2f]">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-[#344052]">{reply.content}</p>
            </div>
          ))}
        </div>
      ) : null}
      <div className="mt-3 flex gap-2">
        <input
          value={replyDrafts[comment.id] ?? ""}
          onChange={(event) =>
            setReplyDrafts((drafts) => ({
              ...drafts,
              [comment.id]: event.target.value,
            }))
          }
          placeholder="답글 작성"
          className="h-9 flex-1 rounded-md border border-[#c7ceda] bg-white px-3 text-sm outline-none focus:border-[#1f6f8b]"
        />
        <button
          onClick={() => onComment(postId, comment.id)}
          className="grid h-9 w-9 place-items-center rounded-md bg-[#344052] text-white"
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}

function Placeholder({ title }: { title: string }) {
  return (
    <section className="flex min-h-[420px] items-center justify-center rounded-lg border border-[#d9dee8] bg-white p-5 text-sm text-[#607086] shadow-sm">
      {title} will be connected next.
    </section>
  );
}

function NewsOrPlaceholder({
  view,
  news,
  language,
  page,
  setPage,
  category,
  setCategory,
}: {
  view: View;
  news: MarketNews[];
  language: Language;
  page: number;
  setPage: (page: number) => void;
  category: NewsCategory;
  setCategory: (category: NewsCategory) => void;
}) {
  if (view !== "news") {
    return <Placeholder title="Community" />;
  }

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(news.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleNews = news.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <section className="rounded-lg border border-[#d9dee8] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{copy[language].news}</h2>
        <span className="rounded-md bg-[#eef3f8] px-2.5 py-1 text-xs font-semibold text-[#344052]">
          {news.length}
        </span>
      </div>
      <div className="mt-4 flex gap-2">
        {newsCategories.map((item) => (
          <button
            key={item.id}
            onClick={() => setCategory(item.id)}
            className={`h-9 rounded-md px-3 text-sm font-semibold ${
              category === item.id
                ? "bg-[#1f6f8b] text-white"
                : "border border-[#c7ceda] bg-white text-[#344052]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="mt-4 grid gap-3">
        {news.length === 0 ? (
          <p className="rounded-md border border-[#d9dee8] p-6 text-center text-sm text-[#607086]">
            No news loaded.
          </p>
        ) : (
          visibleNews.map((item) => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="block rounded-md border border-[#d9dee8] p-4 hover:bg-[#f6f8fb]"
            >
              <div className="flex gap-4">
                {item.image ? (
                  <img
                    src={item.image}
                    alt=""
                    className="hidden h-20 w-28 rounded-md object-cover sm:block"
                  />
                ) : null}
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#607086]">
                    {item.source} ·{" "}
                    {new Date(item.datetime * 1000).toLocaleString()}
                  </p>
                  <h3 className="mt-1 font-semibold">{item.headline}</h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#607086]">
                    {item.summary}
                  </p>
                </div>
              </div>
            </a>
          ))
        )}
      </div>
      {news.length > pageSize ? (
        <div className="mt-4 flex items-center justify-between border-t border-[#eef1f6] pt-4">
          <button
            disabled={safePage === 1}
            onClick={() => setPage(Math.max(1, safePage - 1))}
            className="h-9 rounded-md border border-[#c7ceda] px-3 text-sm font-semibold disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm font-medium text-[#607086]">
            {safePage} / {totalPages}
          </span>
          <button
            disabled={safePage === totalPages}
            onClick={() => setPage(Math.min(totalPages, safePage + 1))}
            className="h-9 rounded-md border border-[#c7ceda] px-3 text-sm font-semibold disabled:opacity-50"
          >
            Next
          </button>
        </div>
      ) : null}
    </section>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#d9dee8] bg-[#f9fafc] p-3">
      <p className="text-xs text-[#607086]">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function communityBlocksToMarkdown(post: CommunityPost): string {
  if (post.contentBlocks.length) {
    return post.contentBlocks
      .map((block) =>
        block.type === "image" && block.url
          ? `![image](${block.url})`
          : block.text ?? "",
      )
      .filter(Boolean)
      .join("\n\n");
  }
  return [
    post.content,
    ...post.imageUrls.map((url) => `![image](${url})`),
  ]
    .filter(Boolean)
    .join("\n\n");
}

function stockSearchScore(item: StockSymbol, rawQuery: string): number {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return 0;
  const symbol = item.symbol.toLowerCase();
  const name = item.description.toLowerCase();
  if (symbol === query) return 120;
  if (symbol.startsWith(query)) return 105;
  if (name.startsWith(query)) return 100;
  if (symbol.includes(query)) return 90;
  if (name.includes(query)) return 80;
  const distance = editDistance(symbol, query);
  return distance <= 2 ? 70 - distance * 10 : 0;
}

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const current = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        previous + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      previous = current;
    }
  }
  return row[b.length];
}

function MarkdownContent({
  markdown,
  onImageClick,
}: {
  markdown: string;
  onImageClick?: (url: string) => void;
}) {
  const lines = markdown.split(/\r?\n/);
  return (
    <div className="space-y-3 text-sm leading-7 text-[#344052]">
      {lines.map((line, index) => {
        const image = line.match(/^!\[([^\]]*)\]\((.+)\)$/);
        if (image) {
          return (
            <img
              key={index}
              src={image[2]}
              alt={image[1]}
              onClick={() => onImageClick?.(image[2])}
              className={`max-h-[720px] w-full rounded-md object-contain ${
                onImageClick ? "cursor-zoom-in" : ""
              }`}
            />
          );
        }
        if (line.startsWith("### ")) {
          return <h3 key={index} className="pt-2 text-lg font-semibold">{line.slice(4)}</h3>;
        }
        if (line.startsWith("## ")) {
          return <h2 key={index} className="pt-3 text-xl font-semibold">{line.slice(3)}</h2>;
        }
        if (line.startsWith("# ")) {
          return <h1 key={index} className="pt-4 text-2xl font-semibold">{line.slice(2)}</h1>;
        }
        if (line.startsWith("- ")) {
          return <p key={index} className="pl-4 before:mr-2 before:content-['•']">{line.slice(2)}</p>;
        }
        if (line.startsWith("> ")) {
          return <blockquote key={index} className="border-l-2 border-[#9ab8c5] pl-4 text-[#607086]">{line.slice(2)}</blockquote>;
        }
        if (!line.trim()) return <div key={index} className="h-2" />;
        return <p key={index} className="whitespace-pre-wrap">{line}</p>;
      })}
    </div>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value || 0);
}

function convertMoneyValue(
  value: number,
  displayCurrency: DisplayCurrency,
  sourceCurrency: DisplayCurrency = "USD",
) {
  if (displayCurrency === sourceCurrency) {
    return value;
  }

  if (displayCurrency === "KRW" && sourceCurrency === "USD") {
    return value * 1500;
  }

  if (displayCurrency === "USD" && sourceCurrency === "KRW") {
    return value / 1500;
  }

  return value;
}

function formatMoney(
  value: number,
  displayCurrency: DisplayCurrency,
  sourceCurrency: DisplayCurrency = "USD",
) {
  const converted = convertMoneyValue(value, displayCurrency, sourceCurrency);
  const symbol = displayCurrency === "KRW" ? "원" : "$";
  const fractionDigits = displayCurrency === "KRW" ? 0 : 2;

  return `${symbol}${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  }).format(converted || 0)}`;
}

function convertQuote(
  quote: MarketQuote,
  currency: DisplayCurrency,
): MarketQuote {
  if (!quote.currency || quote.currency === currency) {
    return quote;
  }

  return {
    ...quote,
    current: convertMoneyValue(quote.current, currency, quote.currency),
    change: convertMoneyValue(quote.change, currency, quote.currency),
    high: convertMoneyValue(quote.high, currency, quote.currency),
    low: convertMoneyValue(quote.low, currency, quote.currency),
    open: convertMoneyValue(quote.open, currency, quote.currency),
    previousClose: convertMoneyValue(quote.previousClose, currency, quote.currency),
  };
}

function formatMarketCap(
  value: number,
  displayCurrency: DisplayCurrency,
  sourceCurrency: DisplayCurrency = "USD",
) {
  const converted =
    sourceCurrency === "USD"
      ? convertMoneyValue(value * 1_000_000, displayCurrency, sourceCurrency)
      : convertMoneyValue(value, displayCurrency, sourceCurrency);

  if (displayCurrency === "KRW") {
    return formatKoreanLargeAmount(converted);
  }

  if (sourceCurrency === "USD") {
    return `${formatNumber(value)}M`;
  }

  return formatMoney(converted, displayCurrency, sourceCurrency);
}

function formatKoreanLargeAmount(value: number) {
  if (value >= 1_000_000_000_000) {
    return `${formatDecimal(value / 1_000_000_000_000)}조`;
  }

  if (value >= 100_000_000) {
    return `${formatDecimal(value / 100_000_000)}억`;
  }

  return `원${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(Math.round(value))}`;
}

function formatDecimal(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  }).format(value);
}

function translateDetailLabel(
  language: Language,
  key:
    | "exchange"
    | "currency"
    | "marketCap"
    | "country"
    | "ipo"
    | "website"
    | "sharesOutstanding"
    | "open"
    | "previousClose"
    | "realtimeChart"
    | "companyOverview"
    | "source"
    | "metrics"
    | "per"
    | "pbr"
    | "eps"
    | "high52"
    | "low52"
    | "psr"
    | "roe"
    | "dividendYield",
) {
  const labels = {
    en: {
      exchange: "Exchange",
      currency: "Currency",
      marketCap: "Market cap",
      country: "Country",
      ipo: "IPO",
      website: "Website",
      sharesOutstanding: "Shares outstanding",
      open: "Open",
      previousClose: "Previous close",
      realtimeChart: "Realtime price chart",
      companyOverview: "Company overview",
      source: "Source",
      metrics: "Valuation",
      per: "PER",
      pbr: "PBR",
      eps: "EPS",
      high52: "52W High",
      low52: "52W Low",
      psr: "PSR",
      roe: "ROE",
      dividendYield: "Dividend yield",
    },
    ko: {
      exchange: "거래소",
      currency: "통화",
      marketCap: "시가총액",
      country: "국가",
      ipo: "상장일",
      website: "웹사이트",
      sharesOutstanding: "발행주식수",
      open: "시가",
      previousClose: "전일종가",
      realtimeChart: "실시간 차트",
      companyOverview: "회사 개요",
      source: "출처",
      metrics: "밸류에이션",
      per: "PER",
      pbr: "PBR",
      eps: "EPS",
      high52: "52주 고가",
      low52: "52주 저가",
      psr: "PSR",
      roe: "ROE",
      dividendYield: "배당수익률",
    },
  } as const;

  return labels[language][key];
}

function buildMetricItems(
  metrics: Record<string, number | string | null | undefined> | null,
  language: Language,
  currency: DisplayCurrency,
  sourceCurrency: DisplayCurrency = "USD",
) {
  return [
    {
      label: translateDetailLabel(language, "per"),
      value: formatRatio(
        pickMetric(metrics, ["peTTM", "peAnnual", "peRatioTTM", "peRatio"]),
      ),
    },
    {
      label: translateDetailLabel(language, "pbr"),
      value: formatRatio(
        pickMetric(metrics, ["pbAnnual", "pbTTM", "pbRatioAnnual", "pbRatio"]),
      ),
    },
      {
        label: translateDetailLabel(language, "eps"),
        value: formatMoneyValue(
          pickMetric(metrics, ["epsTTM", "epsAnnual", "epsBasicExclExtraTTM"]),
          currency,
          sourceCurrency,
        ),
      },
      {
        label: translateDetailLabel(language, "high52"),
        value: formatMoneyValue(pickMetric(metrics, ["52WeekHigh"]), currency, sourceCurrency),
      },
      {
        label: translateDetailLabel(language, "low52"),
        value: formatMoneyValue(pickMetric(metrics, ["52WeekLow"]), currency, sourceCurrency),
      },
    {
      label: translateDetailLabel(language, "psr"),
      value: formatRatio(
        pickMetric(metrics, ["psTTM", "psAnnual", "psRatioTTM", "psRatio"]),
      ),
    },
    {
      label: translateDetailLabel(language, "roe"),
      value: formatPercentValue(
        pickMetric(metrics, ["roeTTM", "roeAnnual", "returnOnEquityTTM"]),
      ),
    },
    {
      label: translateDetailLabel(language, "dividendYield"),
      value: formatPercentValue(
        pickMetric(metrics, ["currentDividendYieldTTM", "dividendYieldTTM"]),
      ),
    },
  ];
}

function pickMetric(
  metrics: Record<string, number | string | null | undefined> | null,
  keys: string[],
): number | null {
  if (!metrics) {
    return null;
  }

  for (const key of keys) {
    const value = metrics[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function formatRatio(value: number | null): string {
  return value === null ? "-" : `${value.toFixed(2)}x`;
}

function formatPercentValue(value: number | null): string {
  return value === null ? "-" : `${value.toFixed(2)}%`;
}

function formatMoneyValue(
  value: number | null,
  currency: DisplayCurrency,
  sourceCurrency: DisplayCurrency = "USD",
): string {
  return value === null ? "-" : formatMoney(value, currency, sourceCurrency);
}
