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
    
    // Try to get cached leaderboard data first (short TTL to ensure fresh data)
    if (!forceRefresh) {
      const cachedLeaderboard = await getCachedData<any[]>('leaderboard:data');
      if (cachedLeaderboard) {
        console.log('Returning cached leaderboard data');
        return NextResponse.json(cachedLeaderboard);
      }
    }

    // If forceRefresh is true, we'll skip the cache and fetch fresh data
    console.log(forceRefresh ? 'Force refreshing leaderboard data' : 'Fetching fresh leaderboard data');

    const sql = createSqlClient();
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const sevenDaysAgo = new Date(today.getTime() - (7 * ONE_DAY_MS));
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
    
    // Get all users with their portfolio data
    const results = await sql`
      WITH user_portfolios AS (
        SELECT 
          u.id,
          u.username,
          s.symbol,
          s.quantity,
          s.purchase_price,
          s.purchase_date
        FROM users u
        LEFT JOIN user_stocks s ON u.id = s.user_id
      ),
      user_totals AS (
        SELECT 
          id,
          username,
          SUM(quantity * purchase_price) as total_investment
        FROM user_portfolios
        GROUP BY id, username
        ORDER BY total_investment DESC
      )
      SELECT 
        ut.id,
        ut.username,
        ut.total_investment,
        json_agg(
          json_build_object(
            'symbol', up.symbol,
            'quantity', up.quantity,
            'purchasePrice', up.purchase_price,
            'purchaseDate', up.purchase_date
          )
        ) FILTER (WHERE up.symbol IS NOT NULL) as stocks
      FROM user_totals ut
      LEFT JOIN user_portfolios up ON ut.id = up.id
      GROUP BY ut.id, ut.username, ut.total_investment
      ORDER BY ut.total_investment DESC
    `;

    // Collect all unique stock symbols
    const allSymbols = new Set<string>();
    results.forEach((user: Record<string, any>) => {
      if (user.stocks && Array.isArray(user.stocks)) {
        user.stocks.forEach((stock: Record<string, any>) => {
          if (stock.symbol) {
            allSymbols.add(stock.symbol);
          }
        });
      }
    });

    // Fetch real-time quotes for all symbols in a single batch request
    const symbolPrices = new Map<string, number>();
    if (allSymbols.size > 0) {
      try {
        console.log(`Fetching current prices from Yahoo Finance for ${allSymbols.size} symbols`);
        const symbols = Array.from(allSymbols);
        
        // Get quotes from Yahoo Finance
        const quotesResponse = await yahooFinance.quote(symbols);
        
        // Process the quotes response
        if (Array.isArray(quotesResponse)) {
          // Type assertion for array of quotes
          (quotesResponse as YahooQuote[]).forEach(quote => {
            if (quote && quote.symbol && quote.regularMarketPrice) {
              symbolPrices.set(quote.symbol, quote.regularMarketPrice);
            }
          });
        } else if (quotesResponse) {
          // Handle single quote response with type assertion
          const singleQuote = quotesResponse as YahooQuote;
          if (singleQuote.symbol && singleQuote.regularMarketPrice) {
            symbolPrices.set(singleQuote.symbol, singleQuote.regularMarketPrice);
          }
        }
        console.log(`Retrieved ${symbolPrices.size} current prices from Yahoo Finance`);
      } catch (e) {
        console.error("Error fetching stock quotes:", e);
        // Continue with cached data if fetch fails
      }
    }

    // Format the data for the frontend
    const formattedResults = await Promise.all(results.map(async (user: Record<string, any>) => {
      // Initialize values for users without stocks
      if (!user.stocks || user.stocks.length === 0) {
        // Return user with default values instead of null
        return {
          id: user.id,
          username: user.username,
          avatar: user.avatar,
          totalGain: formatCurrency(0),
          totalGainPercentage: "0.00",
          dailyGain: formatCurrency(0),
          dailyGainPercentage: "0.00",
          weeklyGain: formatCurrency(0),
          weeklyGainPercentage: "0.00",
          topGainer: null,
          topGainerPercentage: "0.00",
          currentWorth: formatCurrency(0),
          startingAmount: formatCurrency(0),
          latestPurchase: null,
          chartData: generateMockChartData(user.id, 7),
          stockDistribution: []
        };
      }

      // Calculate current portfolio value using real Yahoo Finance data
      let currentWorth = 0;
      let totalPurchaseValue = 0;
      
      // Log the SQL-calculated total_investment for debugging
      console.log(`User ${user.username} (${user.id}): SQL total_investment: ${user.total_investment}`);
      
      // Process stocks with historical prices
      const stocksWithCurrentPrices = await Promise.all(user.stocks.map(async (stock: Record<string, any>) => {
        const currentPrice = symbolPrices.get(stock.symbol) || stock.purchasePrice;
        const currentValue = stock.quantity * currentPrice;
        currentWorth += currentValue;
        
        // Get historical price for more accurate purchase value calculation
        const historicalPrice = await getHistoricalPrice(stock.symbol, stock.purchaseDate, forceRefresh);
        
        // Use historical price if available, otherwise use recorded purchase price
        const actualPurchasePrice = historicalPrice !== null ? historicalPrice : stock.purchasePrice;
        const purchaseValue = stock.quantity * actualPurchasePrice;
        totalPurchaseValue += purchaseValue;
        
        return {
          ...stock,
          currentPrice,
          currentValue,
          historicalPrice: actualPurchasePrice,
          purchaseValue
        };
      }));

      // Calculate total gain based on purchase vs current value - using our calculated totalPurchaseValue
      const totalGain = currentWorth - totalPurchaseValue;
      const totalGainPercentage = totalPurchaseValue > 0 
        ? (totalGain / totalPurchaseValue) * 100 
        : 0;
        
      // Log the values for debugging - now showing both SQL and calculated values
      console.log(`User ${user.username} (${user.id}): Current worth: ${currentWorth}, SQL investment: ${user.total_investment}, Calculated purchase value: ${totalPurchaseValue}, Total gain: ${totalGain}, Gain %: ${totalGainPercentage.toFixed(2)}%`);
      
      // Get historical portfolio data from Redis
      const portfolioHistory = await getPortfolioHistory(user.id, 7);
      
      // Store today's portfolio value in Redis for future historical data
      await cachePortfolioValue(user.id, todayStr, currentWorth);
      
      // Calculate daily and weekly gains
      let dailyGain = 0;
      let dailyGainPercentage = 0;
      let weeklyGain = 0;
      let weeklyGainPercentage = 0;
      
      // If we have historical data, calculate gains
      if (portfolioHistory.length > 0) {
        const oneDayAgoValue = portfolioHistory.find(item => 
          new Date(item.date).getTime() < (today.getTime() - ONE_DAY_MS)
        )?.value;
        
        const sevenDaysAgoValue = portfolioHistory.find(item => 
          new Date(item.date).getTime() <= sevenDaysAgo.getTime()
        )?.value;
        
        // Calculate gains if we have the data
        if (oneDayAgoValue) {
          dailyGain = currentWorth - oneDayAgoValue;
          dailyGainPercentage = oneDayAgoValue > 0 
            ? (dailyGain / oneDayAgoValue) * 100 
            : 0;
        }
        
        if (sevenDaysAgoValue) {
          weeklyGain = currentWorth - sevenDaysAgoValue;
          weeklyGainPercentage = sevenDaysAgoValue > 0 
            ? (weeklyGain / sevenDaysAgoValue) * 100 
            : 0;
        }
      }

      // Find top gainer stock
      let topGainer = null;
      let topGainerPercentage = 0;
      
      // Find latest purchase
      let latestPurchase = null;
      
      if (stocksWithCurrentPrices.length > 0) {
        // Calculate gain percentage for each stock
        const stocksWithGains = stocksWithCurrentPrices.map((stock: Record<string, any>) => {
          const gain = (stock.currentPrice - stock.purchasePrice) * stock.quantity;
          const gainPercentage = stock.purchasePrice > 0 
            ? ((stock.currentPrice - stock.purchasePrice) / stock.purchasePrice) * 100 
            : 0;
          
          return { ...stock, gain, gainPercentage };
        }) as EnhancedStockType[];
        
        // Sort by gain percentage to find top gainer
        const sortedByGain = [...stocksWithGains].sort((a, b) => 
          (b.gainPercentage || 0) - (a.gainPercentage || 0)
        );

        if (sortedByGain.length > 0) {
          // Use type assertion to fix linter error
          const topStock = sortedByGain[0] as EnhancedStockType;
          topGainer = topStock.symbol;
          topGainerPercentage = topStock.gainPercentage || 0;
        }
        
        // Sort by purchase date to find latest purchase (newest first)
        const sortedByDate = [...stocksWithGains].sort((a, b) => {
          const dateA = new Date(a.purchaseDate).getTime();
          const dateB = new Date(b.purchaseDate).getTime();
          return dateB - dateA;
        });
        
        if (sortedByDate.length > 0) {
          const latest = sortedByDate[0] as Record<string, any>;
          latestPurchase = {
            symbol: latest.symbol,
            date: latest.purchaseDate,
            price: latest.purchasePrice
          };
        }
      }

      // Chart data from portfolio history
      const chartData = portfolioHistory.length > 0
        ? portfolioHistory.map(item => ({ date: item.date, value: item.value })).reverse()
        : generateMockChartData(user.id, 7);
      
      // Add today's data point to chart
      chartData.push({ date: todayStr, value: currentWorth });
      
      // Format stock distribution data for pie chart
      const stockDistribution = stocksWithCurrentPrices.map((stock: Record<string, any>) => {
        return {
          name: stock.symbol,
          value: stock.currentPrice * stock.quantity,
        };
      });
      
      return {
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        totalGain: formatCurrency(totalGain),
        totalGainPercentage: totalGainPercentage.toFixed(2),
        dailyGain: formatCurrency(dailyGain),
        dailyGainPercentage: dailyGainPercentage.toFixed(2),
        weeklyGain: formatCurrency(weeklyGain),
        weeklyGainPercentage: weeklyGainPercentage.toFixed(2),
        topGainer,
        topGainerPercentage: topGainerPercentage.toFixed(2),
        currentWorth: formatCurrency(currentWorth),
        startingAmount: formatCurrency(totalPurchaseValue),
        latestPurchase,
        chartData,
        stockDistribution
      };
    }));

    // No longer need to filter out null entries since we're not returning null anymore
    const finalResults = formattedResults;
    
    // Sort by current worth (highest first)
    finalResults.sort((a, b) => {
      // Since we already filtered out null values, we know a and b are not null
      const aWorth = parseCurrency(a!.currentWorth);
      const bWorth = parseCurrency(b!.currentWorth);
      return bWorth - aWorth;
    });

    // Cache the results for a short time (15 minutes) to reduce API load but keep data fresh
    await cacheData('leaderboard:data', finalResults, 900);
    
    return NextResponse.json(finalResults);
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