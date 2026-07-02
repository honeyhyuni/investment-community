export type GuruHolding = {
  id: string;
  ticker: string | null;
  issuerName: string;
  cusip: string;
  putCall: string | null;
  value: number;
  shares: number;
  weight: number;
  previousWeight: number;
  weightChange: number;
  shareChange: number;
  returnPercent: number | null;
  industry: string | null;
  sector: string;
};

export type GuruSummary = {
  slug: string;
  personName: string;
  firmName: string;
  reportDate: string | null;
  filingDate: string | null;
  lastCollectedAt: string | null;
  totalValue: number;
  positionCount: number;
  topHolding: GuruHolding | null;
};

export type GuruDetail = GuruSummary & {
  topBuys: GuruHolding[];
  topSells: GuruHolding[];
  holdings: GuruHolding[];
  activityHoldings?: GuruHolding[];
  dataSource: string;
  returnAsOf: string | null;
  stats: {
    totalPositions: number;
    top10Weight: number;
    estimatedTurnover: number;
    newBuys: number;
    soldOut: number;
    increased: number;
    reduced: number;
  };
};
