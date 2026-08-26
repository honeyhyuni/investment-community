"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Notice } from "@/common/components/Notice";
import { Button } from "@/common/components/Button";
import { apiRequest } from "@/common/lib/api";
import { isDemoUser } from "@/common/lib/demo-user";
import { useMarketDataStore } from "@/common/stores/market-data";
import { useSessionStore } from "@/common/stores/session";
import { usePreferencesStore } from "@/common/stores/preferences";
import { CommunityPost } from "@/domain/community/types";
import { PostCard } from "@/domain/community/components/PostCard";
import { useCommunityPosts } from "@/domain/community/hooks/useCommunityPosts";

export function PostDetailPage({ postId }: { postId: string }) {
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
    toggleLike,
    createComment,
    editComment,
    deleteComment,
    deletePost,
    openStock,
  } = useCommunityPosts();

  const [loading, setLoading] = useState(false);

  const loadPost = useCallback(
    async (token: string) => {
      setLoading(true);
      setError("");
      try {
        const post = await apiRequest<CommunityPost>(
          `/community/posts/${encodeURIComponent(postId)}`,
          "GET",
          { accessToken: token },
        );
        setPosts([post]);
      } catch (detailError) {
        setPosts([]);
        setError(
          detailError instanceof Error ? detailError.message : "Could not load community post.",
        );
      } finally {
        setLoading(false);
      }
    },
    [postId, setPosts, setError],
  );

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    queueMicrotask(() => {
      loadPost(accessToken);
    });
  }, [accessToken, loadPost]);

  if (!user) {
    return null;
  }

  const post = posts[0];
  const readOnly = isDemoUser(user);

  return (
    <>
      {error ? <Notice message="" error={error} /> : null}

      <div className="flex-1 py-4 sm:py-6">
        <div className="mb-4">
          <Button
            variant="secondary"
            leftIcon={<ChevronLeft />}
            onClick={() =>
              window.history.length > 1 ? router.back() : router.push("/community")
            }
            className="text-primary"
          >
            {ko ? "뒤로" : "Back"}
          </Button>
        </div>

        <div className="grid gap-4">
          {loading && !post ? (
            <p className="rounded-lg border border-[#d9dee8] bg-white p-8 text-center text-sm text-[#607086]">
              {ko ? "불러오는 중입니다." : "Loading…"}
            </p>
          ) : null}
          {!loading && !post ? (
            <p className="rounded-lg border border-[#d9dee8] bg-white p-8 text-center text-sm text-[#607086]">
              {ko ? "표시할 피드가 없습니다." : "No posts to show."}
            </p>
          ) : null}
          {post ? (
            <PostCard
              post={post}
              currentUserId={user.id}
              commentDrafts={commentDrafts}
              setCommentDrafts={setCommentDrafts}
              replyDrafts={replyDrafts}
              setReplyDrafts={setReplyDrafts}
              onLike={toggleLike}
              onComment={createComment}
              onEditPost={(target) => router.push(`/community/${target.id}/edit`)}
              onDeletePost={async (targetId) => {
                if (await deletePost(targetId)) {
                  router.push("/community");
                }
              }}
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
              readOnly={readOnly}
              onAuthorClick={(nextUserId) => router.push(`/community/users/${nextUserId}`)}
            />
          ) : null}
        </div>
      </div>
    </>
  );
}
