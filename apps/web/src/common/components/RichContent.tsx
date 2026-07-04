"use client";

import { memo, MouseEvent, useMemo } from "react";

type RichContentProps = {
  html: string;
  onImageClick?: (url: string) => void;
  maxImages?: number;
};

/** TipTap이 생성한 HTML을 렌더한다. 이미지 클릭 시 onImageClick 호출(확대용). */
function RichContentImpl({ html, onImageClick, maxImages }: RichContentProps) {
  const renderHtml = useMemo(() => {
    let imageIndex = 0;
    return html.replace(/<img\b[^>]*>/gi, (tag) => {
      imageIndex += 1;
      if (maxImages !== undefined && imageIndex > maxImages) {
        return "";
      }
      if (/\bloading=/i.test(tag)) {
        return tag;
      }
      const loading = maxImages !== undefined ? "eager" : "lazy";
      return tag.replace(
        /^<img\b/i,
        `<img loading="${loading}" decoding="async"`,
      );
    });
  }, [html, maxImages]);

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    if (!onImageClick) {
      return;
    }
    const target = event.target as HTMLElement;
    if (target.tagName === "IMG") {
      onImageClick((target as HTMLImageElement).src);
    }
  }

  return (
    <div
      className={`tiptap-content text-sm leading-7 text-[#344052] ${
        onImageClick ? "[&_img]:cursor-zoom-in" : ""
      }`}
      onClick={handleClick}
      dangerouslySetInnerHTML={{ __html: renderHtml }}
    />
  );
}

export const RichContent = memo(
  RichContentImpl,
  (previous, next) =>
    previous.html === next.html &&
    previous.maxImages === next.maxImages &&
    Boolean(previous.onImageClick) === Boolean(next.onImageClick),
);