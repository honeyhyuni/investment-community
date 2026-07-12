'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Check,
  Pencil,
  Percent,
  PieChart,
  Plus,
  Search,
  Star,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
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
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/common/utils/cn';
import { apiRequest } from '@/common/lib/api';
import { Button } from '@/common/components/Button';
import { Modal } from '@/common/components/Modal';
import { Notice } from '@/common/components/Notice';
import { SectionHeader } from '@/common/components/SectionHeader';
import { SegmentedControl } from '@/common/components/SegmentedControl';
import { Skeleton } from '@/common/components/Skeleton';
import { useModal } from '@/common/hooks/useModal';
import { useSessionStore } from '@/common/stores/session';
import { useMarketDataStore } from '@/common/stores/market-data';
import { usePreferencesStore } from '@/common/stores/preferences';
import {
  convertMoneyValue,
  formatMoney,
  formatNumber,
} from '@/common/utils/format';
import { stockSearchScore } from '@/common/utils/stock-search';
import {
  FavoriteStock,
  Portfolio,
  PortfolioPosition,
  PortfolioPositionInput,
  PortfolioPerformancePoint,
  StockSymbol,
} from '@/common/types';

type PortfolioTab = 'watchlist' | 'portfolio';
type PortfolioSort = 'weight' | 'profit';

type CompareSymbol = {
  key: string;
  symbol: string;
  market: 'US' | 'KR';
  label: string;
};

type PositionDraft = {
  key: string;
  query: string;
  symbol: string;
  market: 'US' | 'KR';
  name: string;
  quantity: string;
  averagePrice: string;
  startedAt: string;
};

const PIE_COLORS = [
  '#3b82a0',
  '#57a773',
  '#d18b55',
  '#7c75b8',
  '#c76b72',
  '#4f9a94',
  '#b79b4f',
  '#6b8fd6',
  '#b46b9f',
  '#6f8796',
];

// Shared field styling for the portfolio modal inputs. Background is applied per
// use (surface-muted directly on the modal, surface inside a grouped row).
const INPUT_BASE =
  'w-full rounded-lg border border-border text-sm font-semibold text-foreground outline-none transition-colors placeholder:font-medium placeholder:text-muted/60 focus:border-primary focus:ring-2 focus:ring-primary/15';

export function FavoritesPage({
  initialTab = 'watchlist',
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
  const loadStockSymbols = useMarketDataStore((s) => s.loadStockSymbols);
  const [activeTab, setActiveTab] = useState<PortfolioTab>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (accessToken && activeTab === 'portfolio') {
      void loadStockSymbols(accessToken);
    }
  }, [accessToken, activeTab, loadStockSymbols]);

  function switchTab(tab: PortfolioTab) {
    setActiveTab(tab);
    router.push(tab === 'portfolio' ? '/favorites/portfolio' : '/favorites');
  }

  return (
    <div className="grid min-w-0 flex-1 gap-4 py-4 sm:gap-6 sm:py-6">
      <section className="-mx-4 min-w-0 border-y border-border bg-surface p-4 shadow-sm sm:mx-0 sm:rounded-lg sm:border sm:p-5">
        <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
          <SectionHeader
            eyebrow={
              language === 'ko' ? '포트폴리오 대시보드' : 'Portfolio Dashboard'
            }
            title={language === 'ko' ? '내 투자' : 'My'}
          />
          <SegmentedControl<PortfolioTab>
            className="w-full sm:inline-flex sm:w-auto"
            aria-label={
              language === 'ko' ? '포트폴리오 화면 선택' : 'Portfolio view'
            }
            options={[
              {
                value: 'watchlist',
                label: (
                  <span className="flex flex-col items-center leading-tight">
                    <span>
                      {language === 'ko' ? '내 관심종목' : 'Watchlist'}
                    </span>
                    <span className="text-[11px] font-medium opacity-80">
                      {language === 'ko' ? '저장한 종목' : 'Saved stocks'}
                    </span>
                  </span>
                ),
              },
              {
                value: 'portfolio',
                label: (
                  <span className="flex flex-col items-center leading-tight">
                    <span>
                      {language === 'ko' ? '포트폴리오' : 'Portfolio'}
                    </span>
                    <span className="text-[11px] font-medium opacity-80">
                      {language === 'ko' ? '비중/수익률' : 'Allocation'}
                    </span>
                  </span>
                ),
              },
            ]}
            value={activeTab}
            onChange={switchTab}
          />
        </div>

        {activeTab === 'watchlist' ? (
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
  language: 'en' | 'ko';
  exchangeRate: number | null;
}) {
  const [favorites, setFavorites] = useState<FavoriteStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [removingKey, setRemovingKey] = useState('');
  const [editing, setEditing] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 6 },
    }),
  );

  const activeStock = activeId
    ? (favorites.find((s) => s.favoriteId === activeId) ?? null)
    : null;

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    let active = true;
    setLoading(true);
    apiRequest<FavoriteStock[]>('/markets/favorites', 'GET', { accessToken })
      .then((items) => {
        if (active) {
          setFavorites(items);
          setError('');
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : language === 'ko'
                ? '愿?ъ쥌紐⑹쓣 遺덈윭?ㅼ? 紐삵뻽?듬땲??'
                : 'Could not load watchlist.',
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
    const currency = stock.market === 'KR' ? 'KRW' : 'USD';
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
        'DELETE',
        { accessToken },
      );
      setFavorites((items) =>
        items.filter(
          (item) =>
            !(item.symbol === stock.symbol && item.market === stock.market),
        ),
      );
    } finally {
      setRemovingKey('');
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
      await apiRequest<{ ok: true }>('/markets/favorites/reorder', 'PATCH', {
        accessToken,
        body: { favoriteIds: reordered.map((s) => s.favoriteId) },
      });
    } catch (reorderError) {
      setError(
        reorderError instanceof Error
          ? reorderError.message
          : language === 'ko'
            ? '?쒖꽌瑜???ν븯吏 紐삵뻽?듬땲??'
            : 'Could not save the new order.',
      );
    }
  }

  return (
    <div className="pt-4">
      {error ? <Notice message="" error={error} /> : null}
      <div className="flex items-center justify-between gap-3">
        <SectionHeader
          eyebrow="Watchlist"
          title={language === 'ko' ? '내 관심종목' : 'My Watchlist'}
        />
        {favorites.length ? (
          <Button
            variant={editing ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setEditing((prev) => !prev)}
            leftIcon={editing ? <Check size={16} /> : <Pencil size={16} />}
            className="shrink-0"
          >
            {editing ? '완료' : '편집'}
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
              카드를 드래그해 순서를 바꾸거나 휴지통으로 제거하세요.
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
                  <div
                    aria-hidden
                    className={cn(
                      'pointer-events-none absolute -inset-3 rounded-xl border-2 border-primary/40 bg-primary/5 transition-opacity duration-200',
                      activeId ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <div className="relative grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {favorites.map((stock) => (
                      <SortableFavoriteCard
                        key={stock.favoriteId}
                        stock={stock}
                        language={language}
                        exchangeRate={exchangeRate}
                        removing={
                          removingKey === `${stock.market}-${stock.symbol}`
                        }
                        onRemove={() => removeFavorite(stock)}
                      />
                    ))}
                  </div>
                </div>
              </SortableContext>
              <DragOverlay
                dropAnimation={{
                  duration: 220,
                  easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
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

function PortfolioSection({
  accessToken,
  language,
  exchangeRate,
  usSymbols,
  krSymbols,
  livePrices,
}: {
  accessToken: string | null;
  language: 'en' | 'ko';
  exchangeRate: number | null;
  usSymbols: StockSymbol[];
  krSymbols: StockSymbol[];
  livePrices: Record<
    string,
    { price: number; change?: number; percentChange?: number }
  >;
}) {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const portfolioModal = useModal();
  const [editingPortfolioId, setEditingPortfolioId] = useState<string | null>(
    null,
  );
  const [portfolioName, setPortfolioName] = useState('');
  const [drafts, setDrafts] = useState<PositionDraft[]>([makeDraft()]);
  const [displayCurrency, setDisplayCurrency] = useState<'USD' | 'KRW'>('KRW');
  const [portfolioSort, setPortfolioSort] = useState<PortfolioSort>('weight');
  const [performancePeriod, setPerformancePeriod] = useState('1M');
  const [performance, setPerformance] = useState<PortfolioPerformancePoint[]>([]);
  const [performanceLoading, setPerformanceLoading] = useState(false);
  const [compareQuery, setCompareQuery] = useState('');
  const [customCompareSymbols, setCustomCompareSymbols] = useState<CompareSymbol[]>([]);
  const [hiddenCompareKeys, setHiddenCompareKeys] = useState<string[]>([]);
  const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);
  const allocationScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollAllocationUp, setCanScrollAllocationUp] = useState(false);
  const [canScrollAllocationDown, setCanScrollAllocationDown] = useState(false);

  const stockSymbols = useMemo(
    () => [...krSymbols, ...usSymbols],
    [krSymbols, usSymbols],
  );
  const compareSuggestions = useMemo(() => {
    const query = compareQuery.trim();
    if (!query) return [];
    const selected = new Set(customCompareSymbols.map((item) => item.key));
    return stockSymbols
      .map((item) => ({ item, score: portfolioSearchScore(item, query) }))
      .filter(({ item, score }) => score > 0 && !selected.has(compareKeyForSymbol(item)))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(({ item }) => item);
  }, [compareQuery, customCompareSymbols, stockSymbols]);
  const selectedPortfolios = useMemo(
    () => portfolios.filter((portfolio) => selectedIds.includes(portfolio.id)),
    [portfolios, selectedIds],
  );
  const rows = useMemo(
    () =>
      buildPortfolioRows(
        selectedPortfolios,
        displayCurrency,
        exchangeRate,
        livePrices,
      ),
    [selectedPortfolios, displayCurrency, exchangeRate, livePrices],
  );
  const sortedRows = useMemo(() => {
    const nextRows = [...rows];
    if (portfolioSort === 'profit') {
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
  const totalProfitRate =
    totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : null;
  const comparisonPortfolio = portfolios[0] ?? null;
  const emptyPortfolioTitle =
    selectedPortfolios.length === 0
      ? language === 'ko'
        ? '선택된 포트폴리오가 없습니다.'
        : 'No portfolio selected.'
      : language === 'ko'
        ? '선택된 포트폴리오에 종목이 없습니다.'
        : 'No positions in the selected portfolio.';
  const emptyPortfolioBody =
    selectedPortfolios.length === 0
      ? ''
      : language === 'ko'
        ? '포트폴리오를 수정해 보유 종목을 추가해 주세요.'
        : 'Edit the portfolio to add positions.';

  const updateAllocationScrollHint = useCallback(() => {
    const element = allocationScrollRef.current;
    if (!element) {
      setCanScrollAllocationUp(false);
      setCanScrollAllocationDown(false);
      return;
    }

    const remainingScroll =
      element.scrollHeight - element.clientHeight - element.scrollTop;
    setCanScrollAllocationUp(element.scrollTop > 4);
    setCanScrollAllocationDown(remainingScroll > 4);
  }, []);

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    loadPortfolios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  useEffect(() => {
    const symbols = rows
      .filter((row) => row.market === 'US')
      .map((row) => row.symbol);
    if (symbols.length > 0) {
      window.dispatchEvent(
        new CustomEvent('market:subscribe', { detail: [...new Set(symbols)] }),
      );
    }
  }, [rows]);

  useEffect(() => {
    updateAllocationScrollHint();
    window.addEventListener('resize', updateAllocationScrollHint);
    return () =>
      window.removeEventListener('resize', updateAllocationScrollHint);
  }, [sortedRows.length, updateAllocationScrollHint]);

  useEffect(() => {
    if (!accessToken || !comparisonPortfolio) {
      setPerformance([]);
      return;
    }

    const params = new URLSearchParams({ period: performancePeriod });
    if (customCompareSymbols.length) {
      params.set('symbols', customCompareSymbols.map((item) => item.key).join(','));
    }

    let cancelled = false;
    setPerformanceLoading(true);
    apiRequest<PortfolioPerformancePoint[]>(
      `/markets/portfolios/${comparisonPortfolio.id}/performance?${params.toString()}`,
      'GET',
      { accessToken },
    )
      .then((items) => {
        if (!cancelled) setPerformance(items);
      })
      .catch(() => {
        if (!cancelled) setPerformance([]);
      })
      .finally(() => {
        if (!cancelled) setPerformanceLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, comparisonPortfolio, customCompareSymbols, performancePeriod]);

  function addCompareSymbol(symbol: StockSymbol) {
    const normalized = normalizeCompareSymbol(symbol);
    const label = normalized.market === 'KR'
      ? symbol.description || normalized.symbol
      : normalized.symbol;
    setCustomCompareSymbols((items) => {
      if (items.some((item) => item.key === normalized.key)) return items;
      return [...items, { key: normalized.key, symbol: normalized.symbol, market: normalized.market, label }];
    });
    setHiddenCompareKeys((keys) => keys.filter((item) => item !== normalized.key));
    setCompareQuery('');
  }

  function toggleCompareSeries(key: string) {
    setHiddenCompareKeys((keys) =>
      keys.includes(key) ? keys.filter((item) => item !== key) : [...keys, key],
    );
  }

  function removeCompareSymbol(key: string) {
    setCustomCompareSymbols((items) => items.filter((item) => item.key !== key));
    setHiddenCompareKeys((keys) => keys.filter((item) => item !== key));
  }

  async function loadPortfolios() {
    if (!accessToken) {
      return;
    }
    setLoading(true);
    try {
      const items = await apiRequest<Portfolio[]>(
        '/markets/portfolios',
        'GET',
        {
          accessToken,
        },
      );
      setPortfolios(items);
      setSelectedIds((prev) => {
        const liveIds = new Set(items.map((item) => item.id));
        const next = prev.filter((id) => liveIds.has(id));
        return next.length ? next : items.map((item) => item.id);
      });
      setError('');
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : language === 'ko'
            ? '포트폴리오를 불러오지 못했습니다.'
            : 'Could not load portfolios.',
      );
    } finally {
      setLoading(false);
    }
  }

  function resetPortfolioForm() {
    setPortfolioName('');
    setDrafts([makeDraft()]);
    setEditingPortfolioId(null);
    portfolioModal.close();
  }

  function startCreatePortfolio() {
    setPortfolioName('');
    setDrafts([makeDraft()]);
    setEditingPortfolioId(null);
    setError('');
    portfolioModal.open();
  }

  function startEditPortfolio(portfolio: Portfolio) {
    setPortfolioName(portfolio.name);
    setDrafts(
      portfolio.positions.length
        ? portfolio.positions.map((position) => ({
            key: crypto.randomUUID(),
            query: `${position.symbol} ${position.name ?? ''}`.trim(),
            symbol: position.symbol,
            market: position.market,
            name: position.name ?? position.symbol,
            quantity: String(position.quantity || ''),
            averagePrice:
              position.averagePrice > 0 ? String(position.averagePrice) : '',
            startedAt: position.startedAt ?? position.addedAt.slice(0, 10),
          }))
        : [makeDraft()],
    );
    setEditingPortfolioId(portfolio.id);
    setError('');
    portfolioModal.open();
  }

  async function savePortfolio() {
    if (!accessToken) {
      return;
    }
    if (!portfolioName.trim()) {
      setError(
        language === 'ko'
          ? '포트폴리오 이름은 필수입니다.'
          : 'Portfolio name is required.',
      );
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
        averagePrice:
          Number.isFinite(averagePrice) && averagePrice > 0 ? averagePrice : 0,
      };
    });

    if (positions.length === 0) {
      setError(
        language === 'ko'
          ? '종목과 수량을 입력해 주세요.'
          : 'Add at least one stock and quantity.',
      );
      return;
    }

    setSaving(true);
    try {
      if (editingPortfolioId) {
        const updated = await apiRequest<Portfolio>(
          `/markets/portfolios/${editingPortfolioId}`,
          'PATCH',
          {
            accessToken,
            body: { name: portfolioName.trim(), positions },
          },
        );
        setPortfolios((items) =>
          items.map((item) => (item.id === updated.id ? updated : item)),
        );
      } else {
        const created = await apiRequest<Portfolio>(
          '/markets/portfolios',
          'POST',
          {
            accessToken,
            body: { name: portfolioName.trim(), positions },
          },
        );
        setPortfolios((items) => [created, ...items]);
        setSelectedIds((ids) => [...new Set([created.id, ...ids])]);
      }
      resetPortfolioForm();
      setError('');
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : language === 'ko'
            ? '포트폴리오를 저장하지 못했습니다.'
            : 'Could not save portfolio.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function deletePortfolio() {
    if (!accessToken || !editingPortfolioId) {
      return;
    }
    const target = portfolios.find((item) => item.id === editingPortfolioId);
    const confirmed = window.confirm(
      language === 'ko'
        ? `'${target?.name ?? ''}' 포트폴리오를 삭제할까요? 되돌릴 수 없습니다.`
        : `Delete portfolio '${target?.name ?? ''}'? This cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }

    setDeleting(true);
    try {
      await apiRequest<{ ok: true }>(
        `/markets/portfolios/${editingPortfolioId}`,
        'DELETE',
        { accessToken },
      );
      const removedId = editingPortfolioId;
      setPortfolios((items) => items.filter((item) => item.id !== removedId));
      setSelectedIds((ids) => ids.filter((id) => id !== removedId));
      resetPortfolioForm();
      setError('');
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : language === 'ko'
            ? '포트폴리오를 삭제하지 못했습니다.'
            : 'Could not delete portfolio.',
      );
    } finally {
      setDeleting(false);
    }
  }

  function updateDraft(key: string, patch: Partial<PositionDraft>) {
    setDrafts((items) =>
      items.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  }

  function selectSymbol(key: string, symbol: StockSymbol) {
    const market = symbol.currency === 'KRW' ? 'KR' : 'US';
    updateDraft(key, {
      query: `${symbol.symbol} ${symbol.description}`,
      symbol: symbol.symbol,
      market,
      name: symbol.description,
    });
  }

  function openStock(row: PortfolioRow) {
    const currency = row.market === 'KR' ? 'KRW' : 'USD';
    window.location.assign(
      `/?symbol=${encodeURIComponent(row.symbol)}&market=${row.market}&currency=${currency}`,
    );
  }

  return (
    <div className="pt-4">
      {error ? <Notice message="" error={error} /> : null}

      <Modal
        open={portfolioModal.isOpen}
        onClose={resetPortfolioForm}
        closeLabel={language === 'ko' ? '닫기' : 'Close'}
        size="lg"
        title={
          editingPortfolioId
            ? language === 'ko'
              ? '포트폴리오 수정'
              : 'Edit portfolio'
            : language === 'ko'
              ? '새 포트폴리오'
              : 'New portfolio'
        }
        footerClassName={editingPortfolioId ? 'justify-between' : 'justify-end'}
        footer={
          <>
            {editingPortfolioId ? (
              <Button
                variant="ghost-danger"
                size="sm"
                onClick={deletePortfolio}
                loading={deleting}
                leftIcon={<Trash2 size={15} />}
              >
                {language === 'ko' ? '삭제' : 'Delete'}
              </Button>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={resetPortfolioForm}
              >
                {language === 'ko' ? '취소' : 'Cancel'}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={savePortfolio}
                loading={saving}
              >
                {editingPortfolioId
                  ? language === 'ko'
                    ? '수정 저장'
                    : 'Save changes'
                  : language === 'ko'
                    ? '저장'
                    : 'Save'}
              </Button>
            </div>
          </>
        }
      >
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-muted">
            {language === 'ko' ? '포트폴리오 이름' : 'Portfolio name'}
          </span>
          <input
            value={portfolioName}
            onChange={(event) => setPortfolioName(event.target.value)}
            placeholder={
              language === 'ko' ? '예: 미국 성장주' : 'e.g. US Growth'
            }
            className={cn(INPUT_BASE, 'h-11 bg-surface-muted px-3.5')}
          />
        </label>
        <div className="mb-2 mt-5 flex items-center justify-between">
          <span className="text-xs font-semibold text-muted">
            {language === 'ko' ? '보유 종목' : 'Holdings'}
          </span>
          <span className="text-xs font-medium text-muted/70">
            {drafts.length}
            {language === 'ko' ? '개' : ''}
          </span>
        </div>
        <div className="grid gap-3">
          {drafts.map((draft, index) => (
            <PositionDraftRow
              key={draft.key}
              draft={draft}
              index={index}
              stockSymbols={stockSymbols}
              language={language}
              onChange={(patch) => updateDraft(draft.key, patch)}
              onSelect={(symbol) => selectSymbol(draft.key, symbol)}
              onRemove={() =>
                setDrafts((items) =>
                  items.filter((item) => item.key !== draft.key),
                )
              }
              canRemove={drafts.length > 1}
            />
          ))}
          <button
            type="button"
            onClick={() => setDrafts((items) => [...items, makeDraft()])}
            className="flex h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-border text-sm font-semibold text-muted transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
          >
            <Plus size={16} />
            {language === 'ko' ? '종목 추가' : 'Add stock'}
          </button>
        </div>
      </Modal>

      {loading ? (
        <>
          <PortfolioPerformanceChart
            points={performance}
            loading={performanceLoading}
            period={performancePeriod}
            onPeriodChange={setPerformancePeriod}
            portfolioName={''}
            language={language}
            customSymbols={customCompareSymbols}
            hiddenKeys={hiddenCompareKeys}
            compareQuery={compareQuery}
            compareSuggestions={compareSuggestions}
            onCompareQueryChange={setCompareQuery}
            onAddCompareSymbol={addCompareSymbol}
            onToggleSeries={toggleCompareSeries}
            onRemoveCustomSymbol={removeCompareSymbol}
          />
          <div className="mt-6 flex h-9 flex-wrap gap-2 overflow-hidden">
            <Skeleton className="h-9 w-28 rounded-md" />
            <Skeleton className="h-9 w-36 rounded-md" />
            <Skeleton className="h-9 w-24 rounded-md" />
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
            <div className="rounded-lg border border-border bg-surface-muted p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="size-[17px] rounded" />
                  <Skeleton className="h-5 w-24 rounded" />
                </div>
                <Skeleton className="h-8 w-24 rounded-md" />
              </div>
              <div className="mt-4 h-80 overflow-hidden">
                <Skeleton className="h-8 w-48 rounded" />
                <div className="mt-4 flex h-[17rem] items-center justify-center">
                  <Skeleton className="size-64 rounded-full" />
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-surface-muted p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Skeleton className="size-[17px] rounded" />
                  <Skeleton className="h-5 w-20 rounded" />
                </div>
                <Skeleton className="h-8 w-36 rounded-md" />
              </div>
              <div className="mt-4 grid h-80 content-start gap-2 overflow-hidden pr-1">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-[4.25rem] rounded-md" />
                ))}
              </div>
            </div>
          </div>
        </>
      ) : portfolios.length ? (
        <>
          <PortfolioPerformanceChart
            points={performance}
            loading={performanceLoading}
            period={performancePeriod}
            onPeriodChange={setPerformancePeriod}
            portfolioName={''}
            language={language}
            customSymbols={customCompareSymbols}
            hiddenKeys={hiddenCompareKeys}
            compareQuery={compareQuery}
            compareSuggestions={compareSuggestions}
            onCompareQueryChange={setCompareQuery}
            onAddCompareSymbol={addCompareSymbol}
            onToggleSeries={toggleCompareSeries}
            onRemoveCustomSymbol={removeCompareSymbol}
          />
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SectionHeader
              eyebrow="Portfolio"
              title={language === 'ko' ? '\uD3EC\uD2B8\uD3F4\uB9AC\uC624' : 'Portfolio'}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadPortfolios}
                loading={loading}
                className="shrink-0"
              >
                {language === 'ko' ? '\uC0C8\uB85C\uACE0\uCE68' : 'Refresh'}
              </Button>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus size={15} />}
                onClick={startCreatePortfolio}
              >
                {language === 'ko' ? '\uD3EC\uD2B8\uD3F4\uB9AC\uC624 \uCD94\uAC00' : 'Add portfolio'}
              </Button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {portfolios.map((portfolio) => {
              const selected = selectedIds.includes(portfolio.id);
              return (
                <span
                  key={portfolio.id}
                  className={cn(
                    'inline-flex h-9 max-w-full overflow-hidden rounded-md border text-sm font-semibold transition-colors',
                    selected
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-surface-muted text-muted hover:border-primary/40 hover:text-primary',
                  )}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedIds((ids) =>
                        selected
                          ? ids.filter((id) => id !== portfolio.id)
                          : [...ids, portfolio.id],
                      )
                    }
                    className="flex h-full min-w-0 cursor-pointer items-center gap-2 px-3"
                    aria-pressed={selected}
                  >
                    <span className="max-w-40 truncate">{portfolio.name}</span>
                    <span className="text-xs opacity-70">
                      {portfolio.positions.length}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => startEditPortfolio(portfolio)}
                    className={cn(
                      'grid h-full w-8 shrink-0 cursor-pointer place-items-center border-l transition-colors',
                      selected
                        ? 'border-primary/20 text-primary hover:bg-primary/10'
                        : 'border-border text-muted hover:bg-surface hover:text-primary',
                    )}
                    aria-label={
                      language === 'ko'
                        ? `${portfolio.name} 수정`
                        : `Edit ${portfolio.name}`
                    }
                    title={language === 'ko' ? '수정' : 'Edit'}
                  >
                    <Pencil size={14} />
                  </button>
                </span>
              );
            })}
            <button
              type="button"
              onClick={startCreatePortfolio}
              className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-md border border-dashed border-border bg-surface-muted text-muted transition-colors hover:border-primary/40 hover:text-primary"
              aria-label={
                language === 'ko' ? '포트폴리오 추가' : 'Add portfolio'
              }
              title={language === 'ko' ? '포트폴리오 추가' : 'Add portfolio'}
            >
              <Plus size={16} />
            </button>
          </div>


          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
            <div className="rounded-lg border border-border bg-surface-muted p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <PieChart size={17} className="text-primary" />
                  <p className="text-sm font-semibold text-foreground">
                    {language === 'ko' ? '총 평가금액' : 'Total value'}
                  </p>
                </div>
                <SegmentedControl<'KRW' | 'USD'>
                  className="shrink-0"
                  buttonClassName="px-3 py-1.5 text-xs"
                  aria-label={
                    language === 'ko' ? '표시 통화' : 'Display currency'
                  }
                  options={[
                    { value: 'KRW', label: language === 'ko' ? '원' : 'KRW' },
                    { value: 'USD', label: language === 'ko' ? '$' : 'USD' },
                  ]}
                  value={displayCurrency}
                  onChange={setDisplayCurrency}
                />
              </div>
              {rows.length ? (
                <div className="mt-4 flex h-80 min-h-0 flex-col overflow-hidden">
                  <p className="text-2xl font-bold text-foreground">
                    {formatMoney(
                      totalValue,
                      displayCurrency,
                      displayCurrency,
                      exchangeRate,
                    )}
                    {totalProfitRate !== null ? (
                      <span
                        className={cn(
                          'ml-2 align-middle text-base font-bold',
                          totalProfitRate >= 0
                            ? 'text-positive'
                            : 'text-negative',
                        )}
                      >
                        {totalProfitRate >= 0 ? '+' : ''}
                        {formatNumber(totalProfitRate)}% (
                        {formatProfitAmount(totalProfitAmount, displayCurrency)}
                        )
                      </span>
                    ) : null}
                  </p>
                  <PortfolioPieChart
                    rows={rows}
                    totalValue={totalValue}
                    hoveredSlice={hoveredSlice}
                    onHover={setHoveredSlice}
                    language={language}
                    displayCurrency={displayCurrency}
                    exchangeRate={exchangeRate}
                  />
                </div>
              ) : (
                <PortfolioEmptyState
                  icon="chart"
                  title={emptyPortfolioTitle}
                  body={emptyPortfolioBody}
                />
              )}
            </div>

            <div className="rounded-lg border border-border bg-surface-muted p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Percent size={17} className="text-primary" />
                  <p className="text-sm font-semibold text-foreground">
                    {language === 'ko' ? '구성비중' : 'Allocation'}
                  </p>
                </div>
                <SegmentedControl<PortfolioSort>
                  className="w-full sm:w-auto"
                  buttonClassName="px-3 py-1.5 text-xs"
                  aria-label={
                    language === 'ko' ? '포트폴리오 정렬' : 'Portfolio sort'
                  }
                  options={[
                    {
                      value: 'weight',
                      label: language === 'ko' ? '보유비중순' : 'Weight',
                    },
                    {
                      value: 'profit',
                      label: language === 'ko' ? '평가수익률순' : 'Return',
                    },
                  ]}
                  value={portfolioSort}
                  onChange={setPortfolioSort}
                />
              </div>
              {sortedRows.length ? (
                <div className="relative mt-4">
                  <div
                    ref={allocationScrollRef}
                    onScroll={updateAllocationScrollHint}
                    className="grid h-80 content-start gap-2 overflow-y-auto pr-1"
                  >
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
                              {row.market === 'KR'
                                ? row.name || row.symbol
                                : row.symbol}
                            </p>
                            <p className="text-xs text-muted">
                              {row.market} ·{' '}
                              {row.market === 'KR'
                                ? row.symbol
                                : row.name || row.symbol}{' '}
                              · {formatNumber(row.quantity)}
                              {language === 'ko' ? '주' : ' shares'}
                            </p>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-bold text-foreground">
                            {formatMoney(
                              row.displayValue,
                              displayCurrency,
                              displayCurrency,
                              exchangeRate,
                            )}
                          </p>
                          <p className="text-xs font-semibold text-muted">
                            {formatNumber(row.percent)}%
                          </p>
                          {row.profitRate !== null ? (
                            <p
                              className={cn(
                                'text-xs font-bold',
                                row.profitAmount >= 0
                                  ? 'text-positive'
                                  : 'text-negative',
                              )}
                            >
                              {row.profitRate >= 0 ? '+' : ''}
                              {formatNumber(row.profitRate)}% (
                              {formatProfitAmount(
                                row.profitAmount,
                                displayCurrency,
                              )}
                              )
                            </p>
                          ) : null}
                        </div>
                      </button>
                    ))}
                  </div>
                  <div
                    className={`pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-surface-muted via-surface-muted/90 to-transparent backdrop-blur-[1px] transition-opacity duration-200 ${
                      canScrollAllocationUp ? 'opacity-100' : 'opacity-0'
                    }`}
                    aria-hidden
                  />
                  <div
                    className={`pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-surface-muted via-surface-muted/90 to-transparent backdrop-blur-[1px] transition-opacity duration-200 ${
                      canScrollAllocationDown ? 'opacity-100' : 'opacity-0'
                    }`}
                    aria-hidden
                  />
                </div>
              ) : (
                <PortfolioEmptyState
                  icon="percent"
                  title={emptyPortfolioTitle}
                  body={emptyPortfolioBody}
                />
              )}
            </div>
          </div>

        </>
      ) : (
        <div className="mt-4 rounded-md border border-dashed border-border bg-surface-muted px-4 py-12 text-center">
          <PieChart size={32} className="mx-auto text-primary" />
          <p className="mt-3 text-base font-semibold text-foreground">
            {language === 'ko'
              ? '아직 포트폴리오가 없습니다.'
              : 'No portfolios yet.'}
          </p>
          <p className="mt-1 text-sm text-muted">
            {language === 'ko'
              ? '포트폴리오 추가를 눌러 종목과 보유 수량을 입력하세요.'
              : 'Add a portfolio, then enter stocks and quantities.'}
          </p>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus size={15} />}
            onClick={startCreatePortfolio}
            className="mt-5"
          >
            {language === 'ko' ? '\uD3EC\uD2B8\uD3F4\uB9AC\uC624 \uCD94\uAC00' : 'Add portfolio'}
          </Button>
        </div>
      )}
    </div>
  );
}

function PortfolioPerformanceChart({
  points,
  loading,
  period,
  onPeriodChange,
  portfolioName,
  language,
  customSymbols,
  hiddenKeys,
  compareQuery,
  compareSuggestions,
  onCompareQueryChange,
  onAddCompareSymbol,
  onToggleSeries,
  onRemoveCustomSymbol,
}: {
  points: PortfolioPerformancePoint[];
  loading: boolean;
  period: string;
  onPeriodChange: (period: string) => void;
  portfolioName: string;
  language: 'en' | 'ko';
  customSymbols: CompareSymbol[];
  hiddenKeys: string[];
  compareQuery: string;
  compareSuggestions: StockSymbol[];
  onCompareQueryChange: (value: string) => void;
  onAddCompareSymbol: (symbol: StockSymbol) => void;
  onToggleSeries: (key: string) => void;
  onRemoveCustomSymbol: (key: string) => void;
}) {
  const customColors = ['#0ea5e9', '#ec4899', '#84cc16', '#14b8a6', '#f97316', '#64748b'];
  const series = [
    { key: 'sp500', label: 'S&P 500', color: '#16a34a', removable: false },
    { key: 'nasdaq', label: 'Nasdaq', color: '#f59e0b', removable: false },
    { key: 'nasdaq100', label: 'Nasdaq 100', color: '#9333ea', removable: false },
    { key: 'kospi', label: 'KOSPI', color: '#dc2626', removable: false },
    ...customSymbols.map((item, index) => ({
      key: item.key,
      label: item.label || item.symbol,
      color: customColors[index % customColors.length],
      removable: true,
    })),
  ];
  const visibleSeries = series.filter((item) => !hiddenKeys.includes(item.key));
  const values = points.flatMap((point) =>
    visibleSeries
      .map((item) => point.series?.[item.key] ?? null)
      .filter((value): value is number => value !== null),
  );
  const allValues = points.flatMap((point) =>
    series
      .map((item) => point.series?.[item.key] ?? null)
      .filter((value): value is number => value !== null),
  );
  const scaleValues = values.length ? values : allValues;
  const min = Math.min(0, ...scaleValues);
  const max = Math.max(0, ...scaleValues);
  const range = Math.max(max - min, 1);
  const mid = (max + min) / 2;
  const yFor = (value: number) => 92 - ((value - min) / range) * 84;
  const yTicks = [max, mid, min];
  const xLabels = points.length
    ? [
        { key: 'start', label: points[0]?.date.slice(5) ?? '', className: 'text-left' },
        { key: 'middle', label: points[Math.floor((points.length - 1) / 2)]?.date.slice(5) ?? '', className: 'text-center' },
        { key: 'end', label: points.at(-1)?.date.slice(5) ?? '', className: 'text-right' },
      ]
    : [];
  const pathFor = (key: string) => {
    let hasStarted = false;
    return points
      .map((point, index) => {
        const value = point.series?.[key] ?? null;
        if (value === null) return null;
        const x = points.length <= 1 ? 0 : (index / (points.length - 1)) * 100;
        const command = hasStarted ? 'L' : 'M';
        hasStarted = true;
        return command + ' ' + x + ' ' + yFor(value);
      })
      .filter(Boolean)
      .join(' ');
  };
  const latest = points.at(-1);

  return (
    <section className="mt-4 rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold">
            {language === 'ko' ? '\uC131\uACFC \uC9C0\uD45C' : 'Performance indicators'}
          </h3>
          <p className="mt-1 text-xs text-muted">
            {portfolioName || (language === 'ko' ? '\uAE30\uBCF8 \uC9C0\uC218\uC640 \uC120\uD0DD\uD55C \uD2F0\uCEE4\uB97C \uBE44\uAD50\uD569\uB2C8\uB2E4.' : 'Compare default indices with selected tickers.')}
          </p>
        </div>
        <SegmentedControl<string>
          value={period}
          onChange={onPeriodChange}
          options={['1W', '1M', '3M', '6M', '1Y', '3Y', '5Y'].map((value) => ({ value, label: value }))}
        />
      </div>

      <div className="relative mt-4">
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          value={compareQuery}
          onChange={(event) => onCompareQueryChange(event.target.value)}
          placeholder={language === 'ko' ? '\uBE44\uAD50\uD560 \uC885\uBAA9\uBA85 \uB610\uB294 \uD2F0\uCEE4 \uAC80\uC0C9' : 'Search ticker to compare'}
          className={cn(INPUT_BASE, 'h-11 bg-surface-muted pl-9 pr-3 transition-colors hover:border-primary/50 hover:bg-surface focus:border-primary')}
        />
        {compareSuggestions.length ? (
          <div className="absolute left-0 right-0 top-full z-20 mt-1.5 overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
            {compareSuggestions.map((symbol) => {
              const market = symbol.currency === 'KRW' ? 'KR' : 'US';
              const primary = market === 'KR' ? symbol.description : symbol.symbol;
              const secondary = market === 'KR' ? symbol.symbol : symbol.description;
              return (
                <button
                  key={compareKeyForSymbol(symbol)}
                  type="button"
                  onClick={() => onAddCompareSymbol(symbol)}
                  className="flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-surface-muted"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="inline-flex shrink-0 items-center rounded bg-surface-subtle px-1.5 py-0.5 text-[10px] font-bold text-muted">
                      {market}
                    </span>
                    <span className="truncate font-semibold text-foreground">{primary}</span>
                  </span>
                  <span className="min-w-0 shrink-0 truncate text-xs text-muted">{secondary}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {loading ? (
        <Skeleton className="mt-4 h-72" />
      ) : points.length ? (
        <>
          <div className="mt-4 grid grid-cols-[3rem_1fr] gap-2">
            <div className="relative h-64 text-[11px] font-medium text-muted">
              {yTicks.map((tick, index) => (
                <span
                  key={index}
                  className="absolute right-0 -translate-y-1/2 tabular-nums"
                  style={{ top: `${yFor(tick)}%` }}
                >
                  {tick >= 0 ? '+' : ''}{tick.toFixed(1)}%
                </span>
              ))}
            </div>
            <div>
              <div className="h-64 rounded-md bg-surface-muted p-3">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full" role="img">
                  {yTicks.map((tick, index) => (
                    <line
                      key={index}
                      x1="0"
                      x2="100"
                      y1={yFor(tick)}
                      y2={yFor(tick)}
                      stroke="currentColor"
                      className="text-border"
                      strokeDasharray={Math.abs(tick) < 0.0001 ? '2 2' : undefined}
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                  {visibleSeries.map((item) => (
                    <path
                      key={item.key}
                      d={pathFor(item.key)}
                      fill="none"
                      stroke={item.color}
                      strokeWidth="2"
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                </svg>
              </div>
              <div className="mt-1 grid grid-cols-3 text-[11px] font-medium text-muted">
                {xLabels.map((item) => (
                  <span key={item.key} className={item.className}>{item.label}</span>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
            {series.map((item) => {
              const hidden = hiddenKeys.includes(item.key);
              const latestValue = latest?.series?.[item.key] ?? null;
              const hasData = points.some((point) => point.series?.[item.key] !== null && point.series?.[item.key] !== undefined);
              return (
                <span
                  key={item.key}
                  className={cn(
                    'inline-flex items-center overflow-hidden rounded-full border border-border bg-surface text-foreground transition-colors hover:border-primary/60 hover:bg-primary/5',
                    hidden && 'text-muted',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onToggleSeries(item.key)}
                    className="inline-flex cursor-pointer items-center gap-1.5 px-2.5 py-1.5 hover:text-primary"
                    aria-pressed={!hidden}
                    title={language === 'ko' ? '\uD074\uB9AD\uD574\uC11C \uADF8\uB798\uD504 \uD45C\uC2DC\uB97C \uC804\uD658' : 'Click to toggle line'}
                  >
                    <i className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className={cn(hidden && 'line-through decoration-2')}>{item.label}</span>
                    <span className="text-muted">
                      {!hasData
                        ? language === 'ko' ? '\uB370\uC774\uD130 \uC5C6\uC74C' : 'No data'
                        : latestValue == null ? '-' : (latestValue >= 0 ? '+' : '') + latestValue.toFixed(2) + '%'}
                    </span>
                  </button>
                  {item.removable ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onRemoveCustomSymbol(item.key);
                      }}
                      className="grid size-7 cursor-pointer place-items-center border-l border-border text-muted transition-colors hover:bg-negative/10 hover:text-negative"
                      aria-label={language === 'ko' ? item.label + ' \uC0AD\uC81C' : 'Remove ' + item.label}
                      title={language === 'ko' ? '\uC0AD\uC81C' : 'Remove'}
                    >
                      <X size={13} />
                    </button>
                  ) : null}
                </span>
              );
            })}
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-md border border-dashed border-border px-4 py-12 text-center text-sm text-muted">
          {language === 'ko' ? '\uC120\uD0DD\uD55C \uAE30\uAC04\uC758 \uBE44\uAD50 \uB370\uC774\uD130\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.' : 'No comparison data for this period yet.'}
        </div>
      )}
    </section>
  );
}

function PositionDraftRow({
  draft,
  index,
  stockSymbols,
  language,
  onChange,
  onSelect,
  onRemove,
  canRemove,
}: {
  draft: PositionDraft;
  index: number;
  stockSymbols: StockSymbol[];
  language: 'en' | 'ko';
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

  const selected = Boolean(draft.symbol);
  const marketLabel =
    draft.market === 'KR'
      ? language === 'ko'
        ? '한국'
        : 'KR'
      : language === 'ko'
        ? '미국'
        : 'US';
  const currencySymbol = draft.market === 'KR' ? '₩' : '$';

  return (
    <div className="rounded-xl border border-border bg-surface-muted p-3.5">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="grid size-5 shrink-0 place-items-center rounded-md bg-surface text-[11px] font-bold text-muted">
          {index + 1}
        </span>
        {selected ? (
          <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
            {marketLabel}
          </span>
        ) : (
          <span className="text-[11px] font-medium text-muted/80">
            {language === 'ko' ? '종목을 검색해 추가' : 'Search to add a stock'}
          </span>
        )}
        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          className="ml-auto grid size-7 cursor-pointer place-items-center rounded-md text-muted transition-colors hover:bg-surface hover:text-negative disabled:cursor-not-allowed disabled:opacity-30"
          aria-label={language === 'ko' ? '종목 제거' : 'Remove stock'}
        >
          <Trash2 size={15} />
        </button>
      </div>

      <div className="relative">
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          value={draft.query}
          onChange={(event) =>
            onChange({
              query: event.target.value,
              symbol: '',
              name: '',
            })
          }
          placeholder={
            language === 'ko' ? '종목명 또는 티커' : 'Company or ticker'
          }
          className={cn(INPUT_BASE, 'h-11 bg-surface pl-9 pr-3')}
        />
        {suggestions.length ? (
          <div className="absolute left-0 right-0 top-full z-20 mt-1.5 overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
            {suggestions.map((symbol) => {
              const market = symbol.currency === 'KRW' ? 'KR' : 'US';
              const primary =
                market === 'KR' ? symbol.description : symbol.symbol;
              const secondary =
                market === 'KR' ? symbol.symbol : symbol.description;
              return (
                <button
                  key={`${symbol.currency}-${symbol.symbol}`}
                  type="button"
                  onClick={() => onSelect(symbol)}
                  className="flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-surface-muted"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="inline-flex shrink-0 items-center rounded bg-surface-subtle px-1.5 py-0.5 text-[10px] font-bold text-muted">
                      {market}
                    </span>
                    <span className="truncate font-semibold text-foreground">
                      {primary}
                    </span>
                  </span>
                  <span className="min-w-0 shrink-0 truncate text-xs text-muted">
                    {secondary}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2.5">
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-muted">
            {language === 'ko' ? '수량' : 'Quantity'}
          </span>
          <input
            value={draft.quantity}
            onChange={(event) => onChange({ quantity: event.target.value })}
            placeholder="0"
            inputMode="decimal"
            className={cn(INPUT_BASE, 'h-11 bg-surface px-3.5')}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-muted">
            {language === 'ko' ? '평균 단가' : 'Avg price'}
          </span>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted">
              {currencySymbol}
            </span>
            <input
              value={draft.averagePrice}
              onChange={(event) =>
                onChange({ averagePrice: event.target.value })
              }
              placeholder="0"
              inputMode="decimal"
              className={cn(INPUT_BASE, 'h-11 bg-surface pl-7 pr-3')}
            />
          </div>
        </label>
      </div>
    </div>
  );
}

type PortfolioRow = {
  key: string;
  symbol: string;
  market: 'US' | 'KR';
  name?: string;
  quantity: number;
  averagePrice: number;
  current: number;
  change: number;
  percentChange: number;
  sourceCurrency: 'USD' | 'KRW';
  displayValue: number;
  displayCost: number;
  profitAmount: number;
  profitRate: number | null;
  percent: number;
  color: string;
};

function buildPortfolioRows(
  portfolios: Portfolio[],
  displayCurrency: 'USD' | 'KRW',
  exchangeRate: number | null,
  livePrices: Record<
    string,
    { price: number; change?: number; percentChange?: number }
  >,
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
    const sourceCurrency = (position.currency ??
      (position.market === 'KR' ? 'KRW' : 'USD')) as 'USD' | 'KRW';
    const current =
      live?.price && live.price > 0 ? live.price : position.current;
    const displayValue =
      convertMoneyValue(
        current * position.quantity,
        displayCurrency,
        sourceCurrency,
        exchangeRate,
      ) || 0;
    const displayCost =
      convertMoneyValue(
        position.cost,
        displayCurrency,
        sourceCurrency,
        exchangeRate,
      ) || 0;
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
      profitRate:
        safeDisplayCost > 0 ? (profitAmount / safeDisplayCost) * 100 : null,
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
  language,
  displayCurrency,
  exchangeRate,
}: {
  rows: PortfolioRow[];
  totalValue: number;
  hoveredSlice: string | null;
  onHover: (key: string | null) => void;
  language: 'en' | 'ko';
  displayCurrency: 'USD' | 'KRW';
  exchangeRate: number | null;
}) {
  if (!rows.length || totalValue <= 0) {
    return (
      <div className="mt-6 grid aspect-square max-h-72 place-items-center rounded-full border border-dashed border-border text-sm font-semibold text-muted">
        {language === 'ko' ? '데이터 없음' : 'No data'}
      </div>
    );
  }

  const hoveredRow = hoveredSlice
    ? (rows.find((row) => row.key === hoveredSlice) ?? null)
    : null;
  const hoveredLabel = hoveredRow
    ? hoveredRow.market === 'KR'
      ? hoveredRow.name || hoveredRow.symbol
      : hoveredRow.symbol
    : '';
  const center = 120;
  const ringRadius = 88;
  const ringWidth = 32;
  const gapAngle = rows.length > 1 ? 2.4 : 0;
  const segments = rows.reduce<
    {
      row: PortfolioRow;
      startAngle: number;
      endAngle: number;
      visualStartAngle: number;
      visualEndAngle: number;
    }[]
  >((items, row) => {
    const startAngle = items.at(-1)?.endAngle ?? -90;
    const endAngle = startAngle + (row.percent / 100) * 360;
    const shouldUseGap = endAngle - startAngle > gapAngle * 2;
    return [
      ...items,
      {
        row,
        startAngle,
        endAngle,
        visualStartAngle: shouldUseGap
          ? startAngle + gapAngle / 2
          : startAngle,
        visualEndAngle: shouldUseGap ? endAngle - gapAngle / 2 : endAngle,
      },
    ];
  }, []);

  return (
    <div className="mt-4 flex min-h-0 flex-1 items-center justify-center">
      <div className="donut-in relative aspect-square w-full max-w-[16.5rem]">
        <svg
          viewBox="0 0 240 240"
          className="h-full w-full overflow-visible"
          onMouseLeave={() => onHover(null)}
        >
          <circle
            cx={center}
            cy={center}
            r={ringRadius}
            fill="none"
            stroke="var(--surface-subtle)"
            strokeWidth={ringWidth}
          />
          {segments.map(({ row, visualStartAngle, visualEndAngle }) => {
            const isActive = !hoveredSlice || hoveredSlice === row.key;
            const lifted = hoveredSlice === row.key;
            const style = {
              transformBox: 'view-box',
              transformOrigin: `${center}px ${center}px`,
              transform: lifted ? 'scale(1.04)' : 'scale(1)',
              transition: 'transform 200ms ease, opacity 200ms ease',
            } as const;

            if (row.percent >= 99.99) {
              return (
                <circle
                  key={row.key}
                  cx={center}
                  cy={center}
                  r={ringRadius}
                  fill="none"
                  stroke={row.color}
                  strokeWidth={ringWidth}
                  className="cursor-pointer"
                  style={style}
                  opacity={isActive ? 1 : 0.28}
                  onMouseEnter={() => onHover(row.key)}
                />
              );
            }
            const d = describeArc(
              center,
              center,
              ringRadius,
              visualStartAngle,
              visualEndAngle,
            );
            return (
              <path
                key={row.key}
                d={d}
                fill="none"
                stroke={row.color}
                strokeWidth={ringWidth}
                strokeLinecap="butt"
                className="cursor-pointer"
                style={style}
                opacity={isActive ? 1 : 0.28}
                onMouseEnter={() => onHover(row.key)}
              />
            );
          })}
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 px-12 text-center">
          {hoveredRow ? (
            <>
              <span className="flex max-w-full items-center gap-1.5">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: hoveredRow.color }}
                />
                <span className="truncate text-[11px] font-semibold text-muted">
                  {hoveredLabel}
                </span>
              </span>
              <span className="text-[30px] font-bold leading-none tracking-tight text-foreground">
                {formatNumber(hoveredRow.percent)}%
              </span>
              <span className="truncate text-[11px] font-semibold text-muted">
                {formatMoney(
                  hoveredRow.displayValue,
                  displayCurrency,
                  displayCurrency,
                  exchangeRate,
                )}
              </span>
            </>
          ) : (
            <>
              <span className="text-[30px] font-bold leading-none tracking-tight text-foreground">
                {rows.length}
                <span className="ml-1 text-base font-semibold text-muted">
                  {language === 'ko' ? '종목' : rows.length === 1 ? 'stock' : 'stocks'}
                </span>
              </span>
              <span className="text-[11px] font-semibold text-muted">
                {language === 'ko' ? '전체 보유' : 'Total holdings'}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PortfolioEmptyState({
  icon,
  title,
  body,
}: {
  icon: 'chart' | 'percent';
  title: string;
  body: string;
}) {
  const Icon = icon === 'chart' ? PieChart : Percent;

  return (
    <div className="mt-4 grid h-80 place-items-center rounded-md border border-dashed border-border bg-surface px-4 py-10 text-center">
      <div>
        <Icon size={30} className="mx-auto text-primary" />
        <p className="mt-3 text-sm font-semibold text-foreground">{title}</p>
        {body ? <p className="mt-1 max-w-sm text-sm text-muted">{body}</p> : null}
      </div>
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
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

  return [
    'M',
    start.x,
    start.y,
    'A',
    radius,
    radius,
    0,
    largeArcFlag,
    0,
    end.x,
    end.y,
  ].join(' ');
}

function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  angle: number,
) {
  const angleInRadians = ((angle - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians),
  };
}

function makeDraft(): PositionDraft {
  return {
    key: crypto.randomUUID(),
    query: '',
    symbol: '',
    market: 'US',
    name: '',
    quantity: '',
    averagePrice: '',
    startedAt: new Date().toISOString().slice(0, 10),
  };
}

function normalizeCompareSymbol(symbol: StockSymbol): { key: string; symbol: string; market: 'US' | 'KR' } {
  const raw = (symbol.symbol || symbol.displaySymbol || '').trim().toUpperCase();
  const [prefix, value] = raw.includes(':') ? raw.split(':', 2) : ['', raw];
  const market = prefix === 'KR' || symbol.currency === 'KRW' ? 'KR' : 'US';
  const normalizedSymbol = (value || raw).replace(/^KR:/, '').replace(/^US:/, '').trim().toUpperCase();
  return { key: market + ':' + normalizedSymbol, symbol: normalizedSymbol, market };
}

function compareKeyForSymbol(symbol: StockSymbol): string {
  return normalizeCompareSymbol(symbol).key;
}

function portfolioSearchScore(item: StockSymbol, rawQuery: string): number {
  const query = rawQuery.trim().toLowerCase();
  if (!query) {
    return 0;
  }
  const symbol = (item.symbol ?? '').toLowerCase();
  const displaySymbol = (item.displaySymbol ?? item.symbol ?? '').toLowerCase();
  const name = (item.description ?? '').toLowerCase();
  const compactQuery = query.replace(/[^a-z0-9가-힣]/g, '');
  const compactSymbol = symbol.replace(/[^a-z0-9]/g, '');
  const compactDisplaySymbol = displaySymbol.replace(/[^a-z0-9]/g, '');
  const normalizedQuery = normalizePortfolioSearchText(query);
  const normalizedName = normalizePortfolioSearchText(name);
  const compactName = name.replace(/[^a-z0-9가-힣]/g, '');

  if (
    compactSymbol === normalizedQuery ||
    compactDisplaySymbol === normalizedQuery ||
    normalizedName === normalizedQuery
  )
    return 150;
  if (
    compactSymbol.startsWith(normalizedQuery) ||
    compactDisplaySymbol.startsWith(normalizedQuery)
  )
    return 130;
  if (normalizedName.startsWith(normalizedQuery)) return 125;
  if (
    compactSymbol.includes(normalizedQuery) ||
    compactDisplaySymbol.includes(normalizedQuery)
  )
    return 110;
  if (normalizedName.includes(normalizedQuery)) return 100;

  const baseScore = stockSearchScore(item, rawQuery);
  const symbolDistance = editDistance(compactSymbol, normalizedQuery);
  const transposed =
    compactSymbol.length === normalizedQuery.length &&
    [...compactSymbol].sort().join('') === [...normalizedQuery].sort().join('');
  const fuzzyScore = transposed
    ? 95
    : symbolDistance <= 2
      ? 90 - symbolDistance * 10
      : 0;
  return Math.max(baseScore, fuzzyScore);
}

function normalizePortfolioSearchText(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
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

function formatProfitAmount(value: number, currency: 'USD' | 'KRW'): string {
  const sign = value >= 0 ? '+' : '-';
  const absolute = Math.abs(value);

  if (currency === 'KRW') {
    if (absolute >= 1_0000_0000_0000) {
      return `${sign}${formatCompactAmount(absolute / 1_0000_0000_0000)}조`;
    }
    if (absolute >= 1_0000_0000) {
      return `${sign}${formatCompactAmount(absolute / 1_0000_0000)}억`;
    }
    if (absolute >= 10_000) {
      return `${sign}${formatCompactAmount(absolute / 10_000)}만원`;
    }
    return `${sign}${Math.round(absolute).toLocaleString('ko-KR')}원`;
  }

  return `${sign}${formatCompactAmount(absolute)}$`;
}

function formatCompactAmount(value: number): string {
  return new Intl.NumberFormat('ko-KR', {
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
  language: 'en' | 'ko';
  exchangeRate: number | null;
}) {
  const sourceCurrency =
    stock.currency ?? (stock.market === 'KR' ? 'KRW' : 'USD');
  const displayCurrency = stock.market === 'KR' ? 'KRW' : 'USD';
  const positive = stock.change >= 0;
  const primary =
    stock.market === 'KR' ? stock.name || stock.symbol : stock.symbol;
  const secondary =
    stock.market === 'KR' ? stock.symbol : stock.name || stock.symbol;

  return (
    <>
      <div className="flex items-center gap-2">
        <Star
          size={17}
          className="shrink-0 text-[#f4b400]"
          fill="currentColor"
        />
        <p className="truncate text-base font-semibold text-foreground">
          {primary}
        </p>
      </div>
      <p className="mt-1 truncate text-xs font-medium uppercase tracking-wide text-muted">
        {stock.market} · {secondary}
      </p>
      <p className="mt-4 text-xs font-medium text-muted">
        {language === 'ko' ? '현재가' : 'Last'}
      </p>
      <p className="mt-0.5 text-2xl font-bold tracking-tight text-foreground">
        {formatMoney(
          stock.current,
          displayCurrency,
          sourceCurrency,
          exchangeRate,
        )}
      </p>
      <p className="mt-3 text-xs font-medium text-muted">
        {language === 'ko' ? '전일대비' : 'Change'}
      </p>
      <div className="mt-0.5 flex flex-wrap items-center gap-2">
        <span
          className={`text-sm font-semibold ${positive ? 'text-positive' : 'text-negative'}`}
        >
          {positive ? '+' : ''}
          {formatMoney(
            stock.change,
            displayCurrency,
            sourceCurrency,
            exchangeRate,
          )}
        </span>
        <span
          className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
            positive
              ? 'bg-positive-surface text-positive'
              : 'bg-negative-surface text-negative'
          }`}
        >
          {positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {positive ? '+' : ''}
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
  language: 'en' | 'ko';
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
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface/50 opacity-0 backdrop-blur-[1px] transition-opacity duration-200 group-hover:opacity-100">
        <span className="text-sm font-semibold text-foreground">
          {language === 'ko' ? '종목 상세 보기' : 'View stock details'}
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
  language: 'en' | 'ko';
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
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const stopDrag = (event: { stopPropagation: () => void }) =>
    event.stopPropagation();

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative cursor-grab rounded-xl border p-4 transition-colors active:cursor-grabbing',
        isDragging
          ? 'border-2 border-dashed border-primary/50 bg-primary/5'
          : 'border-border bg-surface-muted hover:border-primary/50',
      )}
      {...attributes}
      {...listeners}
    >
      <div className={cn(isDragging && 'invisible')}>
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
        title={language === 'ko' ? '관심종목 제거' : 'Remove favorite'}
        aria-label={language === 'ko' ? '관심종목 제거' : 'Remove favorite'}
        className={cn(
          'absolute right-2 top-2 text-muted',
          isDragging && 'invisible',
        )}
      >
        <Trash2 size={16} />
      </Button>
    </div>
  );
}
