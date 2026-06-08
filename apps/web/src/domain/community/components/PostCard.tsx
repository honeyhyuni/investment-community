"use client";

import { Dispatch, SetStateAction, useState } from "react";
import { Heart, MessageCircle, Pencil, Send, Trash2 } from "lucide-react";
import { RichContent } from "@/common/components/RichContent";
import { MarketQuote, TradeTick } from "@/common/types";
import { CommunityPost, StockTag } from "@/domain/community/types";
import { getPostHtml } from "@/common/utils/community";
import { CommentThread } from "@/domain/community/components/CommentThread";
import { StockTagQuote } from "@/domain/community/components/StockTagQuote";

export function PostCard({
  post,
  currentUserId,
  commentDrafts,
  setCommentDrafts,
  replyDrafts,
  setReplyDrafts,
  onLike,
  onComment,
  onEditPost,
  onDeletePost,
  onEditComment,
  onDeleteComment,
  onStockTagClick,
  usStocks,
  krStocks,
  livePrices,
  extraQuotes,
  exchangeRate,
  forceExpanded = false,
  enableImagePreview = true,
  onOpenPost,
}: {
  post: CommunityPost;
  currentUserId: string;
  commentDrafts: Record<string, string>;
  setCommentDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  replyDrafts: Record<string, string>;
  setReplyDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  onLike: (postId: string) => void;
  onComment: (postId: string, parentId?: string) => void;
  onEditPost: (post: CommunityPost) => void;
  onDeletePost: (postId: string) => void;
  onEditComment: (commentId: string, content: string) => void;
  onDeleteComment: (commentId: string) => void;
  onStockTagClick: (tag: StockTag) => void;
  usStocks: MarketQuote[];
  krStocks: MarketQuote[];
  livePrices: Record<string, TradeTick>;
  extraQuotes: Record<string, MarketQuote>;
  exchangeRate: number | null;
  forceExpanded?: boolean;
  enableImagePreview?: boolean;
  onOpenPost?: (postId: string) => void;
}) {
  const [expanded, setExpanded] = useState(forceExpanded);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const html = getPostHtml(post);
  const showFull = forceExpanded || expanded || html.length < 1200;

  function getTagQuote(tag: StockTag) {
    return (
      (tag.market === "KR" ? krStocks : usStocks).find(
        (item) => item.symbol === tag.symbol,
      ) ?? extraQuotes[tag.symbol] ?? null
    );
  }

  return (
    <article
      onDoubleClick={() => onOpenPost?.(post.id)}
      className={`rounded-lg border border-[#d9dee8] bg-white p-4 shadow-sm ${
        onOpenPost ? "cursor-pointer transition-shadow hover:shadow-md" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[#607086]">
            {post.author.nickname} · {new Date(post.createdAt).toLocaleString()}
          </p>
          <h3 className="mt-1 truncate text-lg font-semibold">
            {post.title || post.content || "제목 없음"}
          </h3>
        </div>
        {post.author.id === currentUserId ? (
          <div className="flex gap-1">
            <button
              onClick={() => onEditPost(post)}
              title="수정"
              className="grid h-8 w-8 cursor-pointer place-items-center rounded-md text-[#344052] transition-colors hover:bg-[#eef1f6]"
            >
              <Pencil size={15} />
            </button>
            <button
              onClick={() => onDeletePost(post.id)}
              title="삭제"
              className="grid h-8 w-8 cursor-pointer place-items-center rounded-md text-[#9a2f2f] transition-colors hover:bg-[#fff1f1]"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ) : null}
      </div>

      <div className={`mt-4 ${showFull ? "" : "max-h-72 overflow-hidden"}`}>
        <RichContent
          html={html}
          onImageClick={
            enableImagePreview ? (url) => setImagePreview(url) : undefined
          }
        />
      </div>
      {!showFull ? (
        <button
          onClick={() => setExpanded(true)}
          onDoubleClick={(event) => event.stopPropagation()}
          className="mt-3 cursor-pointer text-sm font-semibold text-[#1f6f8b] hover:underline"
        >
          전체 글 보기
        </button>
      ) : null}

      {post.stockTags.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {post.stockTags.map((tag) => {
            const quote = getTagQuote(tag);
            return (
              <StockTagQuote
                key={tag.symbol}
                tag={tag}
                quote={quote}
                live={livePrices[tag.symbol]}
                onClick={onStockTagClick}
                exchangeRate={exchangeRate}
              />
            );
          })}
        </div>
      ) : null}

      <div className="mt-4 flex items-center gap-2 border-t border-[#eef1f6] pt-3">
        <button
          onClick={() => onLike(post.id)}
          onDoubleClick={(event) => event.stopPropagation()}
          className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-semibold transition-colors ${
            post.likedByMe
              ? "border-[#b64242] bg-[#fff1f1] text-[#b64242] hover:bg-[#ffe6e6]"
              : "border-[#c7ceda] text-[#344052] hover:bg-[#eef1f6]"
          }`}
        >
          <Heart size={16} fill={post.likedByMe ? "currentColor" : "none"} />
          {post.likeCount}
        </button>
        <span className="inline-flex h-9 items-center gap-2 rounded-md border border-[#c7ceda] px-3 text-sm font-semibold text-[#344052]">
          <MessageCircle size={16} />
          {post.commentCount}
        </span>
      </div>

      {(showFull || post.comments.length > 0) ? (
        <div className="mt-4 space-y-3">
          {post.comments.map((comment) => (
            <CommentThread
              key={comment.id}
              postId={post.id}
              comment={comment}
              replyDrafts={replyDrafts}
              setReplyDrafts={setReplyDrafts}
              onComment={onComment}
              currentUserId={currentUserId}
              onEditComment={onEditComment}
              onDeleteComment={onDeleteComment}
            />
          ))}
          <div className="flex gap-2">
            <input
              value={commentDrafts[post.id] ?? ""}
              onChange={(event) =>
                setCommentDrafts((drafts) => ({
                  ...drafts,
                  [post.id]: event.target.value,
                }))
              }
              placeholder="댓글 작성"
              className="h-10 flex-1 rounded-md border border-[#c7ceda] px-3 text-sm outline-none focus:border-[#1f6f8b]"
            />
            <button
              onClick={() => onComment(post.id)}
              onDoubleClick={(event) => event.stopPropagation()}
              className="grid h-10 w-10 cursor-pointer place-items-center rounded-md bg-[#1f6f8b] text-white transition-colors hover:bg-[#195c74]"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      ) : null}

      {imagePreview ? (
        <div
          onClick={() => setImagePreview(null)}
          className="fixed inset-0 z-50 grid cursor-zoom-out place-items-center bg-black/85 p-4"
        >
          <img src={imagePreview} alt="" className="max-h-[94vh] max-w-[96vw] object-contain" />
        </div>
      ) : null}
    </article>
  );
}
