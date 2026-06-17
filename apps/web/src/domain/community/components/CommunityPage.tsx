"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, FileText, Plus, Users } from "lucide-react";
import { Notice } from "@/common/components/Notice";
import { Button } from "@/common/components/Button";
import { SegmentedControl } from "@/common/components/SegmentedControl";
import { Skeleton } from "@/common/components/Skeleton";
import { cn } from "@/common/utils/cn";
import { apiRequest } from "@/common/lib/api";
import { resolveCommunityStockTag } from "@/domain/community/utils";
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

// 무한스크롤 페이지 크기: 처음 3개, 끝에 닿을 때마다 3개씩 추가.
const FEED_PAGE_SIZE = 3;

// 피드 로딩 중 게시글 카드 자리를 잡아주는 스켈레톤.
function PostCardSkeleton() {
  return (
    <div className="rounded-lg border border-[#d9dee8] bg-white p-4 shadow-sm">
      <Skeleton className="h-6 w-2/3" />
      <div className="mt-3 flex items-center gap-2">
        <Skeleton className="size-6 rounded-full" />
        <Skeleton className="h-3 w-28" />
      </div>
      <div className="mt-4 space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-11/12" />
        <Skeleton className="h-3 w-3/4" />
      </div>
      <div className="mt-4 flex gap-2 border-t border-border pt-3">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 w-16" />
      </div>
    </div>
  );
}

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
  const [userProfile, setUserProfile] = useState<CommunityUser | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [scope, setScope] = useState<CommunityScope>("all");
  const [sort, setSort] = useState<FeedSort>("latest");
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const effectiveScope: CommunityScope | "user" = userId ? "user" : scope;

  const offsetRef = useRef(0);
  const hasMoreRef = useRef(true);
  const loadingRef = useRef(false);
  // 진행 중인 요청을 식별해 scope/sort 전환 시 늦게 온 응답이 덮어쓰지 않게 한다.
  const reqIdRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const feedUrl = useCallback(
    (offset: number) =>
      `/community/feed?scope=${effectiveScope}&sort=${sort}${
        userId ? `&userId=${encodeURIComponent(userId)}` : ""
      }&limit=${FEED_PAGE_SIZE}&offset=${offset}`,
    [effectiveScope, sort, userId],
  );

  const loadUsers = useCallback(async () => {
    if (!accessToken) {
      return;
    }
    try {
      const usersResult = await apiRequest<CommunityUser[]>("/community/users", "GET", {
        accessToken,
      });
      setUsers(usersResult);
    } catch {
      // 사이드바 멤버 목록 실패는 피드 자체를 막지 않는다.
    }
  }, [accessToken]);

  // 유저 피드: 추천 목록이 아닌 단일 프로필을 직접 조회한다(본인/구독 여부·구독자 수 정확).
  const loadUserProfile = useCallback(async () => {
    if (!accessToken || !userId) {
      setUserProfile(null);
      return;
    }
    setProfileLoading(true);
    try {
      const profileResult = await apiRequest<CommunityUser>(
        `/community/users/${encodeURIComponent(userId)}`,
        "GET",
        { accessToken },
      );
      setUserProfile(profileResult);
    } catch {
      setUserProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, [accessToken, userId]);

  // 처음부터 다시 로드 (scope/sort/userId 변경, 구독 토글 시).
  const reloadFeed = useCallback(async () => {
    if (!accessToken) {
      return;
    }
    const reqId = ++reqIdRef.current;
    loadingRef.current = true;
    offsetRef.current = 0;
    hasMoreRef.current = true;
    setHasMore(true);
    setLoading(true);
    setError("");
    try {
      const result = await apiRequest<CommunityPost[]>(feedUrl(0), "GET", { accessToken });
      if (reqId !== reqIdRef.current) {
        return;
      }
      offsetRef.current = result.length;
      hasMoreRef.current = result.length === FEED_PAGE_SIZE;
      setHasMore(hasMoreRef.current);
      setPosts(result);
    } catch (feedError) {
      if (reqId === reqIdRef.current) {
        setError(
          feedError instanceof Error ? feedError.message : "Could not load community.",
        );
      }
    } finally {
      if (reqId === reqIdRef.current) {
        loadingRef.current = false;
        setLoading(false);
      }
    }
  }, [accessToken, feedUrl, setPosts, setError]);

  // 끝에 닿으면 다음 페이지를 이어 붙인다.
  const loadMore = useCallback(async () => {
    if (!accessToken || loadingRef.current || !hasMoreRef.current) {
      return;
    }
    const reqId = reqIdRef.current;
    loadingRef.current = true;
    setLoadingMore(true);
    try {
      const result = await apiRequest<CommunityPost[]>(
        feedUrl(offsetRef.current),
        "GET",
        { accessToken },
      );
      if (reqId !== reqIdRef.current) {
        return;
      }
      offsetRef.current += result.length;
      hasMoreRef.current = result.length === FEED_PAGE_SIZE;
      setHasMore(hasMoreRef.current);
      setPosts((prev) => [...prev, ...result]);
    } catch (feedError) {
      if (reqId === reqIdRef.current) {
        setError(
          feedError instanceof Error ? feedError.message : "Could not load more posts.",
        );
      }
    } finally {
      if (reqId === reqIdRef.current) {
        loadingRef.current = false;
      }
      setLoadingMore(false);
    }
  }, [accessToken, feedUrl, setPosts, setError]);

  // 데이터 로딩(fetch-on-mount) effect — 내부에서 로딩 상태를 setState 한다.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reloadFeed();
  }, [reloadFeed]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadUserProfile();
  }, [loadUserProfile]);

  // 리스트 끝 센티넬이 보이면 다음 페이지 로드.
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadMore();
        }
      },
      { rootMargin: "240px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore, hasMore, posts.length]);

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
      await Promise.all([loadUsers(), reloadFeed(), loadUserProfile()]);
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

  // 정렬 필터 버튼 (최신순/인기순) — 데스크톱은 툴바 안, 모바일은 툴바 아래에서 재사용.
  const sortButtons = (["latest", "popular"] as FeedSort[]).map((item) => {
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
  });

  const feedList = (
    <div className="grid gap-4">
      {loading && posts.length === 0 ? (
        <>
          <PostCardSkeleton />
          <PostCardSkeleton />
          <PostCardSkeleton />
        </>
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
      {hasMore && posts.length > 0 ? (
        <div ref={sentinelRef} aria-hidden className="h-1" />
      ) : null}
      {loadingMore ? <PostCardSkeleton /> : null}
    </div>
  );

  // 유저 피드 — scope 탭/사이드바 없이 해당 유저 글 목록만
  if (userId) {
    const profile = userProfile;
    const profileName = profile?.nickname ?? posts[0]?.author.nickname ?? "";
    return (
      <>
        {error ? <Notice message="" error={error} /> : null}

        <div className="flex-1 py-4 sm:py-6">
          <div className="mb-4 flex items-center gap-2 sm:mb-5">
            <Button
              variant="secondary"
              leftIcon={<ChevronLeft />}
              onClick={() =>
                window.history.length > 1 ? router.back() : router.push("/community")
              }
              className="h-11 shrink-0 text-primary sm:h-10"
            >
              {ko ? "뒤로" : "Back"}
            </Button>

            {/* 이름 섹션 — 뒤로 버튼과 높이 동일(h-11/sm:h-10) */}
            <div className="flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-md border border-border bg-white px-3 shadow-sm sm:h-10 sm:px-4">
              <span
                aria-hidden
                className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold uppercase text-primary"
              >
                {profileName ? profileName.charAt(0) : "·"}
              </span>
              {profileName ? (
                <h1 className="min-w-0 truncate text-base font-semibold text-foreground sm:text-lg">
                  {ko ? `${profileName}님` : profileName}
                </h1>
              ) : (
                <Skeleton className="h-4 w-28" />
              )}
              <div className="ml-auto hidden shrink-0 items-center gap-1.5 sm:flex">
                <span className="inline-flex items-center gap-1 rounded-full bg-surface-subtle px-2.5 py-1 text-xs font-semibold text-muted">
                  <FileText size={13} className="text-primary" />
                  {ko
                    ? `게시글 ${profile?.postCount ?? 0}개`
                    : `${profile?.postCount ?? 0} posts`}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-surface-subtle px-2.5 py-1 text-xs font-semibold text-muted">
                  <Users size={13} className="text-primary" />
                  {ko
                    ? `구독자 ${profile?.subscriberCount ?? 0}명`
                    : `${profile?.subscriberCount ?? 0} followers`}
                </span>
              </div>
            </div>

            {profileLoading && !profile ? (
              <Skeleton className="h-11 w-20 shrink-0 sm:h-10" />
            ) : profile?.isMe ? (
              <Button
                variant="secondary"
                disabled
                className="h-11 shrink-0 sm:h-10"
              >
                {ko ? "내 피드" : "My feed"}
              </Button>
            ) : profile ? (
              <Button
                variant={profile.isSubscribed ? "secondary" : "primary"}
                onClick={() => toggleSubscription(profile.id)}
                className="h-11 shrink-0 sm:h-10"
              >
                {profile.isSubscribed ? (ko ? "구독중" : "Following") : ko ? "구독" : "Follow"}
              </Button>
            ) : null}
          </div>

          {/* 모바일: 구독자 수를 헤더 아래에 따로 노출 */}
          {profile ? (
            <p className="mb-4 flex items-center gap-1.5 text-xs font-semibold text-muted sm:hidden">
              <FileText size={13} className="text-primary" />
              {ko ? `게시글 ${profile.postCount}개` : `${profile.postCount} posts`}
              <span aria-hidden className="text-border-strong">·</span>
              <Users size={13} className="text-primary" />
              {ko
                ? `구독자 ${profile.subscriberCount}명 · 구독중 ${profile.followingCount}명`
                : `${profile.subscriberCount} followers · ${profile.followingCount} following`}
            </p>
          ) : null}

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
          <div className="-mx-4 flex items-center gap-2 border-y border-[#d9dee8] bg-surface p-3 shadow-sm sm:mx-0 sm:rounded-lg sm:border">
            {/* 스코프 탭 (세그먼티드 컨트롤) */}
            <SegmentedControl
              className="flex-1 sm:inline-flex sm:flex-none"
              aria-label={ko ? "피드 범위" : "Feed scope"}
              options={(["all", "subscribed", "mine"] as CommunityScope[]).map((item) => ({
                value: item,
                label:
                  item === "all"
                    ? ko
                      ? "전체 피드"
                      : "All"
                    : item === "subscribed"
                      ? ko
                        ? "구독 피드"
                        : "Following"
                      : ko
                        ? "내 피드"
                        : "Mine",
              }))}
              value={scope}
              onChange={setScope}
            />

            {/* 정렬 필터 (최신순 / 인기순) — 데스크톱에서만 툴바 안에 표시 */}
            <div className="hidden shrink-0 gap-1.5 sm:flex">{sortButtons}</div>

            {/* 글 쓰기 — 데스크톱에서만 툴바 안에 표시 */}
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus />}
              onClick={() => router.push("/community/new")}
              className="ml-auto hidden shrink-0 sm:inline-flex"
            >
              {ko ? "글 쓰기" : "New post"}
            </Button>
          </div>

          {/* 모바일: 정렬 필터(왼쪽) + 글 쓰기(오른쪽 끝)를 툴바 아래·피드 위에 표시 */}
          <div className="flex items-center gap-1.5 sm:hidden">
            {sortButtons}
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus />}
              onClick={() => router.push("/community/new")}
              className="ml-auto shrink-0"
            >
              {ko ? "글 쓰기" : "New post"}
            </Button>
          </div>

          {feedList}
        </div>

        <aside className="hidden rounded-lg border border-[#d9dee8] bg-white p-4 shadow-sm lg:sticky lg:top-[calc(5.5rem+env(safe-area-inset-top))] lg:block lg:self-start">
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
