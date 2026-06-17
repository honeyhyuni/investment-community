"use client";

import { Dispatch, ReactNode, SetStateAction, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/common/components/Button";
import { cn } from "@/common/utils/cn";
import { usePreferencesStore } from "@/common/stores/preferences";
import { CommunityComment } from "@/domain/community/types";

function formatCommentTime(value: string, ko: boolean) {
  return new Date(value).toLocaleDateString(ko ? "ko-KR" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Avatar({ nickname, small = false }: { nickname: string; small?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-surface-subtle font-semibold uppercase text-muted",
        small ? "size-6 text-[10px]" : "size-8 text-xs",
      )}
    >
      {nickname.charAt(0)}
    </span>
  );
}

function CommentRow({
  comment,
  small = false,
  currentUserId,
  canModerate,
  onEditComment,
  onDeleteComment,
  onAuthorClick,
  children,
}: {
  comment: CommunityComment;
  small?: boolean;
  currentUserId: string;
  canModerate: boolean;
  onEditComment: (commentId: string, content: string) => void;
  onDeleteComment: (commentId: string) => void;
  onAuthorClick?: (userId: string) => void;
  children?: ReactNode;
}) {
  const ko = usePreferencesStore((s) => s.language) === "ko";
  const isOwn = comment.author.id === currentUserId;
  return (
    <div className="flex gap-2.5">
      <Avatar nickname={comment.author.nickname} small={small} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-baseline gap-1.5">
            <Button
              variant="link"
              onClick={() => onAuthorClick?.(comment.author.id)}
              className="truncate text-sm font-semibold text-foreground"
            >
              {comment.author.nickname}
            </Button>
            <span className="shrink-0 text-[11px] text-muted">
              {formatCommentTime(comment.createdAt, ko)}
            </span>
          </div>
          {isOwn || canModerate ? (
            <div className="flex shrink-0 gap-0.5">
              {isOwn ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onEditComment(comment.id, comment.content)}
                  title={ko ? "수정" : "Edit"}
                  aria-label={ko ? "수정" : "Edit"}
                  leftIcon={<Pencil />}
                  className="size-7 text-muted sm:size-7"
                />
              ) : null}
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onDeleteComment(comment.id)}
                title={ko ? "삭제" : "Delete"}
                aria-label={ko ? "삭제" : "Delete"}
                leftIcon={<Trash2 />}
                className="size-7 text-muted hover:text-negative sm:size-7"
              />
            </div>
          ) : null}
        </div>
        <p className="mt-0.5 whitespace-pre-wrap text-sm leading-6 text-foreground">
          {comment.content}
        </p>
        {children}
      </div>
    </div>
  );
}

export function CommentThread({
  postId,
  comment,
  replyDrafts,
  setReplyDrafts,
  onComment,
  currentUserId,
  onEditComment,
  onDeleteComment,
  canModerate = false,
  onAuthorClick,
}: {
  postId: string;
  comment: CommunityComment;
  replyDrafts: Record<string, string>;
  setReplyDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  onComment: (postId: string, parentId?: string) => void;
  currentUserId: string;
  onEditComment: (commentId: string, content: string) => void;
  onDeleteComment: (commentId: string) => void;
  canModerate?: boolean;
  onAuthorClick?: (userId: string) => void;
}) {
  const ko = usePreferencesStore((s) => s.language) === "ko";
  const [replying, setReplying] = useState(false);

  function submitReply() {
    onComment(postId, comment.id);
    setReplying(false);
  }

  return (
    <CommentRow
      comment={comment}
      currentUserId={currentUserId}
      canModerate={canModerate}
      onEditComment={onEditComment}
      onDeleteComment={onDeleteComment}
      onAuthorClick={onAuthorClick}
    >
      <div className="mt-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setReplying((value) => !value)}
          className="h-7 px-2.5 text-xs text-muted sm:h-7"
        >
          {replying ? (ko ? "취소" : "Cancel") : ko ? "답글 달기" : "Reply"}
        </Button>
      </div>

      {comment.replies.length > 0 ? (
        <div className="mt-3 space-y-3 border-l border-border pl-3">
          {comment.replies.map((reply) => (
            <CommentRow
              key={reply.id}
              comment={reply}
              small
              currentUserId={currentUserId}
              canModerate={canModerate}
              onEditComment={onEditComment}
              onDeleteComment={onDeleteComment}
              onAuthorClick={onAuthorClick}
            />
          ))}
        </div>
      ) : null}

      {replying ? (
        <div className="mt-3 flex gap-2">
          <input
            autoFocus
            value={replyDrafts[comment.id] ?? ""}
            onChange={(event) =>
              setReplyDrafts((drafts) => ({
                ...drafts,
                [comment.id]: event.target.value,
              }))
            }
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                event.preventDefault();
                submitReply();
              }
            }}
            placeholder={ko ? "답글 작성" : "Write a reply"}
            className="h-10 flex-1 rounded-md border border-border-strong bg-surface px-3 text-base outline-none transition-colors focus:border-primary sm:h-9 sm:text-sm"
          />
          <Button
            variant="primary"
            size="sm"
            onClick={submitReply}
            className="shrink-0 px-4"
          >
            {ko ? "등록" : "Reply"}
          </Button>
        </div>
      ) : null}
    </CommentRow>
  );
}
