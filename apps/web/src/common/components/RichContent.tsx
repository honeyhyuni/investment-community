"use client";

import { MouseEvent, useMemo } from "react";

/** TipTap이 생성한 HTML을 렌더한다. 이미지 클릭 시 onImageClick 호출(확대용). */
export function RichContent({
  html,
  onImageClick,
}: {
  html: string;
  onImageClick?: (url: string) => void;
}) {
  const renderHtml = useMemo(
    () =>
      html.replace(/<img\b(?![^>]*\bloading=)/gi, '<img loading="lazy" decoding="async" '),
    [html],
  );

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
