import { X } from 'lucide-react';

import { cn } from '@/common/utils/cn';

export type UnderwriterFilterOption = { name: string; count: number };

/** 증권사(주관사) 필터 칩. 눌러서 토글하고, 선택된 칩은 hover 시 우상단에 X가 떠서 뺄 수 있다. */
export function UnderwriterFilter({
  options,
  selected,
  onChange,
  language,
}: {
  options: UnderwriterFilterOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  language: 'en' | 'ko';
}) {
  if (!options.length) {
    return null;
  }

  function toggle(name: string) {
    onChange(
      selected.includes(name)
        ? selected.filter((n) => n !== name)
        : [...selected, name],
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {options.map(({ name, count }) => {
        const active = selected.includes(name);
        return (
          <div key={name} className="group relative">
            <button
              type="button"
              onClick={() => toggle(name)}
              className={cn(
                'cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors',
                active
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-surface text-muted hover:border-primary hover:text-primary',
              )}
            >
              {name}
              <span
                className={cn(
                  'ml-1',
                  active ? 'text-primary/70' : 'text-muted',
                )}
              >
                ({count})
              </span>
            </button>
            {active ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  toggle(name);
                }}
                aria-label={
                  language === 'ko' ? `${name} 선택 해제` : `Remove ${name}`
                }
                className="absolute -right-1.5 -top-1.5 grid size-4 cursor-pointer place-items-center rounded-full border border-border bg-surface text-muted opacity-0 shadow-sm transition-opacity hover:border-primary hover:text-primary group-hover:opacity-100"
              >
                <X size={10} />
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
