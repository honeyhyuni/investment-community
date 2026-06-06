"use client";

import { Dispatch, SetStateAction, useMemo, useState } from "react";
import { Image as ImageIcon, X } from "lucide-react";
import { MarkdownContent } from "@/common/components/MarkdownContent";
import { encodeImageForPost, makeEditorBlockId } from "@/common/lib/community";
import { stockSearchScore } from "@/common/lib/stock-search";
import { CommunityContentBlock, StockTag } from "@/domain/community/types";
import { MarketQuote, StockSymbol, TradeTick } from "@/common/types";
import { StockTagQuote } from "@/domain/community/components/StockTagQuote";

export function PostEditor({
  title,
  setTitle,
  blocks,
  setBlocks,
  tagQuery,
  setTagQuery,
  tags,
  setTags,
  stockSymbols,
  usStocks,
  krStocks,
  livePrices,
  editingPostId,
  loading,
  onSubmit,
  onCancel,
}: {
  title: string;
  setTitle: (value: string) => void;
  blocks: CommunityContentBlock[];
  setBlocks: Dispatch<SetStateAction<CommunityContentBlock[]>>;
  tagQuery: string;
  setTagQuery: (value: string) => void;
  tags: StockTag[];
  setTags: Dispatch<SetStateAction<StockTag[]>>;
  stockSymbols: StockSymbol[];
  usStocks: MarketQuote[];
  krStocks: MarketQuote[];
  livePrices: Record<string, TradeTick>;
  editingPostId: string | null;
  loading: boolean;
  onSubmit: () => Promise<void>;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<"write" | "preview">("write");
  const markdownText = blocks.find((block) => block.type === "text")?.text ?? "";
  const suggestions = useMemo(() => {
    const query = tagQuery.trim();
    if (!query) {
      return [];
    }
    return stockSymbols
      .map((item) => ({ item, score: stockSearchScore(item, query) }))
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((result) => result.item);
  }, [stockSymbols, tagQuery]);

  function setMarkdownText(text: string) {
    setBlocks([{ id: blocks[0]?.id ?? makeEditorBlockId(), type: "text", text }]);
  }

  function getTagQuote(tag: StockTag) {
    return (
      (tag.market === "KR" ? krStocks : usStocks).find(
        (item) => item.symbol === tag.symbol,
      ) ?? null
    );
  }

  async function insertImages(files: FileList | null) {
    if (!files) {
      return;
    }
    const selected = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, 8);
    const urls = await Promise.all(selected.map((file) => encodeImageForPost(file)));
    const markdown = urls.map((url) => `![image](${url})`).join("\n\n");
    setMarkdownText(`${markdownText}${markdownText ? "\n\n" : ""}${markdown}`);
  }

  return (
    <div className="rounded-lg border border-[#d9dee8] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between border-b border-[#eef1f6] pb-4">
        <p className="text-sm font-semibold text-[#344052]">
          {editingPostId ? "피드 수정" : "투자 글쓰기"}
        </p>
        <button
          onClick={onCancel}
          className="grid h-8 w-8 place-items-center rounded-md border border-[#c7ceda]"
          title="닫기"
        >
          <X size={15} />
        </button>
      </div>
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="제목: 예) 엔비디아 실적 이후 반도체 사이클 점검"
        className="mt-4 h-12 w-full rounded-md border border-[#c7ceda] px-3 text-lg font-semibold outline-none focus:border-[#1f6f8b]"
      />
      <div className="mt-4 overflow-hidden rounded-md border border-[#d9dee8] bg-white">
        <div className="flex items-center justify-between border-b border-[#d9dee8] bg-[#f9fafc] p-2">
          <div className="grid grid-cols-2 rounded-md border border-[#c7ceda] bg-white p-1">
            {(["write", "preview"] as const).map((item) => (
              <button
                key={item}
                onClick={() => setMode(item)}
                className={`h-8 rounded px-3 text-xs font-semibold ${
                  mode === item ? "bg-[#1f6f8b] text-white" : "text-[#607086]"
                }`}
              >
                {item === "write" ? "Markdown 작성" : "미리보기"}
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
                insertImages(event.target.files);
                event.currentTarget.value = "";
              }}
            />
          </label>
        </div>
        {mode === "write" ? (
          <textarea
            value={markdownText}
            onChange={(event) => setMarkdownText(event.target.value)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              insertImages(event.dataTransfer.files);
            }}
            placeholder={"# 제목\n\n자유롭게 글을 작성하세요.\n\n## 투자 근거\n- 항목 1\n- 항목 2"}
            className="min-h-[520px] w-full resize-y bg-white p-6 font-mono text-sm leading-7 text-[#344052] outline-none"
          />
        ) : (
          <div className="min-h-[520px] bg-white p-8">
            <MarkdownContent markdown={markdownText} />
          </div>
        )}
      </div>
      <div className="mt-4">
        <input
          value={tagQuery}
          onChange={(event) => setTagQuery(event.target.value.replace(/^#/, ""))}
          placeholder="태그할 종목 검색"
          className="h-10 w-full rounded-md border border-[#c7ceda] px-3 text-sm outline-none focus:border-[#1f6f8b]"
        />
        {suggestions.length ? (
          <div className="mt-2 grid gap-2 rounded-md border border-[#d9dee8] bg-[#f9fafc] p-2">
            {suggestions.map((item) => {
              const tag: StockTag = {
                symbol: item.symbol,
                name: item.description,
                market: item.currency === "KRW" ? "KR" : "US",
              };
              return (
                <button
                  key={item.symbol}
                  onClick={() => {
                    setTags((current) =>
                      current.some((existing) => existing.symbol === tag.symbol)
                        ? current
                        : [...current, tag],
                    );
                    setTagQuery("");
                  }}
                  className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-left text-sm"
                >
                  <span className="font-semibold">{item.symbol}</span>
                  <span className="truncate text-[#607086]">{item.description}</span>
                </button>
              );
            })}
          </div>
        ) : null}
        {tags.length ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <StockTagQuote
                key={tag.symbol}
                tag={tag}
                quote={getTagQuote(tag)}
                live={livePrices[tag.symbol]}
                onRemove={() =>
                  setTags((current) => current.filter((item) => item.symbol !== tag.symbol))
                }
              />
            ))}
          </div>
        ) : null}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="h-10 rounded-md border border-[#c7ceda] px-4 text-sm font-semibold"
        >
          취소
        </button>
        <button
          disabled={loading}
          onClick={onSubmit}
          className="h-10 rounded-md bg-[#1f6f8b] px-4 text-sm font-semibold text-white disabled:opacity-60"
        >
          {editingPostId ? "수정 완료" : "게시"}
        </button>
      </div>
    </div>
  );
}
