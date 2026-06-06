"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogOut, Moon, Plus, Sun, UserPen, Users } from "lucide-react";
import { Notice } from "@/common/components/Notice";
import { SessionLoading } from "@/common/components/SessionLoading";
import { apiRequest } from "@/lib/api";
import { makeEditorBlockId, communityBlocksToMarkdown } from "@/common/lib/community";
import { useMarketDataStore } from "@/common/stores/market-data";
import { useSessionStore } from "@/common/stores/session";
import { MarketPulse } from "@/domain/markets/components/MarketPulse";
import {
  CommunityContentBlock,
  CommunityPost,
  CommunityScope,
  CommunityUser,
  FeedSort,
  StockTag,
} from "@/domain/community/types";
import { PostCard } from "@/domain/community/components/PostCard";
import { PostEditor } from "@/domain/community/components/PostEditor";

export function CommunityPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const accessToken = useSessionStore((s) => s.accessToken);
  const user = useSessionStore((s) => s.user);
  const authChecking = useSessionStore((s) => s.authChecking);
  const logoutSession = useSessionStore((s) => s.logout);
  const pulse = useMarketDataStore((s) => s.pulse);
  const usStocks = useMarketDataStore((s) => s.usStocks);
  const usSymbols = useMarketDataStore((s) => s.usSymbols);
  const krStocks = useMarketDataStore((s) => s.krStocks);
  const krSymbols = useMarketDataStore((s) => s.krSymbols);
  const livePrices = useMarketDataStore((s) => s.livePrices);
  const marketLoading = useMarketDataStore((s) => s.marketLoading);
  const loadMarketData = useMarketDataStore((s) => s.loadMarketData);

  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [users, setUsers] = useState<CommunityUser[]>([]);
  const [scope, setScope] = useState<CommunityScope>("all");
  const [sort, setSort] = useState<FeedSort>("latest");
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [postTitle, setPostTitle] = useState("");
  const [postBlocks, setPostBlocks] = useState<CommunityContentBlock[]>([
    { id: makeEditorBlockId(), type: "text", text: "" },
  ]);
  const [postTagQuery, setPostTagQuery] = useState("");
  const [postTags, setPostTags] = useState<StockTag[]>([]);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [editorOpen, setEditorOpen] = useState(false);
  const [language, setLanguage] = useState<"en" | "ko">("en");
  const [darkMode, setDarkMode] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem("darkMode") === "true",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedPostId = searchParams.get("post");
  const stockSymbols = useMemo(() => [...krSymbols, ...usSymbols], [krSymbols, usSymbols]);
  const isAdmin = user?.role === "ADMIN";
  const menuItems: Array<{ id: "stocks" | "news" | "community" | "admin"; label: string }> = [
    { id: "stocks", label: language === "ko" ? "종목" : "Stocks" },
    { id: "news", label: language === "ko" ? "뉴스" : "News" },
    { id: "community", label: language === "ko" ? "커뮤니티" : "Community" },
    { id: "admin", label: language === "ko" ? "관리자" : "Admin" },
  ];

  useEffect(() => {
    if (!authChecking && user?.status !== "APPROVED") {
      router.replace("/login");
    }
  }, [authChecking, user?.status, router]);

  useEffect(() => {
    window.localStorage.setItem("darkMode", String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    if (!accessToken || user?.status !== "APPROVED") {
      return;
    }
    loadCommunity(accessToken, scope, sort);
  }, [accessToken, user?.status, scope, sort]);

  async function loadCommunity(
    token = accessToken,
    nextScope: CommunityScope = scope,
    nextSort: FeedSort = sort,
  ) {
    if (!token) {
      return;
    }

    setLoading(true);
    setError("");
    try {
      const [postsResult, usersResult] = await Promise.all([
        apiRequest<CommunityPost[]>(
          `/community/feed?scope=${nextScope}&sort=${nextSort}`,
          "GET",
          { accessToken: token },
        ),
        apiRequest<CommunityUser[]>("/community/users", "GET", {
          accessToken: token,
        }),
      ]);
      setPosts(postsResult);
      setUsers(usersResult);
    } catch (communityError) {
      setError(
        communityError instanceof Error
          ? communityError.message
          : "Could not load community.",
      );
    } finally {
      setLoading(false);
    }
  }

  function resetEditor() {
    setEditingPostId(null);
    setPostTitle("");
    setPostBlocks([{ id: makeEditorBlockId(), type: "text", text: "" }]);
    setPostTagQuery("");
    setPostTags([]);
  }

  async function savePost() {
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

    if (!accessToken || (!postTitle.trim() && normalizedBlocks.length === 0)) {
      return;
    }

    setLoading(true);
    setError("");
    try {
      await apiRequest<CommunityPost>(
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
        },
      );
      resetEditor();
      setEditorOpen(false);
      await loadCommunity(accessToken, scope, sort);
    } catch (postError) {
      setError(postError instanceof Error ? postError.message : "Could not post.");
    } finally {
      setLoading(false);
    }
  }

  function editPost(post: CommunityPost) {
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
    setEditorOpen(true);
  }

  async function deletePost(postId: string) {
    if (!accessToken || !window.confirm("이 게시글을 삭제할까요?")) {
      return;
    }
    await apiRequest<{ ok: true }>(`/community/posts/${postId}`, "DELETE", { accessToken });
    setPosts((current) => current.filter((post) => post.id !== postId));
  }

  async function toggleLike(postId: string) {
    if (!accessToken) {
      return;
    }
    try {
      const result = await apiRequest<{ liked: boolean; likeCount: number }>(
        `/community/posts/${postId}/like`,
        "POST",
        { accessToken },
      );
      setPosts((current) =>
        current.map((post) =>
          post.id === postId
            ? { ...post, likedByMe: result.liked, likeCount: result.likeCount }
            : post,
        ),
      );
    } catch (likeError) {
      setError(likeError instanceof Error ? likeError.message : "Could not like.");
    }
  }

  async function createComment(postId: string, parentId?: string) {
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
        { accessToken, body: { content, parentId } },
      );
      setPosts((current) => current.map((item) => (item.id === post.id ? post : item)));
      if (parentId) {
        setReplyDrafts((drafts) => ({ ...drafts, [draftKey]: "" }));
      } else {
        setCommentDrafts((drafts) => ({ ...drafts, [draftKey]: "" }));
      }
    } catch (commentError) {
      setError(commentError instanceof Error ? commentError.message : "Could not comment.");
    }
  }

  async function editComment(commentId: string, content: string) {
    if (!accessToken) {
      return;
    }
    const next = window.prompt("댓글 수정", content);
    if (!next?.trim()) {
      return;
    }
    const post = await apiRequest<CommunityPost>(`/community/comments/${commentId}`, "PATCH", {
      accessToken,
      body: { content: next },
    });
    setPosts((current) => current.map((item) => (item.id === post.id ? post : item)));
  }

  async function deleteComment(commentId: string) {
    if (!accessToken || !window.confirm("이 댓글을 삭제할까요?")) {
      return;
    }
    const post = await apiRequest<CommunityPost>(`/community/comments/${commentId}`, "DELETE", {
      accessToken,
    });
    setPosts((current) => current.map((item) => (item.id === post.id ? post : item)));
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
      await loadCommunity(accessToken, scope, sort);
    } catch (subscribeError) {
      setError(
        subscribeError instanceof Error
          ? subscribeError.message
          : "Could not update subscription.",
      );
    }
  }

  function openStock(tag: StockTag) {
    router.push(`/?symbol=${encodeURIComponent(tag.symbol)}&market=${tag.market}`);
  }

  async function logout() {
    await logoutSession();
  }

  if (authChecking || user?.status !== "APPROVED") {
    return (
      <main className={`min-h-screen bg-[#f6f7fb] text-[#161a22] ${darkMode ? "dark-app" : ""}`}>
        <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-6 sm:px-8">
          <SessionLoading />
        </section>
      </main>
    );
  }

  const visiblePosts = selectedPostId
    ? posts.filter((post) => post.id === selectedPostId)
    : posts;

  return (
    <main className={`min-h-screen bg-[#f6f7fb] text-[#161a22] ${darkMode ? "dark-app" : ""}`}>
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLanguage(language === "en" ? "ko" : "en")}
              className="h-10 rounded-md border border-[#c7ceda] bg-white px-3 text-sm font-semibold text-[#1f6f8b] shadow-sm hover:bg-[#eef1f6]"
            >
              {language === "en" ? "한국어" : "English"}
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
              onClick={() => router.push("/")}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[#c7ceda] bg-white px-3 text-sm font-semibold text-[#344052] shadow-sm hover:bg-[#eef1f6]"
            >
              <UserPen size={16} />
              {language === "ko" ? "프로필 수정" : "Profile"}
            </button>
            <button
              onClick={logout}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[#c7ceda] bg-white px-3 text-sm font-medium shadow-sm hover:bg-[#eef1f6]"
            >
              <LogOut size={16} />
              {language === "ko" ? "로그아웃" : "Logout"}
            </button>
          </div>
        </header>

        <MarketPulse
          pulse={pulse}
          livePrices={livePrices}
          loading={marketLoading}
          refresh={() => {
            if (accessToken) {
              loadMarketData(accessToken);
            }
          }}
          title={language === "ko" ? "시장 지표" : "Market pulse"}
          refreshLabel={language === "ko" ? "새로고침" : "Refresh"}
        />

        <nav className="mt-4 flex gap-2 border-b border-[#d9dee8]">
          {menuItems
            .filter((item) => item.id !== "admin" || isAdmin)
            .map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === "community") {
                    router.push("/community");
                    return;
                  }
                  router.push("/");
                }}
                className={`h-11 border-b-2 px-3 text-sm font-semibold ${
                  item.id === "community"
                    ? "border-[#1f6f8b] text-[#1f6f8b]"
                    : "border-transparent text-[#607086]"
                }`}
              >
                {item.label}
              </button>
            ))}
        </nav>

        {error ? <Notice message="" error={error} /> : null}

        <div className="grid flex-1 gap-5 py-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                {(["all", "subscribed", "mine"] as CommunityScope[]).map((item) => (
                  <button
                    key={item}
                    onClick={() => setScope(item)}
                    className={`h-9 rounded-md px-3 text-sm font-semibold ${
                      scope === item
                        ? "bg-[#1f6f8b] text-white"
                        : "border border-[#c7ceda] bg-white text-[#344052]"
                    }`}
                  >
                    {item === "all" ? "전체 피드" : item === "subscribed" ? "구독 피드" : "내 피드"}
                  </button>
                ))}
                {(["latest", "popular"] as FeedSort[]).map((item) => (
                  <button
                    key={item}
                    onClick={() => setSort(item)}
                    className={`h-9 rounded-md px-3 text-sm font-semibold ${
                      sort === item
                        ? "bg-[#344052] text-white"
                        : "border border-[#c7ceda] bg-white text-[#344052]"
                    }`}
                  >
                    {item === "latest" ? "최신순" : "인기순"}
                  </button>
                ))}
              </div>
              <button
                onClick={() => {
                  resetEditor();
                  setEditorOpen(true);
                }}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-[#1f6f8b] px-4 text-sm font-semibold text-white"
              >
                <Plus size={17} />
                피드 글 쓰기
              </button>
            </div>

            {editorOpen ? (
              <PostEditor
                title={postTitle}
                setTitle={setPostTitle}
                blocks={postBlocks}
                setBlocks={setPostBlocks}
                tagQuery={postTagQuery}
                setTagQuery={setPostTagQuery}
                tags={postTags}
                setTags={setPostTags}
                stockSymbols={stockSymbols}
                usStocks={usStocks}
                krStocks={krStocks}
                livePrices={livePrices}
                editingPostId={editingPostId}
                loading={loading}
                onSubmit={savePost}
                onCancel={() => {
                  resetEditor();
                  setEditorOpen(false);
                }}
              />
            ) : null}

            <div className="grid gap-4">
              {loading && posts.length === 0 ? (
                <p className="rounded-lg border border-[#d9dee8] bg-white p-8 text-center text-sm text-[#607086]">
                  불러오는 중입니다.
                </p>
              ) : null}
              {!loading && visiblePosts.length === 0 ? (
                <p className="rounded-lg border border-[#d9dee8] bg-white p-8 text-center text-sm text-[#607086]">
                  표시할 피드가 없습니다.
                </p>
              ) : null}
              {visiblePosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentUserId={user.id}
                  commentDrafts={commentDrafts}
                  setCommentDrafts={setCommentDrafts}
                  replyDrafts={replyDrafts}
                  setReplyDrafts={setReplyDrafts}
                  onLike={toggleLike}
                  onComment={createComment}
                  onEditPost={editPost}
                  onDeletePost={deletePost}
                  onEditComment={editComment}
                  onDeleteComment={deleteComment}
                  onStockTagClick={openStock}
                  usStocks={usStocks}
                  krStocks={krStocks}
                  livePrices={livePrices}
                  forceExpanded={post.id === selectedPostId}
                />
              ))}
            </div>
          </div>

          <aside className="rounded-lg border border-[#d9dee8] bg-white p-4 shadow-sm lg:sticky lg:top-4 lg:self-start">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#344052]">구독</h2>
              <Users size={16} className="text-[#607086]" />
            </div>
            <div className="mt-3 space-y-2">
              {users.slice(0, 6).map((communityUser) => (
                <div key={communityUser.id} className="rounded-md border border-[#eef1f6] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {communityUser.nickname}
                        {communityUser.isMe ? " · 나" : ""}
                      </p>
                      <p className="truncate text-xs text-[#607086]">
                        구독자 {communityUser.subscriberCount} · 구독중 {communityUser.followingCount}
                      </p>
                    </div>
                    {!communityUser.isMe ? (
                      <button
                        onClick={() => toggleSubscription(communityUser.id)}
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
          </aside>
        </div>
      </section>
    </main>
  );
}
