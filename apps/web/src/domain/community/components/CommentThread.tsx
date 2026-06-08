"use client";

import { Dispatch, SetStateAction } from "react";
import { Pencil, Send, Trash2 } from "lucide-react";
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
}: {
  postId: string;
  comment: CommunityComment;
  replyDrafts: Record<string, string>;
  setReplyDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  onComment: (postId: string, parentId?: string) => void;
  currentUserId: string;
  onEditComment: (commentId: string, content: string) => void;
  onDeleteComment: (commentId: string) => void;
}) {
  return (
    <div className="rounded-md bg-[#f6f8fb] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{comment.author.nickname}</p>
        {comment.author.id === currentUserId ? (
          <div className="flex gap-1">
            <button
              onClick={() => onEditComment(comment.id, comment.content)}
              title="수정"
              className="grid h-7 w-7 cursor-pointer place-items-center rounded-md text-[#344052] transition-colors hover:bg-[#e8edf4]"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={() => onDeleteComment(comment.id)}
              title="삭제"
              className="grid h-7 w-7 cursor-pointer place-items-center rounded-md text-[#9a2f2f] transition-colors hover:bg-[#fff1f1]"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ) : null}
      </div>
      <p className="mt-1 whitespace-pre-wrap text-sm text-[#344052]">{comment.content}</p>
      {comment.replies.length > 0 ? (
        <div className="mt-3 space-y-2 border-l-2 border-[#d9dee8] pl-3">
          {comment.replies.map((reply) => (
            <div key={reply.id} className="rounded-md bg-white p-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold">{reply.author.nickname}</p>
                {reply.author.id === currentUserId ? (
                  <div className="flex gap-1">
                    <button
                      onClick={() => onEditComment(reply.id, reply.content)}
                      title="수정"
                      className="grid h-7 w-7 cursor-pointer place-items-center rounded-md text-[#344052] transition-colors hover:bg-[#eef1f6]"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => onDeleteComment(reply.id)}
                      title="삭제"
                      className="grid h-7 w-7 cursor-pointer place-items-center rounded-md text-[#9a2f2f] transition-colors hover:bg-[#fff1f1]"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-[#344052]">{reply.content}</p>
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
          placeholder="답글 작성"
          className="h-9 flex-1 rounded-md border border-[#c7ceda] bg-white px-3 text-sm outline-none focus:border-[#1f6f8b]"
        />
        <button
          onClick={() => onComment(postId, comment.id)}
          className="grid h-9 w-9 cursor-pointer place-items-center rounded-md bg-[#344052] text-white transition-colors hover:bg-[#1f2937]"
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}
