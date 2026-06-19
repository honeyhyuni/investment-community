"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Pencil,
  PieChart,
  Plus,
  RefreshCw,
  Star,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
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
import { SegmentedControl } from "@/common/components/SegmentedControl";
import { Skeleton } from "@/common/components/Skeleton";
import { useSessionStore } from "@/common/stores/session";
import { useMarketDataStore } from "@/common/stores/market-data";
import { usePreferencesStore } from "@/common/stores/preferences";
import { convertMoneyValue, formatMoney, formatNumber } from "@/common/utils/format";
import { stockSearchScore } from "@/common/utils/stock-search";
import {
  FavoriteStock,
  Portfolio,
  PortfolioPosition,
  PortfolioPositionInput,
  StockSymbol,
} from "@/common/types";

type PortfolioTab = "watchlist" | "portfolio";
type PortfolioSort = "weight" | "profit";

type PositionDraft = {
  key: string;
  query: string;
  symbol: string;
  market: "US" | "KR";
  name: string;
  quantity: string;
  averagePrice: string;
};

const PIE_COLORS = [
  "#2563eb",
  "#16a34a",
  "#f97316",
  "#9333ea",
  "#dc2626",
  "#0891b2",
  "#ca8a04",
  "#4f46e5",
  "#db2777",
  "#0f766e",
];

export function FavoritesPage({
  initialTab = "watchlist",
}: {
  initialTab?: PortfolioTab;
}) {
  const router = useRouter();
  const accessToken = useSessionStore((s) => s.accessToken);
  const language = usePreferencesStore((s) => s.language);
  const exchangeRate = useMarketDataStore((s) => s.exchangeRate);
  const usSymbols = useMarketDataStore((s) => s.usSymbols);
  const krSymbols = useMarketDataStore((s) => s.krSymbols);
  const livePrices = useMarketDataStore((s) => s.livePrices);
  const [activeTab, setActiveTab] = useState<PortfolioTab>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  function switchTab(tab: PortfolioTab) {
    setActiveTab(tab);
    router.push(tab === "portfolio" ? "/favorites/portfolio" : "/favorites");
  }

  return (
    <div className="grid min-w-0 flex-1 gap-4 py-4 sm:gap-6 sm:py-6">
      <section className="-mx-4 min-w-0 border-y border-border bg-surface p-4 shadow-sm sm:mx-0 sm:rounded-lg sm:border sm:p-5">
        <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
          <SectionHeader
            eyebrow={language === "ko" ? "Portfolio" : "Portfolio"}
            title={language === "ko" ? "포트폴리오 대쉬보드" : "Portfolio Dashboard"}
          />
          <SegmentedControl<PortfolioTab>
            className="w-full sm:inline-flex sm:w-auto"
            aria-label={language === "ko" ? "포트폴리오 화면 선택" : "Portfolio view"}
            options={[
              {
                value: "watchlist",
                label: (
                  <span className="flex flex-col items-center leading-tight">
                    <span>{language === "ko" ? "내 관심종목" : "Watchlist"}</span>
                    <span className="text-[11px] font-medium opacity-80">
                      {language === "ko" ? "저장한 종목" : "Saved stocks"}
                    </span>
                  </span>
                ),
              },
              {
                value: "portfolio",
                label: (
                  <span className="flex flex-col items-center leading-tight">
                    <span>{language === "ko" ? "포트폴리오" : "Portfolio"}</span>
                    <span className="text-[11px] font-medium opacity-80">
                      {language === "ko" ? "비중/수익률" : "Allocation"}
                    </span>
                  </span>
                ),
              },
            ]}
            value={activeTab}
            onChange={switchTab}
          />
        </div>

        {activeTab === "watchlist" ? (
          <WatchlistSection
            accessToken={accessToken}
            language={language}
            exchangeRate={exchangeRate}
          />
        ) : (
          <PortfolioSection
            accessToken={accessToken}
            language={language}
            exchangeRate={exchangeRate}
            usSymbols={usSymbols}
            krSymbols={krSymbols}
            livePrices={livePrices}
          />
        )}
      </section>
    </div>
  );
}

function WatchlistSection({
  accessToken,
  language,
  exchangeRate,
}: {
  accessToken: string | null;
  language: "en" | "ko";
  exchangeRate: number | null;
}) {
  const [favorites, setFavorites] = useState<FavoriteStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [removingKey, setRemovingKey] = useState("");
  const [editing, setEditing] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

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
                ? "愿?ъ쥌紐⑹쓣 遺덈윭?ㅼ? 紐삵뻽?듬땲??"
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
    window.location.assign(
      `/?symbol=${encodeURIComponent(stock.symbol)}&market=${stock.market}&currency=${currency}`,
    );
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
            ? "?쒖꽌瑜???ν븯吏 紐삵뻽?듬땲??"
            : "Could not save the new order.",
      );
    }
  }

  return (
    <div className="pt-4">
      {error ? <Notice message="" error={error} /> : null}
      <div className="flex items-center justify-between gap-3">
        <SectionHeader
          eyebrow="Watchlist"
          title={language === "ko" ? "내 관심종목" : "My Watchlist"}
        />
        {favorites.length ? (
          <Button
            variant={editing ? "primary" : "secondary"}
            size="sm"
            onClick={() => setEditing((prev) => !prev)}
            leftIcon={editing ? <Check size={16} /> : <Pencil size={16} />}
            className="shrink-0"
          >
            {editing ? "완료" : "편집"}
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
            <p className="mb-5 mt-5 text-xs text-muted">카드를 드래그해 순서를 바꾸거나 휴지통으로 제거하세요.</p>
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
          <Star size={28} className="mx-auto text-[#f4b400]" fill="currentColor" />
          <p className="mt-3 text-base font-semibold text-foreground">
            아직 관심종목이 없습니다.
          </p>
          <p className="mt-1 text-sm text-muted">
            종목 상세에서 별 아이콘을 눌러 관심종목에 추가하세요.
          </p>
        </div>
      )}
    </div>
  );
}

function PortfolioSection({  accessToken,
  language,
  exchangeRate,
  usSymbols,
  krSymbols,
  livePrices,
}: {
  accessToken: string | null;
  language: "en" | "ko";
  exchangeRate: number | null;
  usSymbols: StockSymbol[];
  krSymbols: StockSymbol[];
  livePrices: Record<string, { price: number; change?: number; percentChange?: number }>;
}) {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingPortfolioId, setEditingPortfolioId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [portfolioName, setPortfolioName] = useState("");
  const [drafts, setDrafts] = useState<PositionDraft[]>([makeDraft()]);
  const [displayCurrency, setDisplayCurrency] = useState<"USD" | "KRW">("KRW");
  const [portfolioSort, setPortfolioSort] = useState<PortfolioSort>("weight");
  const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);

  const stockSymbols = useMemo(() => [...krSymbols, ...usSymbols], [krSymbols, usSymbols]);
  const selectedPortfolios = useMemo(
    () => portfolios.filter((portfolio) => selectedIds.includes(portfolio.id)),
    [portfolios, selectedIds],
  );
  const rows = useMemo(
    () => buildPortfolioRows(selectedPortfolios, displayCurrency, exchangeRate, livePrices),
    [selectedPortfolios, displayCurrency, exchangeRate, livePrices],
  );
  const sortedRows = useMemo(() => {
    const nextRows = [...rows];
    if (portfolioSort === "profit") {
      return nextRows.sort((a, b) => {
        const profitA = a.profitRate ?? Number.NEGATIVE_INFINITY;
        const profitB = b.profitRate ?? Number.NEGATIVE_INFINITY;
        if (profitB !== profitA) {
          return profitB - profitA;
        }
        return b.displayValue - a.displayValue;
      });
    }
    return nextRows.sort((a, b) => b.percent - a.percent);
  }, [portfolioSort, rows]);
  const totalValue = rows.reduce((sum, row) => sum + row.displayValue, 0);
  const totalCost = rows.reduce((sum, row) => sum + row.displayCost, 0);
  const totalProfitAmount = totalValue - totalCost;
  const totalProfitRate = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : null;

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    loadPortfolios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  useEffect(() => {
    const symbols = rows.filter((row) => row.market === "US").map((row) => row.symbol);
    if (symbols.length > 0) {
      window.dispatchEvent(
        new CustomEvent("market:subscribe", { detail: [...new Set(symbols)] }),
      );
    }
  }, [rows]);

  async function loadPortfolios() {
    if (!accessToken) {
      return;
    }
    setLoading(true);
    try {
      const items = await apiRequest<Portfolio[]>("/markets/portfolios", "GET", {
        accessToken,
      });
      setPortfolios(items);
      setSelectedIds((prev) => {
        const liveIds = new Set(items.map((item) => item.id));
        const next = prev.filter((id) => liveIds.has(id));
        return next.length ? next : items.map((item) => item.id);
      });
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "포트폴리오를 불러오지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }

  function resetPortfolioForm() {
    setPortfolioName("");
    setDrafts([makeDraft()]);
    setEditingPortfolioId(null);
    setShowForm(false);
  }

  function startCreatePortfolio() {
    setPortfolioName("");
    setDrafts([makeDraft()]);
    setEditingPortfolioId(null);
    setConfirmDeleteId(null);
    setError("");
    setShowForm(true);
  }

  function startEditPortfolio(portfolio: Portfolio) {
    setPortfolioName(portfolio.name);
    setDrafts(
      portfolio.positions.length
        ? portfolio.positions.map((position) => ({
            key: crypto.randomUUID(),
            query: `${position.symbol} ${position.name ?? ""}`.trim(),
            symbol: position.symbol,
            market: position.market,
            name: position.name ?? position.symbol,
            quantity: String(position.quantity || ""),
            averagePrice: position.averagePrice > 0 ? String(position.averagePrice) : "",
          }))
        : [makeDraft()],
    );
    setEditingPortfolioId(portfolio.id);
    setConfirmDeleteId(null);
    setError("");
    setShowForm(true);
  }

  async function savePortfolio() {
    if (!accessToken) {
      return;
    }
    if (!portfolioName.trim()) {
      setError("포트폴리오 이름은 필수입니다.");
      return;
    }

    const positions: PortfolioPositionInput[] = drafts.flatMap((draft) => {
      const symbol = (draft.symbol || draft.query).trim().toUpperCase();
      const quantity = Number(draft.quantity);
      const averagePrice = Number(draft.averagePrice);
      if (!symbol || !Number.isFinite(quantity) || quantity <= 0) {
        return [];
      }
      return {
        symbol,
        market: draft.market,
        name: draft.name || symbol,
        quantity,
        averagePrice: Number.isFinite(averagePrice) && averagePrice > 0 ? averagePrice : 0,
      };
    });

    if (positions.length === 0) {
      setError("종목과 수량을 입력해 주세요.");
      return;
    }

    setSaving(true);
    try {
      if (editingPortfolioId) {
        const updated = await apiRequest<Portfolio>(
          `/markets/portfolios/${editingPortfolioId}`,
          "PATCH",
          {
            accessToken,
            body: { name: portfolioName.trim(), positions },
          },
        );
        setPortfolios((items) =>
          items.map((item) => (item.id === updated.id ? updated : item)),
        );
      } else {
        const created = await apiRequest<Portfolio>("/markets/portfolios", "POST", {
          accessToken,
          body: { name: portfolioName.trim(), positions },
        });
        setPortfolios((items) => [created, ...items]);
        setSelectedIds((ids) => [...new Set([created.id, ...ids])]);
      }
      resetPortfolioForm();
      setError("");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "포트폴리오를 저장하지 못했습니다.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deletePortfolio(id: string) {
    if (!accessToken) {
      return;
    }
    await apiRequest<{ ok: true }>(`/markets/portfolios/${id}`, "DELETE", {
      accessToken,
    });
    setPortfolios((items) => items.filter((item) => item.id !== id));
    setSelectedIds((ids) => ids.filter((selectedId) => selectedId !== id));
    setConfirmDeleteId(null);
    if (editingPortfolioId === id) {
      resetPortfolioForm();
    }
  }

  function updateDraft(key: string, patch: Partial<PositionDraft>) {
    setDrafts((items) =>
      items.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  }

  function selectSymbol(key: string, symbol: StockSymbol) {
    const market = symbol.currency === "KRW" ? "KR" : "US";
    updateDraft(key, {
      query: `${symbol.symbol} ${symbol.description}`,
      symbol: symbol.symbol,
      market,
      name: symbol.description,
    });
  }

  function openStock(row: PortfolioRow) {
    const currency = row.market === "KR" ? "KRW" : "USD";
    window.location.assign(
      `/?symbol=${encodeURIComponent(row.symbol)}&market=${row.market}&currency=${currency}`,
    );
  }

  return (
    <div className="pt-4">
      {error ? <Notice message="" error={error} /> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SectionHeader
          eyebrow="Portfolio"
          title={language === "ko" ? "포트폴리오" : "Portfolio"}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<RefreshCw size={15} />}
            onClick={loadPortfolios}
            loading={loading}
          >
            새로고침
          </Button>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus size={15} />}
            onClick={startCreatePortfolio}
          >
            포트폴리오 추가
          </Button>
        </div>
      </div>

      {showForm ? (
        <div className="mt-4 rounded-lg border border-border bg-surface-muted p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-base font-semibold text-foreground">
              {editingPortfolioId ? "포트폴리오 수정" : "새 포트폴리오"}
            </p>
            <button
              type="button"
              onClick={resetPortfolioForm}
              className="grid size-8 cursor-pointer place-items-center rounded-md text-muted hover:bg-surface hover:text-primary"
              aria-label="닫기"
            >
              <X size={17} />
            </button>
          </div>
          <input
            value={portfolioName}
            onChange={(event) => setPortfolioName(event.target.value)}
            placeholder="포트폴리오 이름"
            className="mt-4 h-11 w-full rounded-md border border-border bg-surface px-3 text-sm font-semibold text-foreground outline-none focus:border-primary"
          />
          <div className="mt-4 grid gap-3">
            {drafts.map((draft, index) => (
              <PositionDraftRow
                key={draft.key}
                draft={draft}
                index={index}
                stockSymbols={stockSymbols}
                onChange={(patch) => updateDraft(draft.key, patch)}
                onSelect={(symbol) => selectSymbol(draft.key, symbol)}
                onRemove={() =>
                  setDrafts((items) => items.filter((item) => item.key !== draft.key))
                }
                canRemove={drafts.length > 1}
              />
            ))}
          </div>
          <div className="mt-4 flex flex-wrap justify-between gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setDrafts((items) => [...items, makeDraft()])}
            >
              종목 추가
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={resetPortfolioForm}>
                취소
              </Button>
              <Button variant="primary" size="sm" onClick={savePortfolio} loading={saving}>
                {editingPortfolioId ? "수정 저장" : "저장"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
          <Skeleton className="h-80 rounded-lg" />
          <Skeleton className="h-80 rounded-lg" />
        </div>
      ) : portfolios.length ? (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            {portfolios.map((portfolio) => {
              const selected = selectedIds.includes(portfolio.id);
              return (
                <button
                  key={portfolio.id}
                  type="button"
                  onClick={() =>
                    setSelectedIds((ids) =>
                      selected
                        ? ids.filter((id) => id !== portfolio.id)
                        : [...ids, portfolio.id],
                    )
                  }
                  className={cn(
                    "flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-semibold transition-colors",
                    selected
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-surface-muted text-muted hover:border-primary/40 hover:text-primary",
                  )}
                >
                  {portfolio.name}
                  <span className="text-xs opacity-70">{portfolio.positions.length}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
            <div className="rounded-lg border border-border bg-surface-muted p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Total value
                  </p>
                  <p className="mt-1 text-2xl font-bold text-foreground">
                    {formatMoney(totalValue, displayCurrency, displayCurrency, exchangeRate)}
                    {totalProfitRate !== null ? (
                      <span
                        className={cn(
                          "ml-2 align-middle text-base font-bold",
                          totalProfitRate >= 0 ? "text-positive" : "text-negative",
                        )}
                      >
                        {totalProfitRate >= 0 ? "+" : ""}
                        {formatNumber(totalProfitRate)}% (
                        {formatProfitAmount(totalProfitAmount, displayCurrency)})
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className="grid grid-cols-2 rounded-md border border-border bg-surface p-1">
                  {(["KRW", "USD"] as const).map((currency) => (
                    <button
                      key={currency}
                      type="button"
                      onClick={() => setDisplayCurrency(currency)}
                      className={cn(
                        "h-8 cursor-pointer rounded-md px-3 text-xs font-bold",
                        displayCurrency === currency
                          ? "bg-primary text-white"
                          : "text-muted hover:text-primary",
                      )}
                    >
                      {currency === "KRW" ? "원" : "$"}
                    </button>
                  ))}
                </div>
              </div>
              <PortfolioPieChart
                rows={rows}
                totalValue={totalValue}
                hoveredSlice={hoveredSlice}
                onHover={setHoveredSlice}
              />
            </div>

            <div className="rounded-lg border border-border bg-surface-muted p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <PieChart size={17} className="text-primary" />
                  <p className="text-sm font-semibold text-foreground">
                    {language === "ko" ? "구성비중" : "Allocation"}
                  </p>
                </div>
                <SegmentedControl<PortfolioSort>
                  className="w-full sm:w-auto"
                  buttonClassName="px-3 py-1.5 text-xs"
                  aria-label={language === "ko" ? "포트폴리오 정렬" : "Portfolio sort"}
                  options={[
                    {
                      value: "weight",
                      label: language === "ko" ? "보유비중순" : "Weight",
                    },
                    {
                      value: "profit",
                      label: language === "ko" ? "평가수익률순" : "Return",
                    },
                  ]}
                  value={portfolioSort}
                  onChange={setPortfolioSort}
                />
              </div>
              <div className="mt-4 grid max-h-[28rem] gap-2 overflow-y-auto pr-1">
                {sortedRows.map((row) => (
                  <button
                    key={`${row.market}-${row.symbol}`}
                    type="button"
                    onClick={() => openStock(row)}
                    onMouseEnter={() => setHoveredSlice(row.key)}
                    onMouseLeave={() => setHoveredSlice(null)}
                    className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2 text-left transition-colors hover:border-primary/50"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="size-3 shrink-0 rounded-full"
                        style={{ backgroundColor: row.color }}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {row.market === "KR" ? row.name || row.symbol : row.symbol}
                        </p>
                        <p className="text-xs text-muted">
                          {row.market} ·{" "}
                          {row.market === "KR" ? row.symbol : row.name || row.symbol} ·{" "}
                          {formatNumber(row.quantity)}주
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold text-foreground">
                        {formatMoney(row.displayValue, displayCurrency, displayCurrency, exchangeRate)}
                      </p>
                      <p className="text-xs font-semibold text-muted">
                        {formatNumber(row.percent)}%
                      </p>
                      {row.profitRate !== null ? (
                        <p
                          className={cn(
                            "text-xs font-bold",
                            row.profitAmount >= 0 ? "text-positive" : "text-negative",
                          )}
                        >
                          {row.profitRate >= 0 ? "+" : ""}
                          {formatNumber(row.profitRate)}% (
                          {formatProfitAmount(row.profitAmount, displayCurrency)})
                        </p>
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            {portfolios.map((portfolio) => {
              const confirming = confirmDeleteId === portfolio.id;
              return (
                <div
                  key={portfolio.id}
                  className="rounded-lg border border-border bg-surface-muted p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-base font-bold text-foreground">{portfolio.name}</p>
                      <p className="text-xs text-muted">
                        {portfolio.positions.length}개 종목
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        leftIcon={<Pencil size={15} />}
                        onClick={() => startEditPortfolio(portfolio)}
                      >
                        수정
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        leftIcon={<Trash2 size={15} />}
                        onClick={() => setConfirmDeleteId(portfolio.id)}
                      >
                        삭제
                      </Button>
                    </div>
                  </div>
                  {confirming ? (
                    <div className="mt-3 flex flex-col gap-3 rounded-md border border-negative/30 bg-negative-surface p-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm font-semibold text-negative">
                        정말 삭제하시겠습니까?
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          아니오
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => deletePortfolio(portfolio.id)}
                        >
                          예
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-md border border-dashed border-border bg-surface-muted px-4 py-12 text-center">
          <PieChart size={32} className="mx-auto text-primary" />
          <p className="mt-3 text-base font-semibold text-foreground">
            아직 포트폴리오가 없습니다.
          </p>
          <p className="mt-1 text-sm text-muted">
            포트폴리오 추가를 눌러 종목과 보유 수량을 입력하세요.
          </p>
        </div>
      )}
    </div>
  );
}

function PositionDraftRow({
  draft,
  index,
  stockSymbols,
  onChange,
  onSelect,
  onRemove,
  canRemove,
}: {
  draft: PositionDraft;
  index: number;
  stockSymbols: StockSymbol[];
  onChange: (patch: Partial<PositionDraft>) => void;
  onSelect: (symbol: StockSymbol) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const suggestions = useMemo(() => {
    if (!draft.query.trim()) {
      return [];
    }
    return stockSymbols
      .map((item) => ({ item, score: portfolioSearchScore(item, draft.query) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(({ item }) => item);
  }, [draft.query, stockSymbols]);

  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_92px_110px_120px_36px]">
        <div className="relative">
          <input
            value={draft.query}
            onChange={(event) =>
              onChange({
                query: event.target.value,
                symbol: "",
                name: "",
              })
            }
            placeholder={`종목 검색 ${index + 1}`}
            className="h-10 w-full rounded-md border border-border bg-surface-muted px-3 text-sm font-semibold text-foreground outline-none focus:border-primary"
          />
          {suggestions.length ? (
            <div className="absolute left-0 right-0 top-11 z-20 overflow-hidden rounded-md border border-border bg-surface shadow-lg">
              {suggestions.map((symbol) => {
                const market = symbol.currency === "KRW" ? "KR" : "US";
                const primary = market === "KR" ? symbol.description : symbol.symbol;
                const secondary = market === "KR" ? symbol.symbol : symbol.description;
                return (
                  <button
                    key={`${symbol.currency}-${symbol.symbol}`}
                    type="button"
                    onClick={() => onSelect(symbol)}
                    className="flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-surface-muted"
                  >
                    <span className="font-semibold text-foreground">{primary}</span>
                    <span className="min-w-0 truncate text-xs text-muted">
                      {secondary}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
        <div className="flex h-10 items-center justify-center rounded-md border border-border bg-surface-muted px-3 text-xs font-bold text-muted">
          {draft.symbol ? (draft.market === "KR" ? "한국" : "미국") : "자동"}
        </div>
        <input
          value={draft.quantity}
          onChange={(event) => onChange({ quantity: event.target.value })}
          placeholder="수량"
          inputMode="decimal"
          className="h-10 rounded-md border border-border bg-surface-muted px-3 text-sm font-semibold text-foreground outline-none focus:border-primary"
        />
        <input
          value={draft.averagePrice}
          onChange={(event) => onChange({ averagePrice: event.target.value })}
          placeholder={draft.market === "KR" ? "1주평균(원)" : "1주평균($)"}
          inputMode="decimal"
          className="h-10 rounded-md border border-border bg-surface-muted px-3 text-sm font-semibold text-foreground outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          className="grid size-10 cursor-pointer place-items-center rounded-md text-muted hover:bg-surface-muted hover:text-negative disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="종목 제거"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

type PortfolioRow = {
  key: string;
  symbol: string;
  market: "US" | "KR";
  name?: string;
  quantity: number;
  averagePrice: number;
  current: number;
  change: number;
  percentChange: number;
  sourceCurrency: "USD" | "KRW";
  displayValue: number;
  displayCost: number;
  profitAmount: number;
  profitRate: number | null;
  percent: number;
  color: string;
};

function buildPortfolioRows(
  portfolios: Portfolio[],
  displayCurrency: "USD" | "KRW",
  exchangeRate: number | null,
  livePrices: Record<string, { price: number; change?: number; percentChange?: number }>,
): PortfolioRow[] {
  const byStock = new Map<
    string,
    PortfolioPosition & { quantity: number; averagePrice: number; cost: number }
  >();
  portfolios
    .flatMap((portfolio) => portfolio.positions)
    .forEach((position) => {
      const key = `${position.market}:${position.symbol}`;
      const current = byStock.get(key);
      const quantity = (current?.quantity ?? 0) + position.quantity;
      const cost = (current?.cost ?? 0) + (position.cost ?? 0);
      byStock.set(key, {
        ...position,
        quantity,
        cost,
        averagePrice: quantity > 0 ? cost / quantity : position.averagePrice,
      });
    });

  const rows = [...byStock.values()].map((position, index) => {
    const live = livePrices[position.symbol];
    const sourceCurrency = (position.currency ?? (position.market === "KR" ? "KRW" : "USD")) as
      | "USD"
      | "KRW";
    const current = live?.price && live.price > 0 ? live.price : position.current;
    const displayValue =
      convertMoneyValue(current * position.quantity, displayCurrency, sourceCurrency, exchangeRate) || 0;
    const displayCost =
      convertMoneyValue(position.cost, displayCurrency, sourceCurrency, exchangeRate) || 0;
    const safeDisplayValue = Number.isFinite(displayValue) ? displayValue : 0;
    const safeDisplayCost = Number.isFinite(displayCost) ? displayCost : 0;
    const profitAmount = safeDisplayValue - safeDisplayCost;
    return {
      key: `${position.market}:${position.symbol}`,
      symbol: position.symbol,
      market: position.market,
      name: position.name,
      quantity: position.quantity,
      averagePrice: position.averagePrice,
      current,
      change: live?.change ?? position.change,
      percentChange: live?.percentChange ?? position.percentChange,
      sourceCurrency,
      displayValue: safeDisplayValue,
      displayCost: safeDisplayCost,
      profitAmount,
      profitRate: safeDisplayCost > 0 ? (profitAmount / safeDisplayCost) * 100 : null,
      percent: 0,
      color: PIE_COLORS[index % PIE_COLORS.length],
    };
  });

  const total = rows.reduce((sum, row) => sum + row.displayValue, 0);
  return rows
    .map((row) => ({
      ...row,
      percent: total > 0 ? (row.displayValue / total) * 100 : 0,
    }))
    .sort((a, b) => b.displayValue - a.displayValue);
}

function PortfolioPieChart({
  rows,
  totalValue,
  hoveredSlice,
  onHover,
}: {
  rows: PortfolioRow[];
  totalValue: number;
  hoveredSlice: string | null;
  onHover: (key: string | null) => void;
}) {
  if (!rows.length || totalValue <= 0) {
    return (
      <div className="mt-6 grid aspect-square max-h-72 place-items-center rounded-full border border-dashed border-border text-sm font-semibold text-muted">
        데이터 없음
      </div>
    );
  }

  let startAngle = -90;
  const active = rows.find((row) => row.key === hoveredSlice) ?? rows[0];
  const activeLabel = active.market === "KR" ? active.name || active.symbol : active.symbol;

  return (
    <div className="mt-6 flex flex-col items-center">
      <svg viewBox="0 0 240 240" className="aspect-square w-full max-w-72">
        {rows.map((row) => {
          if (row.percent >= 99.99) {
            return (
              <circle
                key={row.key}
                cx="120"
                cy="120"
                r={hoveredSlice === row.key ? 98 : 94}
                fill="none"
                stroke={row.color}
                strokeWidth={hoveredSlice === row.key ? 36 : 30}
                className="cursor-pointer transition-all duration-200"
                onMouseEnter={() => onHover(row.key)}
                onMouseLeave={() => onHover(null)}
              />
            );
          }
          const endAngle = startAngle + (row.percent / 100) * 360;
          const d = describeArc(120, 120, hoveredSlice === row.key ? 98 : 94, startAngle, endAngle);
          startAngle = endAngle;
          return (
            <path
              key={row.key}
              d={d}
              fill="none"
              stroke={row.color}
              strokeWidth={hoveredSlice === row.key ? 36 : 30}
              strokeLinecap="round"
              className="cursor-pointer transition-all duration-200"
              opacity={!hoveredSlice || hoveredSlice === row.key ? 1 : 0.45}
              onMouseEnter={() => onHover(row.key)}
              onMouseLeave={() => onHover(null)}
            />
          );
        })}
        <circle cx="120" cy="120" r="62" className="fill-surface" />
        <text x="120" y="112" textAnchor="middle" className="fill-muted text-[12px] font-semibold">
          {activeLabel}
        </text>
        <text x="120" y="135" textAnchor="middle" className="fill-foreground text-[20px] font-bold">
          {formatNumber(active.percent)}%
        </text>
      </svg>
    </div>
  );
}

function describeArc(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
) {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return [
    "M",
    start.x,
    start.y,
    "A",
    radius,
    radius,
    0,
    largeArcFlag,
    0,
    end.x,
    end.y,
  ].join(" ");
}

function polarToCartesian(cx: number, cy: number, radius: number, angle: number) {
  const angleInRadians = ((angle - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians),
  };
}

function makeDraft(): PositionDraft {
  return {
    key: crypto.randomUUID(),
    query: "",
    symbol: "",
    market: "US",
    name: "",
    quantity: "",
    averagePrice: "",
  };
}

function portfolioSearchScore(item: StockSymbol, rawQuery: string): number {
  const query = rawQuery.trim().toLowerCase();
  if (!query) {
    return 0;
  }
  const symbol = item.symbol.toLowerCase();
  const name = item.description.toLowerCase();
  const compactQuery = query.replace(/[^a-z0-9가-힣]/g, "");
  const compactSymbol = symbol.replace(/[^a-z0-9]/g, "");
  const compactName = name.replace(/\s+/g, "");

  if (compactSymbol === compactQuery || compactName === compactQuery) return 150;
  if (compactSymbol.startsWith(compactQuery)) return 130;
  if (compactName.startsWith(compactQuery)) return 125;
  if (compactSymbol.includes(compactQuery)) return 110;
  if (compactName.includes(compactQuery)) return 100;

  const baseScore = stockSearchScore(item, rawQuery);
  const symbolDistance = editDistance(compactSymbol, compactQuery);
  const transposed =
    compactSymbol.length === compactQuery.length &&
    [...compactSymbol].sort().join("") === [...compactQuery].sort().join("");
  const fuzzyScore = transposed ? 95 : symbolDistance <= 2 ? 90 - symbolDistance * 10 : 0;
  return Math.max(baseScore, fuzzyScore);
}

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const current = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        previous + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      previous = current;
    }
  }
  return row[b.length];
}

function formatProfitAmount(value: number, currency: "USD" | "KRW"): string {
  const sign = value >= 0 ? "+" : "-";
  const absolute = Math.abs(value);

  if (currency === "KRW") {
    if (absolute >= 1_0000_0000_0000) {
      return `${sign}${formatCompactAmount(absolute / 1_0000_0000_0000)}조`;
    }
    if (absolute >= 1_0000_0000) {
      return `${sign}${formatCompactAmount(absolute / 1_0000_0000)}억`;
    }
    if (absolute >= 10_000) {
      return `${sign}${formatCompactAmount(absolute / 10_000)}만원`;
    }
    return `${sign}${Math.round(absolute).toLocaleString("ko-KR")}원`;
  }

  return `${sign}${formatCompactAmount(absolute)}$`;
}

function formatCompactAmount(value: number): string {
  return new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: value >= 100 ? 0 : 2,
    minimumFractionDigits: 0,
  }).format(value);
}

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
        <p className="truncate text-base font-semibold text-foreground">{primary}</p>
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
        <span className={`text-sm font-semibold ${positive ? "text-positive" : "text-negative"}`}>
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
      <FavoriteCardContent stock={stock} language={language} exchangeRate={exchangeRate} />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface/50 opacity-0 backdrop-blur-[1px] transition-opacity duration-200 group-hover:opacity-100">
        <span className="text-sm font-semibold text-foreground">
          {language === "ko" ? "상세 보기" : "Show detail"}
        </span>
      </div>
    </button>
  );
}

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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: stock.favoriteId });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const stopDrag = (event: { stopPropagation: () => void }) => event.stopPropagation();

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative cursor-grab rounded-xl border p-4 transition-colors active:cursor-grabbing",
        isDragging
          ? "border-2 border-dashed border-primary/50 bg-primary/5"
          : "border-border bg-surface-muted hover:border-primary/50",
      )}
      {...attributes}
      {...listeners}
    >
      <div className={cn(isDragging && "invisible")}>
        <FavoriteCardContent stock={stock} language={language} exchangeRate={exchangeRate} />
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
        className={cn("absolute right-2 top-2 text-muted", isDragging && "invisible")}
      >
        <Trash2 size={16} />
      </Button>
    </div>
  );
}
