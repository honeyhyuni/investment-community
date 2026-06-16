"use client";

import { useEffect, useState } from "react";
import { Star, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const accessToken = useSessionStore((s) => s.accessToken);
  const language = usePreferencesStore((s) => s.language);
  const exchangeRate = useMarketDataStore((s) => s.exchangeRate);
  const [favorites, setFavorites] = useState<FavoriteStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [removingKey, setRemovingKey] = useState("");

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
    router.push(
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

  return (
    <div className="grid min-w-0 flex-1 gap-4 py-4 sm:gap-6 sm:py-6">
      {error ? <Notice message="" error={error} /> : null}
      <section className="-mx-4 min-w-0 border-y border-border bg-surface p-4 shadow-sm sm:mx-0 sm:rounded-lg sm:border sm:p-5">
        <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
          <SectionHeader
            eyebrow={language === "ko" ? "Watchlist" : "Watchlist"}
            title={language === "ko" ? "내관심종목" : "My Watchlist"}
          />
          <Button
            variant="secondary"
            onClick={() => router.push("/")}
            className="cursor-pointer"
          >
            {language === "ko" ? "종목으로 이동" : "Open stocks"}
          </Button>
        </div>

        {loading ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-28 rounded-md" />
            ))}
          </div>
        ) : favorites.length ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {favorites.map((stock) => (
              <FavoriteStockCard
                key={`${stock.market}-${stock.symbol}`}
                stock={stock}
                language={language}
                exchangeRate={exchangeRate}
                removing={removingKey === `${stock.market}-${stock.symbol}`}
                onOpen={() => openStock(stock)}
                onRemove={() => removeFavorite(stock)}
              />
            ))}
          </div>
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

function FavoriteStockCard({
  stock,
  language,
  exchangeRate,
  removing,
  onOpen,
  onRemove,
}: {
  stock: FavoriteStock;
  language: "en" | "ko";
  exchangeRate: number | null;
  removing: boolean;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const sourceCurrency = stock.currency ?? (stock.market === "KR" ? "KRW" : "USD");
  const displayCurrency = stock.market === "KR" ? "KRW" : "USD";
  const positive = stock.change >= 0;
  const primary = stock.market === "KR" ? stock.name || stock.symbol : stock.symbol;
  const secondary = stock.market === "KR" ? stock.symbol : stock.name || stock.symbol;

  return (
    <div className="group rounded-md border border-border bg-surface-muted p-4 transition-colors hover:border-primary/50">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 flex-1 cursor-pointer text-left"
        >
          <div className="flex items-center gap-2">
            <Star size={17} className="shrink-0 text-[#f4b400]" fill="currentColor" />
            <p className="truncate text-base font-semibold text-foreground">
              {primary}
            </p>
          </div>
          <p className="mt-1 truncate text-xs font-semibold text-muted">
            {stock.market} · {secondary}
          </p>
        </button>
        <Button
          variant="ghost-danger"
          size="icon-sm"
          loading={removing}
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          title={language === "ko" ? "관심종목 제거" : "Remove favorite"}
          aria-label={language === "ko" ? "관심종목 제거" : "Remove favorite"}
        >
          <Trash2 size={16} />
        </Button>
      </div>

      <button
        type="button"
        onClick={onOpen}
        className="mt-4 block w-full cursor-pointer text-left"
      >
        <p className="text-2xl font-semibold text-foreground">
          {formatMoney(stock.current, displayCurrency, sourceCurrency, exchangeRate)}
        </p>
        <p
          className={`mt-1 flex items-center gap-1 text-sm font-semibold ${
            positive ? "text-positive" : "text-negative"
          }`}
        >
          {positive ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
          {positive ? "+" : ""}
          {formatMoney(stock.change, displayCurrency, sourceCurrency, exchangeRate)}
          <span>
            ({positive ? "+" : ""}
            {formatNumber(stock.percentChange)}%)
          </span>
        </p>
      </button>
    </div>
  );
}
