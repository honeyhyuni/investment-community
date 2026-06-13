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
import { Button } from "@/common/components/Button";
import { cn } from "@/common/utils/cn";
import { usePreferencesStore } from "@/common/stores/preferences";

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
  const ko = usePreferencesStore((s) => s.language) === "ko";
  const blockIdRef = useRef(blocks[0]?.id ?? makeEditorBlockId());
  const editorContent = blocks[0]?.text ?? "";

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      Image,
      StyledText,
      Placeholder.configure({
        placeholder:
          ko ? "자유롭게 글을 작성하세요. 예) 투자 근거 · 핵심 지표 · 리스크 점검" : "Write freely. e.g. thesis · key metrics · risk check",
      }),
    ],
    content: editorContent,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "tiptap-content min-h-[420px] px-3 py-4 outline-none sm:min-h-[620px] sm:px-6 sm:py-5",
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
    const url = window.prompt(ko ? "링크 URL" : "Link URL", previous ?? "");
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
    <div className="-mx-4 w-auto border-y border-[#d9dee8] bg-white p-4 shadow-sm sm:mx-0 sm:w-full sm:rounded-lg sm:border sm:p-5">
      {editingPostId ? null : (
        <div className="flex items-center justify-between border-b border-[#eef1f6] pb-4">
          <p className="text-sm font-semibold text-[#344052]">{ko ? "투자 글쓰기" : "New post"}</p>
          <Button
            variant="secondary"
            size="icon-sm"
            onClick={onCancel}
            title={ko ? "닫기" : "Close"}
            aria-label={ko ? "닫기" : "Close"}
            leftIcon={<X />}
          />
        </div>
      )}
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder={ko ? "제목: 예) 엔비디아 실적 이후 반도체 사이클 점검" : "Title: e.g. Semiconductor cycle check after NVIDIA earnings"}
        className={cn(
          "h-12 w-full rounded-md border border-[#c7ceda] px-3 text-base font-semibold outline-none focus:border-[#1f6f8b] sm:text-lg",
          editingPostId ? "" : "mt-4",
        )}
      />
      <div className="mt-4 overflow-hidden rounded-md border border-[#d9dee8] bg-white">
        <div className="flex items-center gap-1 overflow-x-auto border-b border-[#d9dee8] bg-[#f9fafc] p-2">
          {editor ? (
            <>
              <ToolbarButton
                label="B"
                title={ko ? "굵게" : "Bold"}
                active={editor.isActive("bold")}
                onClick={() => editor.chain().focus().toggleBold().run()}
                className="font-bold"
              />
              <ToolbarButton
                label="I"
                title={ko ? "기울임" : "Italic"}
                active={editor.isActive("italic")}
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className="italic"
              />
              <ToolbarButton
                label="H1"
                title={ko ? "제목 1" : "Heading 1"}
                active={editor.isActive("heading", { level: 1 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              />
              <ToolbarButton
                label="H2"
                title={ko ? "제목 2" : "Heading 2"}
                active={editor.isActive("heading", { level: 2 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              />
              <ToolbarButton
                label={ko ? "• 목록" : "• List"}
                title={ko ? "글머리 목록" : "Bullet list"}
                active={editor.isActive("bulletList")}
                onClick={() => editor.chain().focus().toggleBulletList().run()}
              />
              <ToolbarButton
                label={ko ? "1. 목록" : "1. List"}
                title={ko ? "번호 목록" : "Numbered list"}
                active={editor.isActive("orderedList")}
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
              />
              <ToolbarButton
                label={ko ? "인용" : "Quote"}
                title={ko ? "인용구" : "Blockquote"}
                active={editor.isActive("blockquote")}
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
              />
              <ToolbarButton
                label="< >"
                title={ko ? "인라인 코드" : "Inline code"}
                active={editor.isActive("code")}
                onClick={() => editor.chain().focus().toggleCode().run()}
              />
              <ToolbarButton
                label="—"
                title={ko ? "구분선" : "Divider"}
                active={false}
                onClick={() => editor.chain().focus().setHorizontalRule().run()}
              />
              <ToolbarButton
                label={ko ? "링크" : "Link"}
                title={ko ? "링크" : "Link"}
                active={editor.isActive("link")}
                onClick={promptLink}
              />
              <select
                title={ko ? "글자 크기" : "Font size"}
                defaultValue=""
                onChange={(event) => {
                  const fontSize = event.target.value;
                  if (fontSize) {
                    editor.chain().focus().setMark("styledText", { fontSize }).run();
                  } else {
                    editor.chain().focus().unsetMark("styledText").run();
                  }
                }}
                className="h-9 shrink-0 cursor-pointer rounded-md border border-[#c7ceda] bg-white px-2 text-sm font-semibold text-[#344052]"
              >
                <option value="">{ko ? "기본 크기" : "Default"}</option>
                <option value="13px">{ko ? "작게" : "Small"}</option>
                <option value="16px">{ko ? "보통" : "Normal"}</option>
                <option value="20px">{ko ? "크게" : "Large"}</option>
                <option value="28px">{ko ? "매우 크게" : "X-Large"}</option>
              </select>
              <label
                title={ko ? "글자 색상" : "Text color"}
                className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-md border border-[#c7ceda] bg-white"
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
              <label
                title={ko ? "사진 삽입" : "Insert image"}
                className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-md border border-[#c7ceda] bg-white"
              >
                <ImageIcon size={15} />
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
            </>
          ) : null}
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
          placeholder={ko ? "태그할 종목 검색" : "Search a stock to tag"}
          className="h-11 w-full rounded-md border border-[#c7ceda] px-3 text-base outline-none focus:border-[#1f6f8b] sm:h-10 sm:text-sm"
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
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-md bg-white px-3 py-2 text-left text-sm"
                >
                  <span className="font-semibold">{item.symbol}</span>
                  <span className="truncate text-muted">{item.description}</span>
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
      <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        <Button variant="secondary" onClick={onCancel}>
          {ko ? "취소" : "Cancel"}
        </Button>
        <Button variant="primary" loading={loading} onClick={onSubmit}>
          {editingPostId ? (ko ? "수정" : "Save") : (ko ? "게시" : "Post")}
        </Button>
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
    <Button
      variant="secondary"
      size="sm"
      title={title}
      onClick={onClick}
      className={cn(
        "min-w-9 shrink-0 px-2.5 text-sm",
        active && "border-primary bg-surface-subtle text-primary",
        className,
      )}
    >
      {label}
    </Button>
  );
}
