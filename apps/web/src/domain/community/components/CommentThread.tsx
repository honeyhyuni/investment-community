"use client";

import { Dispatch, SetStateAction } from "react";
import { Pencil, Send, Trash2 } from "lucide-react";
import { Button } from "@/common/components/Button";
import { usePreferencesStore } from "@/common/stores/preferences";
import { CommunityComment } from "@/domain/community/types";

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
  return (
    <div className="rounded-md bg-[#f6f8fb] p-3">
      <div className="flex items-center justify-between gap-2">
        <Button variant="link" onClick={() => onAuthorClick?.(comment.author.id)} className="min-w-0 truncate text-sm">
          {comment.author.nickname}
        </Button>
        {comment.author.id === currentUserId || canModerate ? (
          <div className="flex gap-1">
            {comment.author.id === currentUserId ? (
              <Button
                variant="secondary"
                size="icon-sm"
                onClick={() => onEditComment(comment.id, comment.content)}
                title={ko ? "수정" : "Edit"}
                aria-label={ko ? "수정" : "Edit"}
                leftIcon={<Pencil />}
                className="size-7 text-muted"
              />
            ) : null}
            <Button
              variant="secondary"
              size="icon-sm"
              onClick={() => onDeleteComment(comment.id)}
              title={ko ? "삭제" : "Delete"}
              aria-label={ko ? "삭제" : "Delete"}
              leftIcon={<Trash2 />}
              className="size-7 text-muted"
            />
          </div>
        ) : null}
      </div>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[#344052]">{comment.content}</p>
      {comment.replies.length > 0 ? (
        <div className="mt-3 space-y-2 border-l-2 border-[#d9dee8] pl-2 sm:pl-3">
          {comment.replies.map((reply) => (
            <div key={reply.id} className="rounded-md bg-white p-2">
              <div className="flex items-center justify-between gap-2">
                <Button variant="link" onClick={() => onAuthorClick?.(reply.author.id)} className="min-w-0 truncate text-xs">
                  {reply.author.nickname}
                </Button>
                {reply.author.id === currentUserId || canModerate ? (
                  <div className="flex gap-1">
                    {reply.author.id === currentUserId ? (
                      <Button
                        variant="secondary"
                        size="icon-sm"
                        onClick={() => onEditComment(reply.id, reply.content)}
                        title={ko ? "수정" : "Edit"}
                        aria-label={ko ? "수정" : "Edit"}
                        leftIcon={<Pencil />}
                        className="size-7 text-muted"
                      />
                    ) : null}
                    <Button
                      variant="secondary"
                      size="icon-sm"
                      onClick={() => onDeleteComment(reply.id)}
                      title={ko ? "삭제" : "Delete"}
                      aria-label={ko ? "삭제" : "Delete"}
                      leftIcon={<Trash2 />}
                      className="size-7 text-muted"
                    />
                  </div>
                ) : null}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[#344052]">{reply.content}</p>
            </div>
          ))}
        </div>
      ) : null}
      <div className="mt-3 flex gap-2">
        <input
          value={replyDrafts[comment.id] ?? ""}
          onChange={(event) =>
            setReplyDrafts((drafts) => ({
              ...drafts,
              [comment.id]: event.target.value,
            }))
          }
          placeholder={ko ? "답글 작성" : "Write a reply"}
          className="h-10 flex-1 rounded-md border border-[#c7ceda] bg-white px-3 text-base outline-none focus:border-[#1f6f8b] sm:h-9 sm:text-sm"
        />
        <Button
          variant="primary"
          size="icon-sm"
          onClick={() => onComment(postId, comment.id)}
          aria-label={ko ? "답글 작성" : "Write a reply"}
          leftIcon={<Send />}
          className="h-10 w-10 shrink-0 sm:size-9"
        />
      </div>
    </div>
  );
}
