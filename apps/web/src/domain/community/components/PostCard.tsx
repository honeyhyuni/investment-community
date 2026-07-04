"use client";

import { Dispatch, MouseEvent, SetStateAction, useState } from "react";
import { ChevronRight, Heart, MessageCircle, Pencil, Trash2 } from "lucide-react";
import { RichContent } from "@/common/components/RichContent";
import { Button } from "@/common/components/Button";
import { cn } from "@/common/utils/cn";
import { usePreferencesStore } from "@/common/stores/preferences";
import { MarketQuote, TradeTick } from "@/common/types";
import { CommunityPost, StockTag } from "@/domain/community/types";
import { getPostHtml } from "@/domain/community/utils";
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
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const html = getPostHtml(post);
  const showFull = forceExpanded || html.length < 1200;
  // 리스트(카드) 모드에서는 onOpenPost가 있어 카운트만 보여주고,
  // 상세 모드(onOpenPost 없음)에서만 좋아요/댓글 인터랙션을 허용한다.
  const interactive = !onOpenPost;
  const edited =
    new Date(post.updatedAt).getTime() - new Date(post.createdAt).getTime() > 1000;
  const dateLabel = new Date(
    edited ? post.updatedAt : post.createdAt,
  ).toLocaleString();

  function openPostFromCard(event: MouseEvent<HTMLElement>) {
    if (!onOpenPost) {
      return;
    }
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest(
        'a,button,input,textarea,select,[role="button"],[contenteditable="true"]',
      )
    ) {
      return;
    }
    onOpenPost(post.id);
  }

  function getTagQuote(tag: StockTag) {
    return (
      (tag.market === "KR" ? krStocks : usStocks).find(
        (item) => item.symbol === tag.symbol,
      ) ?? extraQuotes[tag.symbol] ?? null
    );
  }

  return (
    <article
      onClick={openPostFromCard}
      className={`-mx-4 rounded-none border-y border-[#d9dee8] bg-white p-4 shadow-sm sm:mx-0 sm:rounded-lg sm:border ${
        onOpenPost
          ? "cursor-pointer transition-all duration-150 ease-out hover:scale-[1.01] hover:shadow-md hover:will-change-transform"
          : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-xl font-semibold leading-snug text-foreground sm:truncate sm:text-2xl">
            {post.title || (ko ? "제목없음" : "Untitled")}
          </h3>
          {forceExpanded ? (
            <>
              {/* 상세: 제목 아래 날짜, 그리고 프로필+이름은 별도 버튼으로 분리(유저 피드로 이동) */}
              <p className="mt-1.5 text-[11px] font-semibold text-muted sm:text-xs">
                {dateLabel}
                {edited ? (
                  <span className="ml-1.5 inline-flex items-center rounded-full bg-surface-subtle px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                    {ko ? "수정됨" : "Edited"}
                  </span>
                ) : null}
              </p>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onAuthorClick?.(post.author.id);
                }}
                className="mt-2 inline-flex max-w-full items-center gap-2 text-xs font-semibold text-foreground transition-colors hover:text-primary focus-visible:text-primary focus-visible:outline-none"
              >
                <span
                  aria-hidden
                  className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-subtle text-[10px] font-semibold uppercase text-muted"
                >
                  {post.author.nickname.charAt(0)}
                </span>
                <span className="truncate">{post.author.nickname}</span>
                <span className="inline-flex shrink-0 items-center gap-0.5 text-primary">
                  {ko ? "피드로 가기" : "View feed"}
                  <ChevronRight className="size-3.5" />
                </span>
              </button>
            </>
          ) : (
            <div className="mt-1.5 flex items-center gap-2">
              <span
                aria-hidden
                className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-subtle text-[10px] font-semibold uppercase text-muted"
              >
                {post.author.nickname.charAt(0)}
              </span>
              <p className="min-w-0 truncate text-[11px] font-semibold text-muted sm:text-xs">
                <Button
                  variant="link"
                  onClick={(event) => {
                    event.stopPropagation();
                    onAuthorClick?.(post.author.id);
                  }}
                >
                  {post.author.nickname}
                </Button>{" "}
                · {dateLabel}
                {edited ? (
                  <span className="ml-1.5 inline-flex items-center rounded-full bg-surface-subtle px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                    {ko ? "수정됨" : "Edited"}
                  </span>
                ) : null}
              </p>
            </div>
          )}
        </div>
        {post.author.id === currentUserId || canModerate ? (
          <div className="flex gap-1">
            {post.author.id === currentUserId ? (
              <Button
                variant="secondary"
                size="icon-sm"
                onClick={(event) => {
                  event.stopPropagation();
                  onEditPost(post);
                }}
                title={ko ? "수정" : "Edit"}
                aria-label={ko ? "수정" : "Edit"}
                leftIcon={<Pencil />}
                className="text-muted"
              />
            ) : null}
            <Button
              variant="secondary"
              size="icon-sm"
              onClick={(event) => {
                event.stopPropagation();
                onDeletePost(post.id);
              }}
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
          onClick={(event) => {
            event.stopPropagation();
            onOpenPost?.(post.id);
          }}
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
        {interactive ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              onLike(post.id);
            }}
            leftIcon={<Heart fill={post.likedByMe ? "currentColor" : "none"} />}
            className={cn(
              "text-sm",
              post.likedByMe &&
                "border-negative bg-negative-surface text-negative hover:bg-negative-surface hover:text-negative",
            )}
          >
            {post.likeCount}
          </Button>
        ) : (
          <span
            className={cn(
              "inline-flex h-9 items-center gap-1.5 text-sm font-semibold [&_svg]:size-[1.15em]",
              post.likedByMe ? "text-negative" : "text-muted",
            )}
          >
            <Heart fill={post.likedByMe ? "currentColor" : "none"} />
            {post.likeCount}
          </span>
        )}
        <span className="inline-flex h-9 items-center gap-1.5 text-sm font-semibold text-muted [&_svg]:size-[1.15em]">
          <MessageCircle />
          {post.commentCount}
        </span>
      </div>

      {interactive ? (
        <div className="mt-5 border-t border-border pt-5">
          <h4 className="text-sm font-semibold text-foreground">
            {ko ? "댓글" : "Comments"}{" "}
            <span className="text-muted">{post.commentCount}</span>
          </h4>

          <div className="mt-4 flex gap-2">
            <input
              value={commentDrafts[post.id] ?? ""}
              onChange={(event) =>
                setCommentDrafts((drafts) => ({
                  ...drafts,
                  [post.id]: event.target.value,
                }))
              }
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  onComment(post.id);
                }
              }}
              placeholder={ko ? "댓글을 남겨보세요" : "Write a comment"}
              className="h-11 flex-1 rounded-md border border-border-strong bg-surface px-3 text-base outline-none transition-colors focus:border-primary sm:h-10 sm:text-sm"
            />
            <Button
              variant="primary"
              onClick={() => onComment(post.id)}
              className="shrink-0"
            >
              {ko ? "등록" : "Post"}
            </Button>
          </div>

          {post.comments.length ? (
            <div className="mt-5 space-y-5">
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
            </div>
          ) : (
            <p className="mt-5 text-center text-sm text-muted">
              {ko ? "첫 번째 댓글을 남겨보세요." : "Be the first to comment."}
            </p>
          )}
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
