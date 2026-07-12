import { CircleQuestionMark } from 'lucide-react';
import type { ReactNode } from 'react';

export function InfoHint({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex items-start gap-1.5 rounded-md bg-surface-subtle px-3 py-2 text-xs font-bold text-muted ${className}`}
    >
      <CircleQuestionMark size={14} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
