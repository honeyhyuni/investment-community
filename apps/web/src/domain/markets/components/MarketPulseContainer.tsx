"use client";

import { useMarketDataStore } from "@/common/stores/market-data";
import { usePreferencesStore } from "@/common/stores/preferences";
import { MarketPulse } from "@/domain/markets/components/MarketPulse";

export function MarketPulseContainer({ accessToken }: { accessToken: string | null }) {
  const language = usePreferencesStore((s) => s.language);
  const pulse = useMarketDataStore((s) => s.pulse);
  const livePrices = useMarketDataStore((s) => s.livePrices);
  const marketLoading = useMarketDataStore((s) => s.marketLoading);
  const exchangeRate = useMarketDataStore((s) => s.exchangeRate);
  const loadMarketData = useMarketDataStore((s) => s.loadMarketData);

  return (
    <MarketPulse
      pulse={pulse}
      livePrices={livePrices}
      loading={marketLoading}
      refresh={() => {
        if (accessToken) {
          loadMarketData(accessToken);
        }
      }}
      title={language === "ko" ? "시장 지표" : "Market pulse"}
      eyebrow={language === "ko" ? "실시간 개요" : "Live overview"}
      refreshLabel={language === "ko" ? "새로고침" : "Refresh"}
      exchangeRate={exchangeRate}
      exchangeRateErrorLabel={
        language === "ko" ? "KIS 환율 조회 실패" : "Exchange rate unavailable"
      }
    />
  );
}
