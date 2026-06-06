"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { DisplayCurrency, StockSymbol } from "@/common/types";

type StockMarket = "US" | "KR";

type UseStockRouteSelectionOptions = {
  selectedSymbol: string;
  stockTab: StockMarket;
  krSymbols: StockSymbol[];
  usSymbols: StockSymbol[];
  openStocksView: () => void;
  setStockTab: (value: StockMarket) => void;
  setSelectedSymbol: (value: string) => void;
  setPriceCurrency: (value: DisplayCurrency) => void;
  setSearch: (value: string) => void;
};

export function useStockRouteSelection({
  selectedSymbol,
  stockTab,
  krSymbols,
  usSymbols,
  openStocksView,
  setStockTab,
  setSelectedSymbol,
  setPriceCurrency,
  setSearch,
}: UseStockRouteSelectionOptions) {
  const searchParams = useSearchParams();
  const querySymbol = searchParams.get("symbol")?.trim().toUpperCase() ?? "";
  const queryMarket: StockMarket =
    searchParams.get("market")?.trim().toUpperCase() === "KR" ? "KR" : "US";

  useEffect(() => {
    if (!querySymbol) {
      return;
    }

    queueMicrotask(() => {
      openStocksView();
      setStockTab(queryMarket);
      setSelectedSymbol(querySymbol);
      setPriceCurrency(queryMarket === "KR" ? "KRW" : "USD");
      setSearch("");
    });
  }, [
    openStocksView,
    queryMarket,
    querySymbol,
    setPriceCurrency,
    setSearch,
    setSelectedSymbol,
    setStockTab,
  ]);

  useEffect(() => {
    if (querySymbol) {
      queueMicrotask(() => {
        setPriceCurrency(stockTab === "KR" ? "KRW" : "USD");
      });
      return;
    }

    if (stockTab === "KR") {
      queueMicrotask(() => {
        setPriceCurrency("KRW");
        if (krSymbols.length > 0 && !krSymbols.some((item) => item.symbol === selectedSymbol)) {
          setSelectedSymbol(krSymbols[0].symbol);
        }
      });
    } else {
      queueMicrotask(() => {
        setPriceCurrency("USD");
        if (usSymbols.length > 0 && !usSymbols.some((item) => item.symbol === selectedSymbol)) {
          setSelectedSymbol(usSymbols[0].symbol);
        }
      });
    }
  }, [
    krSymbols,
    querySymbol,
    selectedSymbol,
    setPriceCurrency,
    setSelectedSymbol,
    stockTab,
    usSymbols,
  ]);

  return { queryMarket, querySymbol };
}
