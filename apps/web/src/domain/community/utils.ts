import { StockSymbol } from "@/common/types";
import { stockSearchScore } from "@/common/utils/stock-search";
import { CommunityPost, StockTag } from "@/domain/community/types";

export function makeEditorBlockId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** 새 글 작성 시 에디터에 미리 채우는 섹션 템플릿(PR template 형식). */
export const NEW_POST_TEMPLATE = [
  "<h2>핵심 요약</h2>",
  "<p></p>",
  "<h2>투자 근거</h2>",
  "<ul><li></li></ul>",
  "<h2>리스크 점검</h2>",
  "<ul><li></li></ul>",
].join("");

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

/** 글 태그 심볼을 실제 보유 심볼 목록에 맞춰 정규화(정확 일치 우선, 없으면 유사도 매칭). */
export function resolveCommunityStockTag(
  tag: StockTag,
  stockSymbols: StockSymbol[],
): StockTag {
  const normalizedSymbol = tag.symbol.toUpperCase();
  const isKoreanSymbol = /^\d{6}$/.test(normalizedSymbol);
  const exactMatches = stockSymbols.filter(
    (item) => item.symbol.toUpperCase() === normalizedSymbol,
  );
  const exact =
    exactMatches.find((item) =>
      isKoreanSymbol ? item.currency === "KRW" : item.currency !== "KRW",
    ) ?? exactMatches[0];
  const resolved =
    exact ??
    stockSymbols
      .map((item) => ({ item, score: stockSearchScore(item, tag.symbol) }))
      .filter((result) => result.score >= 50)
      .sort((a, b) => b.score - a.score)[0]?.item;

  return {
    symbol: resolved?.symbol ?? normalizedSymbol,
    name: resolved?.description ?? tag.name,
    market:
      isKoreanSymbol || resolved?.currency === "KRW"
        ? "KR"
        : resolved
          ? "US"
          : tag.market,
  };
}

export const MAX_COMMUNITY_IMAGE_BYTES = 3 * 1024 * 1024;
export async function compressImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) throw new Error("Only image files can be uploaded.");
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }); }
  catch { throw new Error("The selected file is not a valid image."); }
  const scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image compression is not supported.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
  if (!blob) throw new Error("Could not compress the image.");
  if (blob.size > MAX_COMMUNITY_IMAGE_BYTES) throw new Error("The compressed image is larger than 3MB.");
  return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "image"}.webp`, { type: "image/webp" });
}
