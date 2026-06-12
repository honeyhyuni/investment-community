"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Users } from "lucide-react";
import { Notice } from "@/common/components/Notice";
import { Button } from "@/common/components/Button";
import { apiRequest } from "@/common/lib/api";
import {
  NEW_POST_TEMPLATE,
  makeEditorBlockId,
  getPostHtml,
  htmlToPlainText,
} from "@/common/utils/community";
import { useMarketDataStore } from "@/common/stores/market-data";
import { useSessionStore } from "@/common/stores/session";
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
import { stockSearchScore } from "@/common/utils/stock-search";
import { StockSymbol } from "@/common/types";

export function CommunityPage({ postId, userId }: { postId?: string; userId?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const accessToken = useSessionStore((s) => s.accessToken);
  const user = useSessionStore((s) => s.user);
  const usStocks = useMarketDataStore((s) => s.usStocks);
  const usSymbols = useMarketDataStore((s) => s.usSymbols);
  const krStocks = useMarketDataStore((s) => s.krStocks);
  const krSymbols = useMarketDataStore((s) => s.krSymbols);
  const livePrices = useMarketDataStore((s) => s.livePrices);
  const extraQuotes = useMarketDataStore((s) => s.extraQuotes);
  const exchangeRate = useMarketDataStore((s) => s.exchangeRate);
  const loadStockQuotes = useMarketDataStore((s) => s.loadStockQuotes);

  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [users, setUsers] = useState<CommunityUser[]>([]);
  const [scope, setScope] = useState<CommunityScope>("all");
  const [sort, setSort] = useState<FeedSort>("latest");
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [postTitle, setPostTitle] = useState("");
  const [postBlocks, setPostBlocks] = useState<CommunityContentBlock[]>([
    { id: makeEditorBlockId(), type: "text", text: NEW_POST_TEMPLATE },
  ]);
  const [postTagQuery, setPostTagQuery] = useState("");
  const [postTags, setPostTags] = useState<StockTag[]>([]);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [editorOpen, setEditorOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedPostId = postId ?? searchParams.get("post");
  const detailMode = !!selectedPostId || !!userId;
  const stockSymbols = useMemo(() => [...krSymbols, ...usSymbols], [krSymbols, usSymbols]);
  useEffect(() => {
    if (!accessToken) {
      return;
    }
    if (selectedPostId) {
      loadSinglePost(selectedPostId, accessToken);
      return;
    }
    loadCommunity(accessToken, userId ? "user" : scope, sort, userId);
  }, [accessToken, scope, sort, selectedPostId, userId]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    const tags = [...posts.flatMap((post) => post.stockTags), ...postTags].map(
      (tag) => resolveCommunityStockTag(tag, stockSymbols),
    );
    if (tags.length > 0) {
      loadStockQuotes(tags, accessToken);
    }
  }, [accessToken, loadStockQuotes, postTags, posts, stockSymbols]);

  async function loadCommunity(
    token = accessToken,
    nextScope: CommunityScope | "user" = scope,
    nextSort: FeedSort = sort,
    nextUserId?: string,
  ) {
    if (!token) {
      return;
    }

    setLoading(true);
    setError("");
    try {
      const [postsResult, usersResult] = await Promise.all([
        apiRequest<CommunityPost[]>(
          `/community/feed?scope=${nextScope}&sort=${nextSort}${
            nextUserId ? `&userId=${encodeURIComponent(nextUserId)}` : ""
          }`,
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
    setPostBlocks([{ id: makeEditorBlockId(), type: "text", text: NEW_POST_TEMPLATE }]);
    setPostTagQuery("");
    setPostTags([]);
  }

  async function savePost() {
    const html = postBlocks.find((block) => block.type === "text")?.text?.trim() ?? "";
    const contentBlocks: CommunityContentBlock[] = html
      ? [{ id: postBlocks[0]?.id ?? makeEditorBlockId(), type: "text", text: html }]
      : [];
    const plainContent = htmlToPlainText(html).slice(0, 50000);

    if (!accessToken || (!postTitle.trim() && contentBlocks.length === 0)) {
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
            contentBlocks,
            stockTags: postTags,
            imageUrls: [],
          },
        },
      );
      resetEditor();
      setEditorOpen(false);
      await loadCommunity(accessToken, userId ? "user" : scope, sort, userId);
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
        text: getPostHtml(post),
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
      await loadCommunity(accessToken, userId ? "user" : scope, sort, userId);
    } catch (subscribeError) {
      setError(
        subscribeError instanceof Error
          ? subscribeError.message
          : "Could not update subscription.",
      );
    }
  }

  function openStock(tag: StockTag) {
    const resolvedTag = resolveCommunityStockTag(tag, stockSymbols);
    router.push(
      `/?symbol=${encodeURIComponent(resolvedTag.symbol)}&market=${resolvedTag.market}`,
    );
  }

  const visiblePosts = selectedPostId
    ? posts.filter((post) => post.id === selectedPostId)
    : posts;

  if (!user) {
    return null;
  }

  async function loadSinglePost(nextPostId: string, token = accessToken) {
    if (!token) {
      return;
    }

    setLoading(true);
    setError("");
    try {
      const post = await apiRequest<CommunityPost>(
        `/community/posts/${encodeURIComponent(nextPostId)}`,
        "GET",
        { accessToken: token },
      );
      setPosts([post]);
    } catch (communityError) {
      setPosts([]);
      setError(
        communityError instanceof Error
          ? communityError.message
          : "Could not load community post.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (editorOpen) {
    return (
      <>
        {error ? <Notice message="" error={error} /> : null}

        <div className="flex-1 py-4 sm:py-6">
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
            extraQuotes={extraQuotes}
            exchangeRate={exchangeRate}
            editingPostId={editingPostId}
            loading={loading}
            onSubmit={savePost}
            onCancel={() => {
              resetEditor();
              setEditorOpen(false);
            }}
          />
        </div>
      </>
    );
  }

  if (detailMode) {
    return (
      <>
        {error ? <Notice message="" error={error} /> : null}

        <div className="flex-1 py-4 sm:py-6">
          <div className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-between">
            <Button variant="secondary" onClick={() => router.push("/community")}>
              피드 목록으로
            </Button>
            <Button
              variant="primary"
              leftIcon={<Plus />}
              onClick={() => {
                resetEditor();
                setEditorOpen(true);
              }}
            >
              피드 글 쓰기
            </Button>
          </div>

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
                post={{
                  ...post,
                  stockTags: post.stockTags.map((tag) =>
                    resolveCommunityStockTag(tag, stockSymbols),
                  ),
                }}
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
                extraQuotes={extraQuotes}
                exchangeRate={exchangeRate}
                forceExpanded
                enableImagePreview
                canModerate={user.role === "ADMIN"}
                onAuthorClick={(nextUserId) => router.push(`/community/users/${nextUserId}`)}
              />
            ))}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {error ? <Notice message="" error={error} /> : null}

      <div className="grid flex-1 gap-4 py-4 sm:gap-5 sm:py-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <div className="-mx-4 border-y border-[#d9dee8] bg-white p-4 shadow-sm sm:mx-0 sm:rounded-lg sm:border">
              <div className="flex flex-wrap gap-2">
                {(["all", "subscribed", "mine"] as CommunityScope[]).map((item) => (
                  <Button
                    key={item}
                    variant={scope === item ? "primary" : "secondary"}
                    size="sm"
                    onClick={() => setScope(item)}
                    className="flex-1 text-sm sm:flex-none"
                  >
                    {item === "all" ? "전체 피드" : item === "subscribed" ? "구독 피드" : "내 피드"}
                  </Button>
                ))}
                {(["latest", "popular"] as FeedSort[]).map((item) => (
                  <Button
                    key={item}
                    variant={sort === item ? "primary" : "secondary"}
                    size="sm"
                    onClick={() => setSort(item)}
                    className="flex-1 text-sm sm:flex-none"
                  >
                    {item === "latest" ? "최신순" : "인기순"}
                  </Button>
                ))}
              </div>
              <Button
                variant="primary"
                fullWidth
                leftIcon={<Plus />}
                onClick={() => {
                  resetEditor();
                  setEditorOpen(true);
                }}
                className="mt-3"
              >
                피드 글 쓰기
              </Button>
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
                extraQuotes={extraQuotes}
                exchangeRate={exchangeRate}
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
                  post={{
                    ...post,
                    stockTags: post.stockTags.map((tag) =>
                      resolveCommunityStockTag(tag, stockSymbols),
                    ),
                  }}
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
                  extraQuotes={extraQuotes}
                  exchangeRate={exchangeRate}
                  forceExpanded={post.id === selectedPostId}
                  enableImagePreview={false}
                  onOpenPost={(nextPostId) => router.push(`/community/${nextPostId}`)}
                  canModerate={user.role === "ADMIN"}
                  onAuthorClick={(nextUserId) => router.push(`/community/users/${nextUserId}`)}
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
              {users.slice(0, 3).map((communityUser) => (
                <div key={communityUser.id} className="rounded-md border border-[#eef1f6] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Button
                        variant="link"
                        onClick={() => router.push(`/community/users/${communityUser.id}`)}
                        className="block max-w-full truncate text-sm"
                      >
                        {communityUser.nickname}
                        {communityUser.isMe ? " · 나" : ""}
                      </Button>
                      <p className="truncate text-xs text-muted">
                        구독자 {communityUser.subscriberCount} · 구독중 {communityUser.followingCount}
                      </p>
                    </div>
                    {!communityUser.isMe ? (
                      <Button
                        variant={communityUser.isSubscribed ? "secondary" : "primary"}
                        size="sm"
                        onClick={() => toggleSubscription(communityUser.id)}
                      >
                        {communityUser.isSubscribed ? "구독중" : "구독"}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
    </>
  );
}

function resolveCommunityStockTag(tag: StockTag, stockSymbols: StockSymbol[]): StockTag {
  const exact = stockSymbols.find(
    (item) => item.symbol.toUpperCase() === tag.symbol.toUpperCase(),
  );
  const resolved =
    exact ??
    stockSymbols
      .map((item) => ({ item, score: stockSearchScore(item, tag.symbol) }))
      .filter((result) => result.score >= 50)
      .sort((a, b) => b.score - a.score)[0]?.item;

  return {
    symbol: resolved?.symbol ?? tag.symbol.toUpperCase(),
    name: resolved?.description ?? tag.name,
    market: resolved ? (resolved.currency === "KRW" ? "KR" : "US") : tag.market,
  };
}
