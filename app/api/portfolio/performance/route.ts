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
async function calculateHistoricalValue(stocks: StockRecord[], date: Date, forceRefresh: boolean = false): Promise<number> {
  let totalValue = 0;
  const dateStr = date.toISOString().split('T')[0];
  const symbols = stocks.map(stock => stock.symbol);
  
  // Create a cache key for this specific date and set of symbols
  const cacheKey = `historical_value_${dateStr}_${symbols.join('_')}`;
  
  // Check if we should use cached data
  // For today's date, we might want to force a refresh
  const isToday = new Date().toISOString().split('T')[0] === dateStr;
  
  // Try to get from cache first (unless it's today's data and we want to force refresh)
  if (!forceRefresh || !isToday) {
    const cachedValue = await getCachedData(cacheKey);
    if (cachedValue !== null) {
      return cachedValue as number;
    }
  }
  
  // Calculate the end date (the day after the target date)
  const endDate = new Date(date);
  endDate.setDate(endDate.getDate() + 1);
  
  // If not in cache or we need fresh data, fetch historical prices for each stock
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
  
  // Cache the result - different cache times based on whether it's historical or today's data
  if (isToday) {
    // Cache today's data for a shorter time (1 hour)
    await cacheData(cacheKey, totalValue, 3600);
  } else {
    // Cache historical data for 30 days (historical data won't change)
    await cacheData(cacheKey, totalValue, 30 * 24 * 60 * 60);
  }
  
  return totalValue;
}

export async function GET(request: Request) {
  try {
    // Get user ID from query parameters
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const days = parseInt(searchParams.get('days') || '30', 10);
    const refresh = searchParams.get('refresh') === 'true';
    const force = searchParams.get('force') === 'true'; // New parameter to force complete refresh
    
    // Validate parameters
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }
    
    // Don't limit days anymore - use the requested days
    // This allows the frontend to determine how far back to look
    const requestedDays = days;
    
    // Create cache key for this request
    const cacheKey = `portfolio_performance_${userId}_${requestedDays}`;
    
    // When force=true, we'll bypass the cache completely and generate new data
    if (force) {
      console.log(`Force-refreshing performance data for user ${userId}`);
      
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
      
      // Log stock data for debugging
      console.log(`User ${userId} has ${stocks.length} stock positions with symbols: ${stocks.map(s => s.symbol).join(', ')}`);
      
      // If user has no stocks, return empty result
      if (stocks.length === 0) {
        const emptyResult = {
          userId,
          days: requestedDays,
          performance: []
        };
        
        return NextResponse.json(emptyResult);
      }
      
      // Generate performance data in 7-day intervals
      const performanceData: PerformanceData[] = [];
      const today = new Date();
      
      // Calculate interval dates from oldest purchase to today
      // Use 7-day intervals to keep the data points manageable
      const intervalDays = 7;
      
      // Always include today's data point - force refresh
      const todayValue = await calculateHistoricalValue(stocks, today, true);
      performanceData.push({
        date: today.toISOString().split('T')[0],
        value: todayValue
      });
      
      // For each interval in the range (starting from the oldest requested date)
      for (let i = intervalDays; i <= requestedDays; i += intervalDays) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        
        // Skip future dates (in case request.days is mistakenly in the future)
        if (date > today) continue;
        
        // If we're on a weekend, adjust to the previous Friday
        const dayOfWeek = date.getDay();
        if (dayOfWeek === 0) { // Sunday
          date.setDate(date.getDate() - 2); // Go back to Friday
        } else if (dayOfWeek === 6) { // Saturday
          date.setDate(date.getDate() - 1); // Go back to Friday
        }
        
        // Calculate the portfolio value for this date - forcing refresh for all dates
        const value = await calculateHistoricalValue(stocks, date, true);
        
        performanceData.push({
          date: date.toISOString().split('T')[0],
          value
        });
      }
      
      // Sort data by date (oldest first)
      const sortedData = performanceData.sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      
      const result2 = {
        userId,
        days: requestedDays,
        performance: sortedData
      };
      
      // Log the date range of the data for debugging
      if (sortedData.length > 0) {
        console.log(`Generated ${sortedData.length} data points from ${sortedData[0].date} to ${sortedData[sortedData.length-1].date}`);
      }
      
      // Cache the result but for a shorter time (1 hour) since we're forcing a refresh
      await cacheData(cacheKey, result2, 3600);
      
      return NextResponse.json(result2);
    }
    
    // Determine if we need to fetch just today's data or all data
    let cachedData: any = null;
    let needFullRefresh = refresh;
    
    // Try to get from cache first (unless force=true, which we've already handled)
    if (!needFullRefresh) {
      cachedData = await getCachedData(cacheKey);
      
      // If we have cached data but refresh=true, we'll just refresh today's data point
      if (cachedData !== null && refresh) {
        // We'll use the cached data but update today's value later
        needFullRefresh = false;
      }
    }
    
    // If we have cached data and don't need a full refresh, we can just update today's value
    if (cachedData !== null && !needFullRefresh) {
      // If refresh parameter is true, update just today's data point
      if (refresh) {
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
        
        const stocks: StockRecord[] = result.map((row: any) => ({
          id: row.id,
          symbol: row.symbol,
          quantity: row.quantity,
          purchasePrice: row.purchasePrice,
          purchaseDate: row.purchaseDate
        }));
        
        if (stocks.length > 0) {
          // Get today's value with forced refresh
          const today = new Date();
          const todayValue = await calculateHistoricalValue(stocks, today, true);
          const todayStr = today.toISOString().split('T')[0];
          
          // Update or add today's data point
          let todayUpdated = false;
          const updatedPerformance = cachedData.performance.map((point: PerformanceData) => {
            if (point.date === todayStr) {
              todayUpdated = true;
              return { date: todayStr, value: todayValue };
            }
            return point;
          });
          
          // If today wasn't in the dataset, add it
          if (!todayUpdated) {
            updatedPerformance.push({ date: todayStr, value: todayValue });
            // Sort by date
            updatedPerformance.sort((a: PerformanceData, b: PerformanceData) => 
              new Date(a.date).getTime() - new Date(b.date).getTime()
            );
          }
          
          // Update the cached object
          cachedData.performance = updatedPerformance;
          
          // Update the cache with the new data (cache for 12 hours)
          await cacheData(cacheKey, cachedData, 12 * 60 * 60);
        }
      }
      
      // Return the cached data (with the updated today's value if applicable)
      return NextResponse.json(cachedData);
    }
    
    // If we're here, we need to generate all data points
    
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
        days: requestedDays,
        performance: []
      };
      
      // Cache the empty result for a shorter time (10 minutes)
      await cacheData(cacheKey, emptyResult, 10 * 60);
      
      return NextResponse.json(emptyResult);
    }
    
    // Generate performance data in 7-day intervals
    const performanceData: PerformanceData[] = [];
    const today = new Date();
    
    // Calculate interval dates from oldest purchase to today
    // Use 7-day intervals to keep the data points manageable
    const intervalDays = 7;
    
    // Always include today's data point - force refresh if requested
    const todayValue = await calculateHistoricalValue(stocks, today, refresh);
    performanceData.push({
      date: today.toISOString().split('T')[0],
      value: todayValue
    });
    
    // For each interval in the range (starting from the oldest requested date)
    for (let i = intervalDays; i <= requestedDays; i += intervalDays) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      // Skip future dates (in case request.days is mistakenly in the future)
      if (date > today) continue;
      
      // If we're on a weekend, adjust to the previous Friday
      const dayOfWeek = date.getDay();
      if (dayOfWeek === 0) { // Sunday
        date.setDate(date.getDate() - 2); // Go back to Friday
      } else if (dayOfWeek === 6) { // Saturday
        date.setDate(date.getDate() - 1); // Go back to Friday
      }
      
      // Calculate the portfolio value for this date (no refresh needed for historical data)
      const value = await calculateHistoricalValue(stocks, date, false);
      
      performanceData.push({
        date: date.toISOString().split('T')[0],
        value
      });
    }
    
    // Sort data by date (oldest first)
    const sortedData = performanceData.sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    const result2 = {
      userId,
      days: requestedDays,
      performance: sortedData
    };
    
    // Cache the result for 12 hours (43200 seconds) instead of just 1 hour
    await cacheData(cacheKey, result2, 12 * 60 * 60);
    
    return NextResponse.json(result2);
  } catch (error) {
    console.error("Error fetching portfolio performance:", error);
    return NextResponse.json(
      { error: "Failed to fetch portfolio performance data" },
      { status: 500 }
    );
  }
} 