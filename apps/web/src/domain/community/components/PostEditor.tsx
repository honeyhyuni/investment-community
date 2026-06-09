"use client";

import { Dispatch, SetStateAction, useEffect, useMemo, useRef } from "react";
import { Image as ImageIcon, X } from "lucide-react";
import { useEditor, EditorContent } from "@tiptap/react";
import { Mark, mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { encodeImageForPost, makeEditorBlockId } from "@/common/utils/community";
import { stockSearchScore } from "@/common/utils/stock-search";
import { CommunityContentBlock, StockTag } from "@/domain/community/types";
import { MarketQuote, StockSymbol, TradeTick } from "@/common/types";
import { StockTagQuote } from "@/domain/community/components/StockTagQuote";

const StyledText = Mark.create({
  name: "styledText",
  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element) => element.style.color || null,
      },
      fontSize: {
        default: null,
        parseHTML: (element) => element.style.fontSize || null,
      },
    };
  },
  parseHTML() {
    return [{ tag: "span[style]" }];
  },
  renderHTML({ HTMLAttributes }) {
    const style = [
      HTMLAttributes.color ? `color: ${HTMLAttributes.color}` : "",
      HTMLAttributes.fontSize ? `font-size: ${HTMLAttributes.fontSize}` : "",
    ]
      .filter(Boolean)
      .join("; ");
    return ["span", mergeAttributes(HTMLAttributes, { style }), 0];
  },
});

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
  extraQuotes,
  exchangeRate,
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
  extraQuotes: Record<string, MarketQuote>;
  exchangeRate: number | null;
  editingPostId: string | null;
  loading: boolean;
  onSubmit: () => Promise<void>;
  onCancel: () => void;
}) {
  const blockIdRef = useRef(blocks[0]?.id ?? makeEditorBlockId());
  const editorContent = blocks[0]?.text ?? "";

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      Image,
      StyledText,
      Placeholder.configure({
        placeholder:
          "자유롭게 글을 작성하세요. 예) 투자 근거 · 핵심 지표 · 리스크 점검",
      }),
    ],
    content: editorContent,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "tiptap-content min-h-[620px] px-6 py-5 outline-none",
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.isEmpty ? "" : editor.getHTML();
      setBlocks([{ id: blockIdRef.current, type: "text", text: html }]);
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }
    blockIdRef.current = blocks[0]?.id ?? blockIdRef.current;
    if (editor.getHTML() !== editorContent) {
      editor.commands.setContent(editorContent, { emitUpdate: false });
    }
  }, [blocks, editor, editorContent]);

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

  function getTagQuote(tag: StockTag) {
    return (
      (tag.market === "KR" ? krStocks : usStocks).find(
        (item) => item.symbol === tag.symbol,
      ) ?? extraQuotes[tag.symbol] ?? null
    );
  }

  async function insertImages(files: FileList | null) {
    if (!editor || !files) {
      return;
    }
    const selected = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, 8);
    const urls = await Promise.all(selected.map((file) => encodeImageForPost(file)));
    const chain = editor.chain().focus();
    urls.forEach((url) => chain.setImage({ src: url }));
    chain.run();
  }

  function promptLink() {
    if (!editor) {
      return;
    }
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("링크 URL", previous ?? "");
    if (url === null) {
      return;
    }
    if (url === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  return (
    <div className="w-full rounded-lg border border-[#d9dee8] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between border-b border-[#eef1f6] pb-4">
        <p className="text-sm font-semibold text-[#344052]">
          {editingPostId ? "피드 수정" : "투자 글쓰기"}
        </p>
        <button
          onClick={onCancel}
          className="grid h-8 w-8 cursor-pointer place-items-center rounded-md border border-[#c7ceda] transition-colors hover:bg-[#eef1f6]"
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
        <div className="flex flex-wrap items-center gap-1 border-b border-[#d9dee8] bg-[#f9fafc] p-2">
          {editor ? (
            <>
              <ToolbarButton
                label="B"
                title="굵게"
                active={editor.isActive("bold")}
                onClick={() => editor.chain().focus().toggleBold().run()}
                className="font-bold"
              />
              <ToolbarButton
                label="I"
                title="기울임"
                active={editor.isActive("italic")}
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className="italic"
              />
              <ToolbarButton
                label="H1"
                title="제목 1"
                active={editor.isActive("heading", { level: 1 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              />
              <ToolbarButton
                label="H2"
                title="제목 2"
                active={editor.isActive("heading", { level: 2 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              />
              <ToolbarButton
                label="• 목록"
                title="글머리 목록"
                active={editor.isActive("bulletList")}
                onClick={() => editor.chain().focus().toggleBulletList().run()}
              />
              <ToolbarButton
                label="1. 목록"
                title="번호 목록"
                active={editor.isActive("orderedList")}
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
              />
              <ToolbarButton
                label="인용"
                title="인용구"
                active={editor.isActive("blockquote")}
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
              />
              <ToolbarButton
                label="< >"
                title="인라인 코드"
                active={editor.isActive("code")}
                onClick={() => editor.chain().focus().toggleCode().run()}
              />
              <ToolbarButton
                label="—"
                title="구분선"
                active={false}
                onClick={() => editor.chain().focus().setHorizontalRule().run()}
              />
              <ToolbarButton
                label="링크"
                title="링크"
                active={editor.isActive("link")}
                onClick={promptLink}
              />
              <select
                title="글자 크기"
                defaultValue=""
                onChange={(event) => {
                  const fontSize = event.target.value;
                  if (fontSize) {
                    editor.chain().focus().setMark("styledText", { fontSize }).run();
                  } else {
                    editor.chain().focus().unsetMark("styledText").run();
                  }
                }}
                className="h-9 cursor-pointer rounded-md border border-[#c7ceda] bg-white px-2 text-sm font-semibold text-[#344052]"
              >
                <option value="">기본 크기</option>
                <option value="13px">작게</option>
                <option value="16px">보통</option>
                <option value="20px">크게</option>
                <option value="28px">매우 크게</option>
              </select>
              <label
                title="글자 색상"
                className="grid h-9 w-9 cursor-pointer place-items-center rounded-md border border-[#c7ceda] bg-white"
              >
                <span className="h-4 w-4 rounded-sm border border-[#c7ceda] bg-[linear-gradient(135deg,#b64242_0_33%,#1f6f8b_33%_66%,#344052_66%)]" />
                <input
                  type="color"
                  className="sr-only"
                  onChange={(event) =>
                    editor.chain().focus().setMark("styledText", { color: event.target.value }).run()
                  }
                />
              </label>
            </>
          ) : null}
          <label className="ml-auto inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-[#c7ceda] bg-white px-3 text-sm font-semibold">
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
        <div
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            insertImages(event.dataTransfer.files);
          }}
        >
          <EditorContent editor={editor} />
        </div>
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
                  className="flex cursor-pointer items-center justify-between rounded-md bg-white px-3 py-2 text-left text-sm"
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
                exchangeRate={exchangeRate}
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
          className="h-10 cursor-pointer rounded-md border border-[#c7ceda] px-4 text-sm font-semibold transition-colors hover:bg-[#eef1f6]"
        >
          취소
        </button>
        <button
          disabled={loading}
          onClick={onSubmit}
          className="h-10 cursor-pointer rounded-md bg-[#1f6f8b] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#195c74] disabled:opacity-60"
        >
          {editingPostId ? "수정 완료" : "게시"}
        </button>
      </div>
    </div>
  );
}

function ToolbarButton({
  label,
  title,
  active,
  onClick,
  className = "",
}: {
  label: string;
  title: string;
  active: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`h-9 min-w-9 cursor-pointer rounded-md border px-2.5 text-sm font-semibold transition-colors ${
        active
          ? "border-[#1f6f8b] bg-[#eef6f9] text-[#1f6f8b]"
          : "border-[#c7ceda] bg-white text-[#344052] hover:bg-[#eef1f6]"
      } ${className}`}
    >
      {label}
    </button>
  );
}
