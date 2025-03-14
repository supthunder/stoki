declare module 'yahoo-finance2' {
  export interface YahooQuote {
    symbol: string;
    regularMarketPrice: number;
    regularMarketChange?: number;
    regularMarketChangePercent?: number;
    regularMarketPreviousClose?: number;
    regularMarketOpen?: number;
    regularMarketDayHigh?: number;
    regularMarketDayLow?: number;
    marketCap?: number;
    regularMarketVolume?: number;
    shortName?: string;
    longName?: string;
    currency?: string;
    [key: string]: any;
  }

  export interface YahooSearchResultQuote {
    exchange?: string;
    shortname?: string;
    longname?: string;
    quoteType?: string;
    symbol?: string;
    index?: string;
    score?: number;
    typeDisp?: string;
    isYahooFinance?: boolean;
    name?: string;
    [key: string]: any;
  }

  export interface YahooSearchResult {
    quotes: YahooSearchResultQuote[];
    news: any[];
    nav: any[];
    lists: any[];
    researchReports: any[];
    totalTime: number;
    timeTakenForQuotes: number;
    timeTakenForNews: number;
    timeTakenForNav: number;
    timeTakenForLists: number;
    timeTakenForResearchReports: number;
    timeTakenForScreenerFieldResults: number;
    [key: string]: any;
  }

  export function quote(symbols: string | string[]): Promise<YahooQuote | YahooQuote[]>;
  export function search(query: string, queryOptions?: any): Promise<YahooSearchResult>;
  export function chart(symbol: string, options?: any): Promise<any>;
  export function historical(symbol: string, options?: any): Promise<any[]>;
  export function quoteSummary(symbol: string, modules?: string[]): Promise<any>;
  export function trendingSymbols(region: string): Promise<any>;
  export function recommendationsBySymbol(symbol: string): Promise<any>;

  export default {
    quote,
    search,
    chart,
    historical,
    quoteSummary,
    trendingSymbols,
    recommendationsBySymbol
  };
} 