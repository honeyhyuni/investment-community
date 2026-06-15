"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/common/lib/api";
import { resolveCommunityStockTag } from "@/domain/community/utils";
import { useMarketDataStore } from "@/common/stores/market-data";
import { useSessionStore } from "@/common/stores/session";
import { usePreferencesStore } from "@/common/stores/preferences";
import { CommunityPost, StockTag } from "@/domain/community/types";

/**
 * 리스트/상세가 공유하는 게시글 상태 + 변이 핸들러.
 * posts 로딩 전략은 화면마다 달라(feed vs 단일글) 각 페이지가 setPosts로 채운다.
 */
export function useCommunityPosts() {
  const router = useRouter();
  const accessToken = useSessionStore((s) => s.accessToken);
  const ko = usePreferencesStore((s) => s.language) === "ko";
  const usSymbols = useMarketDataStore((s) => s.usSymbols);
  const krSymbols = useMarketDataStore((s) => s.krSymbols);
  const loadStockQuotes = useMarketDataStore((s) => s.loadStockQuotes);

  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  const stockSymbols = useMemo(() => [...krSymbols, ...usSymbols], [krSymbols, usSymbols]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    const tags = posts
      .flatMap((post) => post.stockTags)
      .map((tag) => resolveCommunityStockTag(tag, stockSymbols));
    if (tags.length > 0) {
      loadStockQuotes(tags, accessToken);
    }
  }, [accessToken, loadStockQuotes, posts, stockSymbols]);

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
    const next = window.prompt(ko ? "댓글 수정" : "Edit comment", content);
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
    if (!accessToken || !window.confirm(ko ? "이 댓글을 삭제할까요?" : "Delete this comment?")) {
      return;
    }
    const post = await apiRequest<CommunityPost>(`/community/comments/${commentId}`, "DELETE", {
      accessToken,
    });
    setPosts((current) => current.map((item) => (item.id === post.id ? post : item)));
  }

  /** 삭제 성공 시 true. (취소/미인증이면 false → 호출부가 네비게이션 결정에 사용) */
  async function deletePost(postId: string): Promise<boolean> {
    if (!accessToken || !window.confirm(ko ? "이 게시글을 삭제할까요?" : "Delete this post?")) {
      return false;
    }
    await apiRequest<{ ok: true }>(`/community/posts/${postId}`, "DELETE", { accessToken });
    setPosts((current) => current.filter((post) => post.id !== postId));
    return true;
  }

  function openStock(tag: StockTag) {
    const resolvedTag = resolveCommunityStockTag(tag, stockSymbols);
    const currency = resolvedTag.market === "KR" ? "KRW" : "USD";
    router.push(
      `/?symbol=${encodeURIComponent(resolvedTag.symbol)}&market=${resolvedTag.market}&currency=${currency}`,
    );
  }

  return {
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
  };
}
