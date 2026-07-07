export type EconomicIndicator = {
  id: string;
  seriesId: string;
  name: string;
  country: string;
  observationDate: string;
  actual: string | null;
  previous: string | null;
  expected: string | null;
  unit: string;
  importance: string;
  sourceUrl: string;
  updatedAt: string;
};
export type IpoCalendarItem = {
  id: string;
  corpCode: string | null;
  corpName: string;
  stockCode: string | null;
  reportName: string;
  receiptNo: string;
  receiptDate: string;
  subscriptionStartDate: string | null;
  subscriptionEndDate: string | null;
  subscriptionDateText: string | null;
  listingDate: string | null;
  listingDateText: string | null;
  expectedOfferPrice: string | null;
  confirmedOfferPrice: string | null;
  underwriter: string | null;
  dartUrl: string;
  source: string;
  createdAt: string;
  updatedAt: string;
};

export type UsEarningsCalendarItem = {
  id: string;
  symbol: string;
  companyName: string;
  reportDate: string;
  fiscalDateEnding: string | null;
  estimate: number | null;
  revenueEstimate: number | null;
  epsActual: number | null;
  revenueActual: number | null;
  actualCheckedAt: string | null;
  estimateSource: string | null;
  actualSource: string | null;
  finnhubYear: number | null;
  finnhubQuarter: number | null;
  secConfirmedAt: string | null;
  secFinancialId: string | null;
  currency: string | null;
  timeOfTheDay: string | null;
  stockMasterId: string | null;
  source: string;
  createdAt: string;
  updatedAt: string;
};

export type UsEarningsCalendarBounds = {
  minDate: string | null;
  maxDate: string | null;
};
