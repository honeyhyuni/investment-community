import { RefObject, useEffect } from "react";

/**
 * <details> 기반 팝오버를 외부 클릭(pointerdown)·Esc 키로 닫는다.
 * ref는 해당 <details> 요소를 가리켜야 한다.
 */
export function useDismissibleDetails(
  ref: RefObject<HTMLDetailsElement | null>,
) {
  useEffect(() => {
    const close = () => {
      if (ref.current) {
        ref.current.open = false;
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      const menu = ref.current;
      if (
        !menu?.open ||
        !(event.target instanceof Node) ||
        menu.contains(event.target)
      ) {
        return;
      }
      close();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [ref]);
}
