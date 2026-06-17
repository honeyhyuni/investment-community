"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Pencil,
  Star,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/common/utils/cn";
import { apiRequest } from "@/common/lib/api";
import { Button } from "@/common/components/Button";
import { Notice } from "@/common/components/Notice";
import { SectionHeader } from "@/common/components/SectionHeader";
import { Skeleton } from "@/common/components/Skeleton";
import { useSessionStore } from "@/common/stores/session";
import { useMarketDataStore } from "@/common/stores/market-data";
import { usePreferencesStore } from "@/common/stores/preferences";
import { formatMoney, formatNumber } from "@/common/utils/format";
import { FavoriteStock } from "@/common/types";

export function FavoritesPage() {
  const accessToken = useSessionStore((s) => s.accessToken);
  const language = usePreferencesStore((s) => s.language);
  const exchangeRate = useMarketDataStore((s) => s.exchangeRate);
  const [favorites, setFavorites] = useState<FavoriteStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [removingKey, setRemovingKey] = useState("");
  const [editing, setEditing] = useState(false);
  // 편집 모드에서 드래그 중인 항목 id. DragOverlay로 떠 있는 카드를 그리는 데 쓴다.
  const [activeId, setActiveId] = useState<string | null>(null);

  // 마우스는 약간 끌어야 드래그가 시작되고(클릭 오작동 방지), 터치는 짧게 누른 뒤 드래그한다(스크롤과 구분).
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 6 },
    }),
  );

  const activeStock = activeId
    ? favorites.find((s) => s.favoriteId === activeId) ?? null
    : null;

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    let active = true;
    setLoading(true);
    apiRequest<FavoriteStock[]>("/markets/favorites", "GET", { accessToken })
      .then((items) => {
        if (active) {
          setFavorites(items);
          setError("");
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : language === "ko"
                ? "관심종목을 불러오지 못했습니다."
                : "Could not load watchlist.",
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [accessToken, language]);

  function openStock(stock: FavoriteStock) {
    const currency = stock.market === "KR" ? "KRW" : "USD";
    const nextUrl = `/?symbol=${encodeURIComponent(stock.symbol)}&market=${stock.market}&currency=${currency}`;
    window.location.assign(nextUrl);
  }

  async function removeFavorite(stock: FavoriteStock) {
    if (!accessToken) {
      return;
    }

    const key = `${stock.market}-${stock.symbol}`;
    setRemovingKey(key);
    try {
      await apiRequest<{ ok: true }>(
        `/markets/favorites/${stock.market}/${encodeURIComponent(stock.symbol)}`,
        "DELETE",
        { accessToken },
      );
      setFavorites((items) =>
        items.filter(
          (item) => !(item.symbol === stock.symbol && item.market === stock.market),
        ),
      );
    } finally {
      setRemovingKey("");
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const fromIndex = favorites.findIndex((s) => s.favoriteId === active.id);
    const toIndex = favorites.findIndex((s) => s.favoriteId === over.id);
    if (fromIndex === -1 || toIndex === -1) {
      return;
    }

    const reordered = arrayMove(favorites, fromIndex, toIndex);
    setFavorites(reordered);

    if (!accessToken) {
      return;
    }
    try {
      await apiRequest<{ ok: true }>("/markets/favorites/reorder", "PATCH", {
        accessToken,
        body: { favoriteIds: reordered.map((s) => s.favoriteId) },
      });
    } catch (reorderError) {
      setError(
        reorderError instanceof Error
          ? reorderError.message
          : language === "ko"
            ? "순서를 저장하지 못했습니다."
            : "Could not save the new order.",
      );
    }
  }

  return (
    <div className="grid min-w-0 flex-1 gap-4 py-4 sm:gap-6 sm:py-6">
      {error ? <Notice message="" error={error} /> : null}
      <section className="-mx-4 min-w-0 border-y border-border bg-surface p-4 shadow-sm sm:mx-0 sm:rounded-lg sm:border sm:p-5">
        <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
          <SectionHeader
            eyebrow={language === "ko" ? "Watchlist" : "Watchlist"}
            title={language === "ko" ? "내관심종목" : "My Watchlist"}
          />
          {favorites.length ? (
            <Button
              variant={editing ? "primary" : "secondary"}
              size="sm"
              onClick={() => setEditing((prev) => !prev)}
              leftIcon={editing ? <Check size={16} /> : <Pencil size={16} />}
              className="shrink-0"
            >
              {editing
                ? language === "ko"
                  ? "완료"
                  : "Done"
                : language === "ko"
                  ? "편집"
                  : "Edit"}
            </Button>
          ) : null}
        </div>

        {loading ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-28 rounded-md" />
            ))}
          </div>
        ) : favorites.length ? (
          editing ? (
            <>
              <p className="mb-5 mt-5 text-xs text-muted">
                {language === "ko"
                  ? "카드를 드래그해 순서를 바꾸거나 휴지통으로 삭제하세요."
                  : "Drag a card to reorder, or remove it with the trash button."}
              </p>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={() => setActiveId(null)}
              >
                <SortableContext
                  items={favorites.map((stock) => stock.favoriteId)}
                  strategy={rectSortingStrategy}
                >
                  <div className="relative mt-2">
                    {/* 드래그 중에만 나타나는 영역 표시: "이 안에서 옮기세요" 경계. 레이아웃을 밀지 않도록 절대 위치로 덮는다. */}
                    <div
                      aria-hidden
                      className={cn(
                        "pointer-events-none absolute -inset-3 rounded-xl border-2 border-primary/40 bg-primary/5 transition-opacity duration-200",
                        activeId ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="relative grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {favorites.map((stock) => (
                        <SortableFavoriteCard
                          key={stock.favoriteId}
                          stock={stock}
                          language={language}
                          exchangeRate={exchangeRate}
                          removing={removingKey === `${stock.market}-${stock.symbol}`}
                          onRemove={() => removeFavorite(stock)}
                        />
                      ))}
                    </div>
                  </div>
                </SortableContext>
                <DragOverlay
                  dropAnimation={{
                    duration: 220,
                    easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)",
                  }}
                >
                  {activeStock ? (
                    <div className="rotate-[1.5deg] scale-[1.03] cursor-grabbing rounded-xl border border-primary bg-surface-muted p-4 shadow-2xl ring-2 ring-primary/30">
                      <FavoriteCardContent
                        stock={activeStock}
                        language={language}
                        exchangeRate={exchangeRate}
                      />
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            </>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {favorites.map((stock) => (
                <FavoriteStockCard
                  key={`${stock.market}-${stock.symbol}`}
                  stock={stock}
                  language={language}
                  exchangeRate={exchangeRate}
                  onOpen={() => openStock(stock)}
                />
              ))}
            </div>
          )
        ) : (
          <div className="mt-4 rounded-md border border-dashed border-border bg-surface-muted px-4 py-12 text-center">
            <Star
              size={28}
              className="mx-auto text-[#f4b400]"
              fill="currentColor"
            />
            <p className="mt-3 text-base font-semibold text-foreground">
              {language === "ko" ? "아직 관심종목이 없습니다." : "No favorites yet."}
            </p>
            <p className="mt-1 text-sm text-muted">
              {language === "ko"
                ? "종목 상세에서 별 아이콘을 눌러 관심종목에 추가하세요."
                : "Use the star button on a stock detail page."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

// 카드 내부 시각 요소(종목명·시세). 보기 카드와 편집(드래그) 카드가 동일한 모습을 공유한다.
function FavoriteCardContent({
  stock,
  language,
  exchangeRate,
}: {
  stock: FavoriteStock;
  language: "en" | "ko";
  exchangeRate: number | null;
}) {
  const sourceCurrency = stock.currency ?? (stock.market === "KR" ? "KRW" : "USD");
  const displayCurrency = stock.market === "KR" ? "KRW" : "USD";
  const positive = stock.change >= 0;
  const primary = stock.market === "KR" ? stock.name || stock.symbol : stock.symbol;
  const secondary = stock.market === "KR" ? stock.symbol : stock.name || stock.symbol;

  return (
    <>
      <div className="flex items-center gap-2">
        <Star size={17} className="shrink-0 text-[#f4b400]" fill="currentColor" />
        <p className="truncate text-base font-semibold text-foreground">
          {primary}
        </p>
      </div>
      <p className="mt-1 truncate text-xs font-medium uppercase tracking-wide text-muted">
        {stock.market} · {secondary}
      </p>
      <p className="mt-4 text-xs font-medium text-muted">
        {language === "ko" ? "현재가" : "Last"}
      </p>
      <p className="mt-0.5 text-2xl font-bold tracking-tight text-foreground">
        {formatMoney(stock.current, displayCurrency, sourceCurrency, exchangeRate)}
      </p>
      <p className="mt-3 text-xs font-medium text-muted">
        {language === "ko" ? "전일대비" : "Change"}
      </p>
      <div className="mt-0.5 flex flex-wrap items-center gap-2">
        <span
          className={`text-sm font-semibold ${
            positive ? "text-positive" : "text-negative"
          }`}
        >
          {positive ? "+" : ""}
          {formatMoney(stock.change, displayCurrency, sourceCurrency, exchangeRate)}
        </span>
        <span
          className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
            positive
              ? "bg-positive-surface text-positive"
              : "bg-negative-surface text-negative"
          }`}
        >
          {positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {positive ? "+" : ""}
          {formatNumber(stock.percentChange)}%
        </span>
      </div>
    </>
  );
}

function FavoriteStockCard({
  stock,
  language,
  exchangeRate,
  onOpen,
}: {
  stock: FavoriteStock;
  language: "en" | "ko";
  exchangeRate: number | null;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative block w-full cursor-pointer overflow-hidden rounded-xl border border-border bg-surface-muted p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
    >
      <FavoriteCardContent
        stock={stock}
        language={language}
        exchangeRate={exchangeRate}
      />
      {/* 호버 시 카드 위로 떠오르는 상세 보기 유도 오버레이 */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface/50 opacity-0 backdrop-blur-[1px] transition-opacity duration-200 group-hover:opacity-100">
        <span className="text-sm font-semibold text-foreground">
          {language === "ko" ? "상세 보기" : "Show detail"}
        </span>
      </div>
    </button>
  );
}

// 편집 모드 카드: 보기 카드와 동일한 모양에 드래그 정렬과 삭제 버튼만 더한다.
function SortableFavoriteCard({
  stock,
  language,
  exchangeRate,
  removing,
  onRemove,
}: {
  stock: FavoriteStock;
  language: "en" | "ko";
  exchangeRate: number | null;
  removing: boolean;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stock.favoriteId });

  // 드래그 중 원본 카드는 흐리게 두고, 떠 있는 카드는 DragOverlay가 그린다.
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // 삭제 버튼에서 드래그가 시작되지 않도록 mousedown/touchstart 전파를 막는다.
  const stopDrag = (event: { stopPropagation: () => void }) =>
    event.stopPropagation();

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative cursor-grab rounded-xl border p-4 transition-colors active:cursor-grabbing",
        // 드래그 중인 카드 자리는 점선 보더 + 옅은 틴트로 드롭 위치를 보여주고, 내용은 떠 있는 카드(DragOverlay)가 그린다.
        isDragging
          ? "border-2 border-dashed border-primary/50 bg-primary/5"
          : "border-border bg-surface-muted hover:border-primary/50",
      )}
      {...attributes}
      {...listeners}
    >
      <div className={cn(isDragging && "invisible")}>
        <FavoriteCardContent
          stock={stock}
          language={language}
          exchangeRate={exchangeRate}
        />
      </div>
      <Button
        variant="secondary"
        size="icon-sm"
        loading={removing}
        onMouseDown={stopDrag}
        onTouchStart={stopDrag}
        onClick={(event) => {
          event.stopPropagation();
          onRemove();
        }}
        title={language === "ko" ? "관심종목 제거" : "Remove favorite"}
        aria-label={language === "ko" ? "관심종목 제거" : "Remove favorite"}
        className={cn(
          "absolute right-2 top-2 text-muted",
          isDragging && "invisible",
        )}
      >
        <Trash2 size={16} />
      </Button>
    </div>
  );
}
