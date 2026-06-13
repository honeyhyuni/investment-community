"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Users } from "lucide-react";
import { Notice } from "@/common/components/Notice";
import { Button } from "@/common/components/Button";
import { cn } from "@/common/utils/cn";
import { apiRequest } from "@/common/lib/api";
import { resolveCommunityStockTag } from "@/common/utils/community";
import { useMarketDataStore } from "@/common/stores/market-data";
import { useSessionStore } from "@/common/stores/session";
import { usePreferencesStore } from "@/common/stores/preferences";
import {
  CommunityPost,
  CommunityScope,
  CommunityUser,
  FeedSort,
} from "@/domain/community/types";
import { PostCard } from "@/domain/community/components/PostCard";
import { useCommunityPosts } from "@/domain/community/hooks/useCommunityPosts";

export function CommunityPage({ userId }: { userId?: string }) {
  const router = useRouter();
  const accessToken = useSessionStore((s) => s.accessToken);
  const user = useSessionStore((s) => s.user);
  const ko = usePreferencesStore((s) => s.language) === "ko";
  const usStocks = useMarketDataStore((s) => s.usStocks);
  const krStocks = useMarketDataStore((s) => s.krStocks);
  const livePrices = useMarketDataStore((s) => s.livePrices);
  const extraQuotes = useMarketDataStore((s) => s.extraQuotes);
  const exchangeRate = useMarketDataStore((s) => s.exchangeRate);

  const {
    posts,
    setPosts,
    commentDrafts,
    setCommentDrafts,
    replyDrafts,
    setReplyDrafts,
    error,
    setError,
    stockSymbols,
    toggleLike,
    createComment,
    editComment,
    deleteComment,
    deletePost,
    openStock,
  } = useCommunityPosts();

  const [users, setUsers] = useState<CommunityUser[]>([]);
  const [scope, setScope] = useState<CommunityScope>("all");
  const [sort, setSort] = useState<FeedSort>("latest");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    loadCommunity(accessToken, userId ? "user" : scope, sort, userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, scope, sort, userId]);

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

  async function toggleSubscription(targetUserId: string) {
    if (!accessToken) {
      return;
    }
    try {
      await apiRequest<{ subscribed: boolean }>(
        `/community/users/${targetUserId}/subscribe`,
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

  if (!user) {
    return null;
  }

  const feedList = (
    <div className="grid gap-4">
      {loading && posts.length === 0 ? (
        <p className="rounded-lg border border-[#d9dee8] bg-white p-8 text-center text-sm text-[#607086]">
          {ko ? "불러오는 중입니다." : "Loading…"}
        </p>
      ) : null}
      {!loading && posts.length === 0 ? (
        <p className="rounded-lg border border-[#d9dee8] bg-white p-8 text-center text-sm text-[#607086]">
          {ko ? "표시할 피드가 없습니다." : "No posts to show."}
        </p>
      ) : null}
      {posts.map((post) => (
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
          onEditPost={(target) => router.push(`/community/${target.id}/edit`)}
          onDeletePost={deletePost}
          onEditComment={editComment}
          onDeleteComment={deleteComment}
          onStockTagClick={openStock}
          usStocks={usStocks}
          krStocks={krStocks}
          livePrices={livePrices}
          extraQuotes={extraQuotes}
          exchangeRate={exchangeRate}
          enableImagePreview={false}
          onOpenPost={(nextPostId) => router.push(`/community/${nextPostId}`)}
          canModerate={user.role === "ADMIN"}
          onAuthorClick={(nextUserId) => router.push(`/community/users/${nextUserId}`)}
        />
      ))}
    </div>
  );

  // 유저 피드 — scope 탭/사이드바 없이 해당 유저 글 목록만
  if (userId) {
    return (
      <>
        {error ? <Notice message="" error={error} /> : null}

        <div className="flex-1 py-4 sm:py-6">
          <div className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-between">
            <Button variant="secondary" onClick={() => router.push("/community")}>
              {ko ? "피드 목록으로" : "Back to feed"}
            </Button>
            <Button
              variant="primary"
              leftIcon={<Plus />}
              onClick={() => router.push("/community/new")}
            >
              {ko ? "피드 글 쓰기" : "New post"}
            </Button>
          </div>
          {feedList}
        </div>
      </>
    );
  }

  return (
    <>
      {error ? <Notice message="" error={error} /> : null}

      <div className="grid flex-1 gap-4 py-4 sm:gap-5 sm:py-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          {/* 피드 툴바 (탭 + 정렬 + 글쓰기) */}
          <div className="-mx-4 flex items-center gap-2 border-y border-[#d9dee8] bg-white p-3 shadow-sm sm:mx-0 sm:rounded-lg sm:border">
            {/* 스코프 탭 (세그먼티드 컨트롤) */}
            <div
              role="tablist"
              className="flex flex-1 gap-1 rounded-xl bg-surface-subtle p-1 sm:inline-flex sm:flex-none"
            >
              {(["all", "subscribed", "mine"] as CommunityScope[]).map((item) => {
                const active = scope === item;
                return (
                  <button
                    key={item}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setScope(item)}
                    className={cn(
                      "flex-1 cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold transition-all sm:flex-none",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-surface-subtle",
                      active
                        ? "bg-surface text-primary shadow-sm"
                        : "text-muted hover:bg-surface/60",
                    )}
                  >
                    {item === "all"
                      ? ko
                        ? "전체 피드"
                        : "All"
                      : item === "subscribed"
                        ? ko
                          ? "구독 피드"
                          : "Following"
                        : ko
                          ? "내 피드"
                          : "Mine"}
                  </button>
                );
              })}
            </div>

            {/* 정렬 필터 (최신순 / 인기순) */}
            <div className="flex shrink-0 gap-1.5">
              {(["latest", "popular"] as FeedSort[]).map((item) => {
                const active = sort === item;
                return (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSort(item)}
                    className={cn(
                      "cursor-pointer rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-surface text-foreground hover:bg-surface-muted",
                    )}
                  >
                    {item === "latest" ? (ko ? "최신순" : "Latest") : ko ? "인기순" : "Popular"}
                  </button>
                );
              })}
            </div>

            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus />}
              onClick={() => router.push("/community/new")}
              className="ml-auto shrink-0"
            >
              {ko ? "피드 글 쓰기" : "New post"}
            </Button>
          </div>

          {feedList}
        </div>

        <aside className="rounded-lg border border-[#d9dee8] bg-white p-4 shadow-sm lg:sticky lg:top-4 lg:self-start">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#344052]">{ko ? "구독" : "Following"}</h2>
            <Users size={16} className="text-[#607086]" />
          </div>
          <div className="mt-3 space-y-2">
            {users.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-xs text-muted">
                  {ko ? "아직 표시할 멤버가 없어요." : "No members to show yet."}
                </p>
              </div>
            ) : null}
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
                      {communityUser.isMe ? (ko ? " · 나" : " · You") : ""}
                    </Button>
                    <p className="truncate text-xs text-muted">
                      {ko
                        ? `구독자 ${communityUser.subscriberCount} · 구독중 ${communityUser.followingCount}`
                        : `${communityUser.subscriberCount} followers · ${communityUser.followingCount} following`}
                    </p>
                  </div>
                  {!communityUser.isMe ? (
                    <Button
                      variant={communityUser.isSubscribed ? "secondary" : "primary"}
                      size="sm"
                      onClick={() => toggleSubscription(communityUser.id)}
                    >
                      {communityUser.isSubscribed
                        ? ko
                          ? "구독중"
                          : "Following"
                        : ko
                          ? "구독"
                          : "Follow"}
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
