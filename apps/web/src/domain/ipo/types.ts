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
