import { NextResponse } from "next/server";
import { createSqlClient } from "@/lib/db";
import yahooFinance from "yahoo-finance2";
import { getCachedData, cacheData } from "@/lib/redis";

// Define types
type PerformanceData = {
  date: string;
  value: number;
};

type StockRecord = {
  id: number;
  symbol: string;
  quantity: number;
  purchasePrice: number;
  purchaseDate: string;
};

// Helper function to get historical portfolio value
async function calculateHistoricalValue(stocks: StockRecord[], date: Date): Promise<number> {
  let totalValue = 0;
  const dateStr = date.toISOString().split('T')[0];
  const symbols = stocks.map(stock => stock.symbol);
  
  // Create a cache key for this specific date and set of symbols
  const cacheKey = `historical_value_${dateStr}_${symbols.join('_')}`;
  
  // Try to get from cache first
  const cachedValue = await getCachedData(cacheKey);
  if (cachedValue !== null) {
    return cachedValue as number;
  }
  
  // Calculate the end date (the day after the target date)
  const endDate = new Date(date);
  endDate.setDate(endDate.getDate() + 1);
  
  // If not in cache, fetch historical prices for each stock
  for (const stock of stocks) {
    try {
      // Get historical data for the stock on the specific date
      const historicalData = await yahooFinance.historical(stock.symbol, {
        period1: date,
        period2: endDate, // Next day to ensure we get data for the target date
        interval: '1d'
      });
      
      if (historicalData && historicalData.length > 0) {
        // Use the close price from historical data
        const price = historicalData[0].close;
        totalValue += price * stock.quantity;
      } else {
        // If no historical data, use purchase price as fallback
        totalValue += stock.purchasePrice * stock.quantity;
      }
    } catch (error) {
      console.error(`Error fetching historical data for ${stock.symbol}:`, error);
      // Fallback to purchase price
      totalValue += stock.purchasePrice * stock.quantity;
    }
  }
  
  // Cache the result for 30 days (historical data won't change)
  await cacheData(cacheKey, totalValue, 30 * 24 * 60 * 60);
  
  return totalValue;
}

export async function GET(request: Request) {
  try {
    // Get user ID from query parameters
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const days = parseInt(searchParams.get('days') || '30', 10);
    
    // Validate parameters
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }
    
    // Limit days to 90 to prevent excessive API calls
    const limitedDays = Math.min(days, 90);
    
    // Create cache key for this request
    const cacheKey = `portfolio_performance_${userId}_${limitedDays}`;
    
    // Try to get from cache first (cache for 1 hour)
    const cachedData = await getCachedData(cacheKey);
    if (cachedData !== null) {
      return NextResponse.json(cachedData);
    }
    
    // Connect to the database
    const sql = createSqlClient();
    
    // Fetch the user's portfolio stocks
    const result = await sql`
      SELECT 
        id, 
        symbol, 
        quantity, 
        purchase_price as "purchasePrice", 
        purchase_date as "purchaseDate"
      FROM user_stocks
      WHERE user_id = ${parseInt(userId, 10)}
      ORDER BY id ASC
    `;
    
    // Transform database results to our type
    const stocks: StockRecord[] = result.map((row: any) => ({
      id: row.id,
      symbol: row.symbol,
      quantity: row.quantity,
      purchasePrice: row.purchasePrice,
      purchaseDate: row.purchaseDate
    }));
    
    // If user has no stocks, return empty result
    if (stocks.length === 0) {
      const emptyResult = {
        userId,
        days: limitedDays,
        performance: []
      };
      
      // Cache the empty result for a shorter time (10 minutes)
      await cacheData(cacheKey, emptyResult, 10 * 60);
      
      return NextResponse.json(emptyResult);
    }
    
    // Generate performance data for each day
    const performanceData: PerformanceData[] = [];
    const today = new Date();
    
    // For each day in the range
    for (let i = limitedDays; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      // Skip weekends for efficiency (no market data)
      const dayOfWeek = date.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        continue;
      }
      
      // Calculate the portfolio value for this date
      const value = await calculateHistoricalValue(stocks, date);
      
      performanceData.push({
        date: date.toISOString().split('T')[0],
        value
      });
    }
    
    const result2 = {
      userId,
      days: limitedDays,
      performance: performanceData
    };
    
    // Cache the result for 1 hour (3600 seconds)
    await cacheData(cacheKey, result2, 3600);
    
    return NextResponse.json(result2);
  } catch (error) {
    console.error("Error fetching portfolio performance:", error);
    return NextResponse.json(
      { error: "Failed to fetch portfolio performance data" },
      { status: 500 }
    );
  }
} 