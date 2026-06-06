import { CommunityPost } from "@/domain/community/types";

export function makeEditorBlockId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function communityBlocksToMarkdown(post: CommunityPost): string {
  if (post.contentBlocks.length) {
    return post.contentBlocks
      .map((block) =>
        block.type === "image" && block.url
          ? `![image](${block.url})`
          : block.text ?? "",
      )
      .filter(Boolean)
      .join("\n\n");
  }

  return [
    post.content,
    ...post.imageUrls.map((url) => `![image](${url})`),
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function encodeImageForPost(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
