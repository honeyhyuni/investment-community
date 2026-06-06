import { CommunityPost } from "@/domain/community/types";

export function makeEditorBlockId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** 글의 본문 HTML(TipTap 생성). contentBlocks의 text를 이어붙이고, 없으면 content로 폴백. */
export function getPostHtml(post: CommunityPost): string {
  if (post.contentBlocks.length) {
    return post.contentBlocks.map((block) => block.text ?? "").join("");
  }
  return post.content ?? "";
}

/** HTML에서 태그를 제거한 평문(미리보기/검색용 content 필드에 사용). */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export async function encodeImageForPost(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
