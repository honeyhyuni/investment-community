"use client";

import { useEffect, useId, type ReactNode } from "react";
import { X } from "lucide-react";

import { cn } from "@/common/utils/cn";

export type ModalSize = "sm" | "md" | "lg";

const SIZE_CLASS: Record<ModalSize, string> = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
};

type ModalProps = {
  open: boolean;
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  closeLabel?: string;
  size?: ModalSize;
  closeOnOverlay?: boolean;
  className?: string;
  bodyClassName?: string;
  footerClassName?: string;
};

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  closeLabel = "Close",
  size = "md",
  closeOnOverlay = true,
  className,
  bodyClassName,
  footerClassName,
}: ModalProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      className="modal-overlay-in fixed inset-0 z-[90] flex items-stretch justify-center bg-black/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onMouseDown={(event) => {
        if (closeOnOverlay && event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={cn(
          "modal-panel-in flex h-dvh max-h-dvh w-full flex-col overflow-hidden border-0 border-border bg-surface shadow-2xl sm:h-auto sm:max-h-[min(44rem,calc(100dvh-3rem))] sm:rounded-lg sm:border",
          SIZE_CLASS[size],
          className,
        )}
      >
        <div className="shrink-0 border-b border-border px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] sm:py-3">
          <div className="flex items-center justify-between gap-3">
            <p id={titleId} className="text-base font-semibold text-foreground">
              {title}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="grid size-8 cursor-pointer place-items-center rounded-md text-muted hover:bg-surface-muted hover:text-primary"
              aria-label={closeLabel}
            >
              <X size={17} />
            </button>
          </div>
        </div>
        <div
          className={cn("min-h-0 flex-1 overflow-y-auto p-4", bodyClassName)}
        >
          {children}
        </div>
        {footer ? (
          <div
            className={cn(
              "flex shrink-0 flex-wrap justify-between gap-2 border-t border-border bg-surface-muted px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 sm:py-3",
              footerClassName,
            )}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
