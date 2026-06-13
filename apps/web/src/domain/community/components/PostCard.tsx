"use client";

import { Dispatch, SetStateAction, useState } from "react";
import { Heart, MessageCircle, Pencil, Send, Trash2 } from "lucide-react";
import { RichContent } from "@/common/components/RichContent";
import { Button } from "@/common/components/Button";
import { cn } from "@/common/utils/cn";
import { usePreferencesStore } from "@/common/stores/preferences";
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
  onAuthorClick,
  canModerate = false,
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
  onAuthorClick?: (userId: string) => void;
  canModerate?: boolean;
}) {
  const ko = usePreferencesStore((s) => s.language) === "ko";
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
      className={`-mx-4 rounded-none border-y border-[#d9dee8] bg-white p-4 shadow-sm sm:mx-0 sm:rounded-lg sm:border ${
        onOpenPost ? "cursor-pointer transition-shadow hover:shadow-md" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-[#607086] sm:text-xs">
            <Button
              variant="link"
              onClick={(event) => {
                event.stopPropagation();
                onAuthorClick?.(post.author.id);
              }}
            >
              {post.author.nickname}
            </Button>{" "}
            · {new Date(post.createdAt).toLocaleString()}
          </p>
          <h3 className="mt-1 line-clamp-2 text-base font-semibold leading-6 sm:truncate sm:text-lg">
            {post.title || post.content || (ko ? "제목 없음" : "Untitled")}
          </h3>
        </div>
        {post.author.id === currentUserId || canModerate ? (
          <div className="flex gap-1">
            {post.author.id === currentUserId ? (
              <Button
                variant="secondary"
                size="icon-sm"
                onClick={() => onEditPost(post)}
                title={ko ? "수정" : "Edit"}
                aria-label={ko ? "수정" : "Edit"}
                leftIcon={<Pencil />}
                className="text-muted"
              />
            ) : null}
            <Button
              variant="secondary"
              size="icon-sm"
              onClick={() => onDeletePost(post.id)}
              title={ko ? "삭제" : "Delete"}
              aria-label={ko ? "삭제" : "Delete"}
              leftIcon={<Trash2 />}
              className="text-muted"
            />
          </div>
        ) : null}
      </div>

      <div className={`mt-4 ${showFull ? "" : "max-h-64 overflow-hidden sm:max-h-72"}`}>
        <RichContent
          html={html}
          onImageClick={
            enableImagePreview ? (url) => setImagePreview(url) : undefined
          }
        />
      </div>
      {!showFull ? (
        <Button
          variant="link"
          onClick={() => setExpanded(true)}
          onDoubleClick={(event) => event.stopPropagation()}
          className="mt-3 text-sm"
        >
          {ko ? "전체 글 보기" : "View full post"}
        </Button>
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

      <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onLike(post.id)}
          onDoubleClick={(event) => event.stopPropagation()}
          leftIcon={<Heart fill={post.likedByMe ? "currentColor" : "none"} />}
          className={cn(
            "text-sm",
            post.likedByMe &&
              "border-negative bg-negative-surface text-negative hover:bg-negative-surface hover:text-negative",
          )}
        >
          {post.likeCount}
        </Button>
        <span className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-semibold text-foreground [&_svg]:size-[1.15em]">
          <MessageCircle />
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
              canModerate={canModerate}
              onAuthorClick={onAuthorClick}
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
              placeholder={ko ? "댓글 작성" : "Write a comment"}
              className="h-11 flex-1 rounded-md border border-[#c7ceda] px-3 text-base outline-none focus:border-[#1f6f8b] sm:h-10 sm:text-sm"
            />
            <Button
              variant="primary"
              size="icon"
              onClick={() => onComment(post.id)}
              onDoubleClick={(event) => event.stopPropagation()}
              aria-label={ko ? "댓글 작성" : "Write a comment"}
              leftIcon={<Send />}
              className="h-11 w-11 shrink-0 sm:size-10"
            />
          </div>
        </div>
      ) : null}

      {imagePreview ? (
        <div
          onClick={() => setImagePreview(null)}
          className="fixed inset-0 z-50 grid cursor-zoom-out place-items-center bg-black/85 p-3 sm:p-4"
        >
          <img src={imagePreview} alt="" className="max-h-[94vh] max-w-[96vw] object-contain" />
        </div>
      ) : null}
    </article>
  );
}
