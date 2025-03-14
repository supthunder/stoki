declare module 'yahoo-finance2' {
  export interface YahooQuote {
    symbol: string;
    regularMarketPrice: number;
    [key: string]: any;
  }

  export function quote(symbols: string | string[]): Promise<YahooQuote | YahooQuote[]>;
  export function chart(symbol: string, options?: any): Promise<any>;
  export function historical(symbol: string, options?: any): Promise<any[]>;

  export default {
    quote,
    chart,
    historical
  };
} 