"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/common/lib/api";
import { resolveCommunityStockTag } from "@/domain/community/utils";
import { useMarketDataStore } from "@/common/stores/market-data";
import { useSessionStore } from "@/common/stores/session";
import { usePreferencesStore } from "@/common/stores/preferences";
import { CommunityPost, StockTag } from "@/domain/community/types";

const EMPTY_SYMBOLS = [] as const;

export function useCommunityPosts({ resolveTags = false } = {}) {
  const router = useRouter();
  const accessToken = useSessionStore((s) => s.accessToken);
  const ko = usePreferencesStore((s) => s.language) === "ko";
  const usSymbols = useMarketDataStore((s) => (resolveTags ? s.usSymbols : EMPTY_SYMBOLS));
  const krSymbols = useMarketDataStore((s) => (resolveTags ? s.krSymbols : EMPTY_SYMBOLS));

  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  const stockSymbols = useMemo(() => [...krSymbols, ...usSymbols], [krSymbols, usSymbols]);

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

  async function toggleBookmark(postId: string) {
    if (!accessToken) return;
    try {
      const result = await apiRequest<{ bookmarked: boolean }>(
        `/community/posts/${postId}/bookmark`, "POST", { accessToken },
      );
      setPosts((current) => current.map((post) =>
        post.id === postId ? { ...post, bookmarkedByMe: result.bookmarked } : post,
      ));
    } catch (bookmarkError) {
      setError(bookmarkError instanceof Error ? bookmarkError.message : "Could not bookmark.");
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
    if (!accessToken || !window.confirm(ko ? "댓글을 삭제할까요?" : "Delete this comment?")) {
      return;
    }
    const post = await apiRequest<CommunityPost>(`/community/comments/${commentId}`, "DELETE", {
      accessToken,
    });
    setPosts((current) => current.map((item) => (item.id === post.id ? post : item)));
  }

  async function deletePost(postId: string): Promise<boolean> {
    if (!accessToken || !window.confirm(ko ? "게시글을 삭제할까요?" : "Delete this post?")) {
      return false;
    }
    await apiRequest<{ ok: true }>(`/community/posts/${postId}`, "DELETE", { accessToken });
    setPosts((current) => current.filter((post) => post.id !== postId));
    return true;
  }

  function openStock(tag: StockTag) {
    const resolvedTag = resolveTags ? resolveCommunityStockTag(tag, stockSymbols) : tag;
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
    toggleBookmark,
    createComment,
    editComment,
    deleteComment,
    deletePost,
    openStock,
  };
}
