"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Notice } from "@/common/components/Notice";
import { apiRequest } from "@/common/lib/api";
import {
  NEW_POST_TEMPLATE,
  getPostHtml,
  htmlToPlainText,
  makeEditorBlockId,
  resolveCommunityStockTag,
} from "@/common/utils/community";
import { useMarketDataStore } from "@/common/stores/market-data";
import { useSessionStore } from "@/common/stores/session";
import { CommunityContentBlock, CommunityPost, StockTag } from "@/domain/community/types";
import { PostEditor } from "@/domain/community/components/PostEditor";

/** 새 글(`/community/new`) · 수정(`/community/[postId]/edit`) 공유 에디터 라우트. */
export function PostEditorPage({ postId }: { postId?: string }) {
  const router = useRouter();
  const accessToken = useSessionStore((s) => s.accessToken);
  const usStocks = useMarketDataStore((s) => s.usStocks);
  const usSymbols = useMarketDataStore((s) => s.usSymbols);
  const krStocks = useMarketDataStore((s) => s.krStocks);
  const krSymbols = useMarketDataStore((s) => s.krSymbols);
  const livePrices = useMarketDataStore((s) => s.livePrices);
  const extraQuotes = useMarketDataStore((s) => s.extraQuotes);
  const exchangeRate = useMarketDataStore((s) => s.exchangeRate);
  const loadStockQuotes = useMarketDataStore((s) => s.loadStockQuotes);

  const [title, setTitle] = useState("");
  const [blocks, setBlocks] = useState<CommunityContentBlock[]>([
    { id: makeEditorBlockId(), type: "text", text: NEW_POST_TEMPLATE },
  ]);
  const [tagQuery, setTagQuery] = useState("");
  const [tags, setTags] = useState<StockTag[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const stockSymbols = useMemo(() => [...krSymbols, ...usSymbols], [krSymbols, usSymbols]);

  // 수정 모드: 기존 글을 불러와 에디터에 prefill
  const loadExistingPost = useCallback(async (token: string, targetId: string) => {
    setLoading(true);
    setError("");
    try {
      const post = await apiRequest<CommunityPost>(
        `/community/posts/${encodeURIComponent(targetId)}`,
        "GET",
        { accessToken: token },
      );
      setTitle(post.title ?? "");
      setBlocks([{ id: makeEditorBlockId(), type: "text", text: getPostHtml(post) }]);
      setTags(post.stockTags);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load post.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!accessToken || !postId) {
      return;
    }
    queueMicrotask(() => {
      loadExistingPost(accessToken, postId);
    });
  }, [accessToken, postId, loadExistingPost]);

  // 태그 칩 시세 표시용 quote 로딩
  useEffect(() => {
    if (!accessToken || tags.length === 0) {
      return;
    }
    loadStockQuotes(
      tags.map((tag) => resolveCommunityStockTag(tag, stockSymbols)),
      accessToken,
    );
  }, [accessToken, loadStockQuotes, tags, stockSymbols]);

  async function savePost() {
    const html = blocks.find((block) => block.type === "text")?.text?.trim() ?? "";
    const contentBlocks: CommunityContentBlock[] = html
      ? [{ id: blocks[0]?.id ?? makeEditorBlockId(), type: "text", text: html }]
      : [];
    const plainContent = htmlToPlainText(html).slice(0, 50000);

    if (!accessToken || (!title.trim() && contentBlocks.length === 0)) {
      return;
    }

    setLoading(true);
    setError("");
    try {
      const result = await apiRequest<CommunityPost>(
        postId ? `/community/posts/${postId}` : "/community/posts",
        postId ? "PATCH" : "POST",
        {
          accessToken,
          body: {
            title,
            content: plainContent,
            contentBlocks,
            stockTags: tags,
            imageUrls: [],
          },
        },
      );
      router.push(`/community/${postId ?? result.id}`);
    } catch (postError) {
      setError(postError instanceof Error ? postError.message : "Could not post.");
      setLoading(false);
    }
  }

  return (
    <>
      {error ? <Notice message="" error={error} /> : null}

      <div className="flex-1 py-4 sm:py-6">
        <PostEditor
          title={title}
          setTitle={setTitle}
          blocks={blocks}
          setBlocks={setBlocks}
          tagQuery={tagQuery}
          setTagQuery={setTagQuery}
          tags={tags}
          setTags={setTags}
          stockSymbols={stockSymbols}
          usStocks={usStocks}
          krStocks={krStocks}
          livePrices={livePrices}
          extraQuotes={extraQuotes}
          exchangeRate={exchangeRate}
          editingPostId={postId ?? null}
          loading={loading}
          onSubmit={savePost}
          onCancel={() => router.back()}
        />
      </div>
    </>
  );
}
