import { NextResponse } from "next/server";
import yahooFinance from "yahoo-finance2";
import { getCachedData, cacheData } from "@/lib/redis";

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
    // Get the stock symbol and date from the URL
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const date = searchParams.get('date');
    
    if (!symbol) {
      return NextResponse.json(
        { error: 'Stock symbol is required' },
        { status: 400 }
      );
    }

    // Create cache keys
    const currentPriceCacheKey = `yahoo:price:${symbol}`;
    const historicalPriceCacheKey = date ? `yahoo:price:${symbol}:${date}` : null;
    
    // If we have a date parameter, try to get historical price
    if (date) {
      // Try to get from cache first
      const cachedPrice = await getCachedData<number>(historicalPriceCacheKey!);
      if (cachedPrice !== null) {
        return NextResponse.json({
          symbol,
          price: cachedPrice,
          date,
        });
      }

      try {
        // Parse the date and create a range
        const targetDate = new Date(date);
        const endDate = new Date(targetDate);
        endDate.setDate(endDate.getDate() + 1);

        // Get historical data
        const historicalData = await yahooFinance.historical(symbol, {
          period1: targetDate,
          period2: endDate,
          interval: '1d'
        });

        if (historicalData && historicalData.length > 0) {
          const price = historicalData[0].close;
          
          // Cache the historical price for 30 days
          await cacheData(historicalPriceCacheKey!, price, 30 * 24 * 60 * 60);
          
          return NextResponse.json({
            symbol,
            price,
            date,
          });
        }

        // If no historical data found, try to get current price
        const quote = await yahooFinance.quote(symbol.toUpperCase());
        const currentPrice = quote.regularMarketPrice;
        
        return NextResponse.json({
          symbol,
          price: currentPrice,
          date,
          note: "Historical price not available, using current price"
        });
      } catch (error) {
        console.error(`Error fetching historical data for ${symbol}:`, error);
        // If historical data fetch fails, try to get current price
        try {
          const quote = await yahooFinance.quote(symbol.toUpperCase());
          const currentPrice = quote.regularMarketPrice;
          
          return NextResponse.json({
            symbol,
            price: currentPrice,
            date,
            note: "Historical price not available, using current price"
          });
        } catch (e) {
          console.error("Error fetching current price:", e);
          return NextResponse.json(
            { error: "Failed to fetch price data" },
            { status: 500 }
          );
        }
      }
    }
    
    // If no date provided, get current price
    try {
      // Try to get current price from cache
      const cachedPrice = await getCachedData<any>(currentPriceCacheKey);
      if (cachedPrice !== null) {
        return NextResponse.json(cachedPrice);
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
      
      // Cache current price data for 5 minutes
      await cacheData(currentPriceCacheKey, data, 300);
      
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
  } catch (error) {
    console.error("Error in price API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 