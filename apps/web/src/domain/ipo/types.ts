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
  expectedOfferPrice: string | null;
  underwriter: string | null;
  dartUrl: string;
  source: string;
  createdAt: string;
  updatedAt: string;
};
