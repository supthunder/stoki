import { NextResponse } from "next/server";
import { createSqlClient } from "@/lib/db";
import { formatCurrency, parseCurrency } from "@/lib/utils";
import { getCachedData, cacheData, getPortfolioHistory, cachePortfolioValue } from "@/lib/redis";
import yahooFinance from "yahoo-finance2";

// One day in milliseconds for calculating daily metrics
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Type definitions for Yahoo Finance response
interface YahooQuote {
  symbol: string;
  regularMarketPrice: number;
  [key: string]: any;
}

// Type definitions
interface StockType {
  symbol: string;
  quantity: number;
  purchasePrice: number;
  purchaseDate: string;
}

// Enhanced StockType with gains and current values
interface EnhancedStockType extends StockType {
  currentPrice: number;
  currentValue: number;
  historicalPrice: number;
  purchaseValue: number;
  gain?: number;
  gainPercentage?: number;
}

// Helper function to check if a date is in the future
const isDateInFuture = (dateString: string): boolean => {
  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Compare dates only
  return date > today;
};

// Get historical prices for each stock based on purchase date
const getHistoricalPrice = async (symbol: string, purchaseDate: string, forceRefresh = false): Promise<number | null> => {
  // If the purchase date is in the future, we can't get historical data
  if (isDateInFuture(purchaseDate)) {
    console.log(`Cannot get historical price for ${symbol} as date ${purchaseDate} is in the future`);
    return null;
  }
  
  // Create a cache key for this historical price
  const historicalCacheKey = `yahoo:historical:${symbol}:${purchaseDate}`;
  
  // Try to get from cache first
  const cachedPrice = await getCachedData<number>(historicalCacheKey);
  if (cachedPrice !== null && !forceRefresh) {
    console.log(`Using cached historical price for ${symbol} on ${purchaseDate}: ${cachedPrice}`);
    return cachedPrice;
  }
  
  // For recently purchased stocks, especially if purchased today,
  // we should just use the recorded purchase price as it's likely accurate
  const purchaseTime = new Date(purchaseDate).getTime();
  const now = new Date().getTime();
  
  if (now - purchaseTime < ONE_DAY_MS) {
    console.log(`Stock ${symbol} was purchased recently (${purchaseDate}), using recorded purchase price`);
    return null;  // Fall back to recorded purchase price
  }
  
  try {
    // For stocks that we know might cause issues, just use the recorded purchase price
    const problematicSymbols = ['TEM']; // Add any other symbols that cause issues
    if (problematicSymbols.includes(symbol)) {
      console.log(`Symbol ${symbol} is known to have historical data issues, using recorded purchase price`);
      return null;  // Fall back to recorded purchase price
    }
    
    console.log(`Fetching historical price for ${symbol} on ${purchaseDate}`);
    
    // Parse the purchase date
    const purchaseDateObj = new Date(purchaseDate);
    
    // Check if it's a weekend or holiday and adjust accordingly if needed
    const dayOfWeek = purchaseDateObj.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      console.log(`Purchase date for ${symbol} (${purchaseDate}) is a weekend, will try to find nearest trading day`);
    }
    
    // Try to get data for a range around the purchase date to increase chances of finding data
    // Go back 7 days from the purchase date to find trading data
    const startDate = new Date(purchaseDateObj);
    startDate.setDate(startDate.getDate() - 7);
    
    // End date is the purchase date plus 1 day (to ensure we include the purchase date itself)
    const endDate = new Date(purchaseDateObj);
    endDate.setDate(endDate.getDate() + 1);
    
    // Use a try/catch block specifically for the historical data request
    try {
      const historicalData = await yahooFinance.historical(symbol, {
        period1: startDate,
        period2: endDate,
        interval: '1d'
      });
      
      if (historicalData && historicalData.length > 0) {
        // Find the closest date to the purchase date
        let closestIndex = 0;
        let smallestDiff = Infinity;
        
        for (let i = 0; i < historicalData.length; i++) {
          const date = new Date(historicalData[i].date);
          const diff = Math.abs(date.getTime() - purchaseDateObj.getTime());
          if (diff < smallestDiff) {
            smallestDiff = diff;
            closestIndex = i;
          }
        }
        
        const price = historicalData[closestIndex].close;
        console.log(`Found historical price for ${symbol} on ${new Date(historicalData[closestIndex].date).toLocaleDateString()}: ${price}`);
        
        // Cache the historical price for 30 days (since it won't change)
        await cacheData(historicalCacheKey, price, 30 * 24 * 60 * 60);
        return price;
      }
    } catch (histError: any) {
      console.log(`Error fetching historical data for ${symbol}: ${histError.message}, falling back to recorded purchase price`);
    }
    
    // If we couldn't get historical data, just fall back to the recorded purchase price
    return null;
  } catch (error) {
    console.error(`Error in historical price lookup for ${symbol}:`, error);
    return null;
  }
};

export async function GET(request: Request) {
  try {
    // Check if we should bypass the cache for fresh data
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';
    const updateDb = searchParams.get('updateDb') === 'true';
    const timeFrame = searchParams.get('timeFrame') || 'total'; // Get the time frame parameter
    
    // Create a cache key that includes the time frame
    const cacheKey = `leaderboard:data:${timeFrame}`;
    
    // Try to get cached leaderboard data first (short TTL to ensure fresh data)
    if (!forceRefresh) {
      const cachedLeaderboard = await getCachedData<any[]>(cacheKey);
      if (cachedLeaderboard) {
        console.log(`Returning cached leaderboard data for ${timeFrame} time frame`);
        return NextResponse.json(cachedLeaderboard);
      }
    }

    // If forceRefresh is true or no cached data, fetch from database
    console.log(`Fetching leaderboard data from database for ${timeFrame} time frame`);

    const sql = createSqlClient();
    
    // Get all users with their portfolio data from the database
    // This uses pre-calculated values from the portfolio_summaries table
    const results = await sql`
      WITH portfolio_data AS (
        SELECT 
          u.id,
          u.username,
          u.avatar,
          ps.total_current_value as current_worth,
          ps.total_purchase_value as purchase_value,
          ps.total_gain,
          ps.total_gain_percentage,
          ps.daily_gain,
          ps.daily_gain_percentage,
          ps.weekly_gain,
          ps.weekly_gain_percentage,
          ps.last_updated,
          json_agg(
            json_build_object(
              'symbol', s.symbol,
              'quantity', s.quantity,
              'purchasePrice', s.purchase_price,
              'purchaseDate', s.purchase_date
            )
          ) FILTER (WHERE s.symbol IS NOT NULL) as stocks
        FROM users u
        LEFT JOIN portfolio_summaries ps ON u.id = ps.user_id
        LEFT JOIN user_stocks s ON u.id = s.user_id
        GROUP BY u.id, u.username, u.avatar, ps.total_current_value, ps.total_purchase_value, ps.total_gain, ps.total_gain_percentage, 
                 ps.daily_gain, ps.daily_gain_percentage, ps.weekly_gain, ps.weekly_gain_percentage, ps.last_updated
        ORDER BY 
          CASE 
            WHEN '${timeFrame}' = 'daily' THEN ps.daily_gain_percentage 
            WHEN '${timeFrame}' = 'weekly' THEN ps.weekly_gain_percentage
            ELSE ps.total_gain_percentage
          END DESC NULLS LAST
      )
      SELECT * FROM portfolio_data
    `;

    // Check if we need to update the database with fresh calculations
    // This should only happen if explicitly requested with updateDb=true
    if (updateDb && forceRefresh) {
      // Trigger the cron job endpoint to update all portfolio data
      try {
        const cronSecret = process.env.CRON_SECRET || '';
        const response = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/cron/update-portfolio`, {
          headers: {
            'Authorization': `Bearer ${cronSecret}`
          }
        });
        
        if (response.ok) {
          console.log('Successfully triggered portfolio data update');
        } else {
          console.error('Failed to trigger portfolio data update:', await response.text());
        }
      } catch (error) {
        console.error('Error triggering portfolio data update:', error);
      }
    }

    // Format the data for the frontend
    const formattedResults = results.map((user: Record<string, any>) => {
      return {
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        totalGain: formatCurrency(user.total_gain || 0),
        totalGainPercentage: Number(user.total_gain_percentage || 0).toFixed(2),
        dailyGain: formatCurrency(user.daily_gain || 0),
        dailyGainPercentage: Number(user.daily_gain_percentage || 0).toFixed(2),
        weeklyGain: formatCurrency(user.weekly_gain || 0),
        weeklyGainPercentage: Number(user.weekly_gain_percentage || 0).toFixed(2),
        currentWorth: formatCurrency(user.current_worth || 0),
        startingAmount: formatCurrency(user.purchase_value || 0),
        lastUpdated: user.last_updated ? new Date(user.last_updated).toISOString() : null,
        stocks: user.stocks || []
      };
    });

    // Log the formatted results for debugging
    console.log("Formatted results for leaderboard:");
    formattedResults.forEach(user => {
      console.log(`User ${user.username}: Total: ${user.totalGainPercentage}%, Daily: ${user.dailyGainPercentage}%, Weekly: ${user.weeklyGainPercentage}%`);
    });

    // Cache the results for a short time (15 minutes)
    await cacheData(cacheKey, formattedResults, 900);
    
    return NextResponse.json(formattedResults);
  } catch (error) {
    console.error("Error fetching leaderboard data:", error);
    return NextResponse.json({ error: "Failed to fetch leaderboard data" }, { status: 500 });
  }
}

// Helper function to generate mock chart data for testing when no history exists
function generateMockChartData(userId: number, days: number) {
  const data = [];
  const today = new Date();
  let baseValue = 10000 + (userId * 1000); // Different starting value per user
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    // Add some randomness to the value with a trend
    const randomFactor = 1 + ((Math.random() * 0.06) - 0.02); // -2% to +4%
    baseValue = baseValue * randomFactor;
    
    data.push({
      date: dateStr,
      value: Math.round(baseValue * 100) / 100
    });
  }
  
  return data;
} 