"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Notice } from "@/common/components/Notice";
import { apiRequest, CommunityImageUpload, deleteCommunityImage } from "@/common/lib/api";
import { isDemoUser } from "@/common/lib/demo-user";
import {
  NEW_POST_TEMPLATE,
  getPostHtml,
  htmlToPlainText,
  makeEditorBlockId,
  resolveCommunityStockTag,
} from "@/domain/community/utils";
import { useMarketDataStore } from "@/common/stores/market-data";
import { useSessionStore } from "@/common/stores/session";
import { CommunityContentBlock, CommunityPost, StockTag } from "@/domain/community/types";
import { PostEditor } from "@/domain/community/components/PostEditor";

const COMMUNITY_DRAFT_VERSION = 1;

type CommunityPostDraft = {
  version: typeof COMMUNITY_DRAFT_VERSION;
  title: string;
  blocks: CommunityContentBlock[];
  tags: StockTag[];
  isPublic?: boolean;
  savedAt: string;
};

function readCommunityDraft(key: string): CommunityPostDraft | null {
  try {
    const value = window.localStorage.getItem(key);
    if (!value) {
      return null;
    }
    const draft = JSON.parse(value) as Partial<CommunityPostDraft>;
    if (
      draft.version !== COMMUNITY_DRAFT_VERSION ||
      typeof draft.title !== "string" ||
      !Array.isArray(draft.blocks) ||
      !Array.isArray(draft.tags) ||
      typeof draft.savedAt !== "string"
    ) {
      return null;
    }
    return draft as CommunityPostDraft;
  } catch {
    return null;
  }
}

/** 새 글(`/community/new`) · 수정(`/community/[postId]/edit`) 공유 에디터 라우트. */
export function PostEditorPage({ postId }: { postId?: string }) {
  const router = useRouter();
  const accessToken = useSessionStore((s) => s.accessToken);
  const userId = useSessionStore((s) => s.user?.id ?? null);
  const user = useSessionStore((s) => s.user);
  const usStocks = useMarketDataStore((s) => s.usStocks);
  const usSymbols = useMarketDataStore((s) => s.usSymbols);
  const krStocks = useMarketDataStore((s) => s.krStocks);
  const krSymbols = useMarketDataStore((s) => s.krSymbols);
  const livePrices = useMarketDataStore((s) => s.livePrices);
  const extraQuotes = useMarketDataStore((s) => s.extraQuotes);
  const exchangeRate = useMarketDataStore((s) => s.exchangeRate);
  const loadStockSymbols = useMarketDataStore((s) => s.loadStockSymbols);
  const loadStockQuotes = useMarketDataStore((s) => s.loadStockQuotes);

  const [title, setTitle] = useState("");
  const [blocks, setBlocks] = useState<CommunityContentBlock[]>([
    { id: makeEditorBlockId(), type: "text", text: NEW_POST_TEMPLATE },
  ]);
  const [tagQuery, setTagQuery] = useState("");
  const [tags, setTags] = useState<StockTag[]>([]);
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const [draftError, setDraftError] = useState("");
  const [uploadedImages, setUploadedImages] = useState<CommunityImageUpload[]>([]);
  const readOnly = isDemoUser(user);

  const stockSymbols = useMemo(() => [...krSymbols, ...usSymbols], [krSymbols, usSymbols]);
  const draftKey = useMemo(
    () => userId ? `15f:community-draft:${userId}:${postId ?? "new"}` : null,
    [postId, userId],
  );

  const restoreDraft = useCallback((key: string) => {
    const draft = readCommunityDraft(key);
    if (!draft) {
      return false;
    }
    setTitle(draft.title);
    setBlocks(draft.blocks.length ? draft.blocks : [
      { id: makeEditorBlockId(), type: "text", text: "" },
    ]);
    setTags(draft.tags);
    setIsPublic(draft.isPublic ?? true);
    setDraftSavedAt(draft.savedAt);
    setDraftRestored(true);
    return true;
  }, []);

  useEffect(() => {
    if (readOnly) {
      router.replace("/community");
      return;
    }
    if (accessToken) {
      void loadStockSymbols(accessToken);
    }
  }, [accessToken, loadStockSymbols, readOnly, router]);

  // 수정 모드: 기존 글을 불러와 에디터에 prefill
  const loadExistingPost = useCallback(async (token: string, targetId: string, key: string) => {
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
      setIsPublic(post.isPublic);
      restoreDraft(key);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load post.");
    } finally {
      setLoading(false);
      setDraftReady(true);
    }
  }, [restoreDraft]);

  useEffect(() => {
    if (!accessToken || !postId || !draftKey) {
      return;
    }
    queueMicrotask(() => {
      loadExistingPost(accessToken, postId, draftKey);
    });
  }, [accessToken, draftKey, postId, loadExistingPost]);

  useEffect(() => {
    if (!accessToken || postId || !draftKey) {
      return;
    }
    queueMicrotask(() => {
      restoreDraft(draftKey);
      setDraftReady(true);
    });
  }, [accessToken, draftKey, postId, restoreDraft]);

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

  const saveDraft = useCallback((manual = true) => {
    if (!draftKey || !draftReady) {
      return;
    }
    const html = blocks.find((block) => block.type === "text")?.text ?? "";
    const untouchedNewPost =
      !postId && !title.trim() && html === NEW_POST_TEMPLATE && tags.length === 0;
    if (!manual && untouchedNewPost) {
      return;
    }

    const savedAt = new Date().toISOString();
    const draft: CommunityPostDraft = {
      version: COMMUNITY_DRAFT_VERSION,
      title,
      blocks,
      tags,
      isPublic,
      savedAt,
    };
    try {
      window.localStorage.setItem(draftKey, JSON.stringify(draft));
      setDraftSavedAt(savedAt);
      setDraftRestored(false);
      setDraftError("");
    } catch {
      setDraftError("임시저장 공간이 부족합니다. 큰 이미지를 줄인 뒤 다시 시도해 주세요.");
    }
  }, [blocks, draftKey, draftReady, isPublic, postId, tags, title]);

  useEffect(() => {
    if (!draftReady) {
      return;
    }
    const timeout = window.setTimeout(() => saveDraft(false), 1200);
    return () => window.clearTimeout(timeout);
  }, [draftReady, saveDraft]);

  async function cleanupUploads(html = "") {
    if (!accessToken) return;
    const used = new Set([...html.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi)].map((match) => match[1]));
    await Promise.allSettled(uploadedImages.filter((image) => !used.has(image.url)).map((image) => deleteCommunityImage(image.id, accessToken)));
  }

  async function cancelEditor() {
    await cleanupUploads();
    router.back();
  }

  async function savePost() {
    const html = blocks.find((block) => block.type === "text")?.text?.trim() ?? "";
    const contentBlocks: CommunityContentBlock[] = html
      ? [{ id: blocks[0]?.id ?? makeEditorBlockId(), type: "text", text: html }]
      : [];
    const plainContent = htmlToPlainText(html).slice(0, 50000);

    if (readOnly || !accessToken || (!title.trim() && contentBlocks.length === 0)) {
      return;
    }

    setLoading(true);
    setError("");
    try {
      await cleanupUploads(html);
      const imageUrls = [...new Set([...html.matchAll(/<img\b[^>]*\bsrc=["'](\/uploads\/community\/[^"']+)["']/gi)].map((match) => match[1]))];
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
            imageUrls,
            isPublic,
          },
        },
      );
      if (draftKey) {
        window.localStorage.removeItem(draftKey);
      }
      setUploadedImages([]);
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
          isPublic={isPublic}
          setIsPublic={setIsPublic}
          stockSymbols={stockSymbols}
          usStocks={usStocks}
          krStocks={krStocks}
          livePrices={livePrices}
          extraQuotes={extraQuotes}
          exchangeRate={exchangeRate}
          editingPostId={postId ?? null}
          loading={loading}
          draftSavedAt={draftSavedAt}
          draftRestored={draftRestored}
          draftError={draftError}
          onSaveDraft={() => saveDraft(true)}
          onSubmit={savePost}
          onCancel={() => void cancelEditor()}
          accessToken={accessToken}
          onUploadedImage={(image) => setUploadedImages((items) => [...items, image])}
        />
      </div>
    </>
  );
}
