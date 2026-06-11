export type BriefingMarket = "US" | "KR";

export type MarketBriefing = {
  id: string;
  market: BriefingMarket;
  title: string;
  titleCandidates: string[];
  summary: string;
  summaryLines: string[];
  macroLines?: string[];
  companyNews: Array<{
    symbol: string;
    name: string;
    headline: string;
    lines: string[];
  }>;
  keywords: string[];
  watchPoints: string[];
  imageUrl: string | null;
  generatedAt: number;
  model: string;
  imageModel: string | null;
  sources: Array<{
    headline: string;
    source: string;
    url: string;
    datetime: number;
  }>;
};
