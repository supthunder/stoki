import { NextResponse } from "next/server";
import yahooFinance from "yahoo-finance2";

// Mock data for historical prices (simplified for demo)
// In a real implementation, you would use a proper API
const historicalPrices: Record<string, Record<string, number>> = {
  AAPL: {
    "2024-01-01": 160.50,
    "2024-01-15": 167.35,
    "2024-02-01": 171.20,
    "2024-02-15": 178.45,
    "2024-03-01": 175.25,
    "2023-12-01": 155.30,
    "2023-11-01": 150.20,
    "2023-10-01": 145.80,
    "2023-09-01": 148.60,
    "2023-08-01": 143.95,
    "2023-07-01": 140.25,
    "2023-06-01": 135.70,
    "2023-05-01": 130.50,
    "2023-04-01": 128.80,
    "2023-03-01": 125.30,
  },
  MSFT: {
    "2024-01-01": 310.20,
    "2024-01-15": 315.45,
    "2024-02-01": 325.75,
    "2024-02-15": 328.30,
    "2024-03-01": 330.50,
    "2023-12-01": 305.60,
    "2023-11-01": 299.80,
    "2023-10-01": 292.40,
    "2023-09-01": 285.75,
    "2023-08-01": 278.90,
    "2023-07-01": 270.50,
    "2023-06-01": 265.30,
    "2023-05-01": 260.70,
    "2023-04-01": 255.20,
    "2023-03-01": 248.50,
  },
  GOOGL: {
    "2024-01-01": 130.10,
    "2024-01-15": 134.25,
    "2024-02-01": 137.40,
    "2024-02-15": 138.50,
    "2024-03-01": 140.32,
    "2023-12-01": 128.70,
    "2023-11-01": 126.20,
    "2023-10-01": 123.45,
    "2023-09-01": 120.30,
    "2023-08-01": 118.60,
    "2023-07-01": 115.75,
    "2023-06-01": 112.50,
    "2023-05-01": 110.30,
    "2023-04-01": 107.80,
    "2023-03-01": 105.20,
  },
};

// Default prices for stocks not in our mock data
const defaultCurrentPrices: Record<string, number> = {
  AAPL: 175.25,
  MSFT: 330.50,
  GOOGL: 140.32,
  AMZN: 175.54,
  META: 473.28,
  TSLA: 175.34,
  NVDA: 818.89,
  "BRK-B": 411.56,
  JPM: 183.98,
  V: 275.89,
  JNJ: 147.52,
  WMT: 60.20,
  PG: 160.01,
  MA: 451.08,
  UNH: 492.21,
};

// Helper function to get the closest available date
function getClosestDate(dates: string[], targetDate: string): string {
  // Sort dates in descending order (newest first)
  const sortedDates = [...dates].sort((a, b) => 
    new Date(b).getTime() - new Date(a).getTime()
  );
  
  // Find the first date that's not newer than our target
  for (const date of sortedDates) {
    if (date <= targetDate) {
      return date;
    }
  }
  
  // If we didn't find an older date, return the oldest one
  return sortedDates[sortedDates.length - 1];
}

// Generate a random historical price with a trend
function generateHistoricalPrice(symbol: string, dateStr: string): number {
  const currentPrice = defaultCurrentPrices[symbol] || 100;
  const dateDiff = (new Date().getTime() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24 * 30);
  
  // Random factor between 0.8 and 1.2 to add some variation
  const randomFactor = 0.8 + Math.random() * 0.4;
  
  // Generally, prices go up over time, so older dates have lower prices
  // The reduction is between 0.5% and 2% per month
  const monthlyReductionFactor = 0.005 + Math.random() * 0.015;
  
  // Calculate the historical price based on current price minus some percentage per month
  // Add the random factor for variation
  return currentPrice / (1 + (dateDiff * monthlyReductionFactor)) * randomFactor;
}

// Mock stock price data for demo purposes
const mockPrices: Record<string, number> = {
  'AAPL': 175.25,
  'MSFT': 330.50,
  'GOOGL': 140.32,
  'AMZN': 175.54,
  'META': 473.28,
  'TSLA': 175.34,
  'NVDA': 818.89,
  'JPM': 183.98,
  'V': 275.89,
  'JNJ': 147.52,
  'WMT': 60.20,
  'PG': 160.01,
  'MA': 451.08,
  'UNH': 492.21,
  'HD': 345.67,
  'BAC': 37.45,
  'XOM': 112.34,
  'DIS': 111.23,
  'NFLX': 605.78,
  'ADBE': 492.56,
};

export async function GET(request: Request) {
  try {
    // Get the stock symbol from the URL
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    
    if (!symbol) {
      return NextResponse.json(
        { error: 'Stock symbol is required' },
        { status: 400 }
      );
    }
    
    // Fetch real-time quote data from Yahoo Finance
    const quote = await yahooFinance.quote(symbol.toUpperCase());
    
    // Extract the relevant data from the quote response
    const data = {
      symbol: quote.symbol,
      price: quote.regularMarketPrice,
      change: quote.regularMarketChange,
      changePercent: quote.regularMarketChangePercent,
      previousClose: quote.regularMarketPreviousClose,
      open: quote.regularMarketOpen,
      dayHigh: quote.regularMarketDayHigh,
      dayLow: quote.regularMarketDayLow,
      marketCap: quote.marketCap,
      volume: quote.regularMarketVolume,
      shortName: quote.shortName,
      longName: quote.longName,
      currency: quote.currency
    };
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error getting stock price:', error);
    
    // Check if it's a "symbol not found" error
    if (error instanceof Error && error.message.includes("Not Found")) {
      return NextResponse.json(
        { error: 'Stock symbol not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to get stock price' },
      { status: 500 }
    );
  }
} 