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

    // If forceRefresh is true, we'll skip the cache and fetch fresh data
    console.log(forceRefresh ? `Force refreshing leaderboard data for ${timeFrame} time frame` : `Fetching fresh leaderboard data for ${timeFrame} time frame`);

    const sql = createSqlClient();
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const sevenDaysAgo = new Date(today.getTime() - (7 * ONE_DAY_MS));
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
    const oneDayAgo = new Date(today.getTime() - ONE_DAY_MS);
    const oneDayAgoStr = oneDayAgo.toISOString().split('T')[0];
    
    // Get all users with their portfolio data
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
        ORDER BY ps.total_current_value DESC NULLS LAST
      )
      SELECT * FROM portfolio_data
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
    
    // Try to get cached prices first
    const cachedPrices = await getCachedData<Record<string, number>>('stock:prices:current');
    
    if (cachedPrices && !forceRefresh) {
      console.log('Using cached stock prices from Redis');
      Object.entries(cachedPrices).forEach(([symbol, price]) => {
        symbolPrices.set(symbol, price);
      });
    } else if (allSymbols.size > 0) {
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
        
        // Cache the prices for 5 minutes
        const pricesObject = Object.fromEntries(symbolPrices.entries());
        await cacheData('stock:prices:current', pricesObject, 300); // 5 minutes
      } catch (e) {
        console.error("Error fetching stock quotes:", e);
        // Continue with cached data if fetch fails
      }
    }

    // Get historical prices for 1 day ago and 7 days ago
    const historicalPrices1Day = new Map<string, number>();
    const historicalPrices7Days = new Map<string, number>();
    
    // Try to get cached historical prices first
    const cachedPrices1Day = await getCachedData<Record<string, number>>('stock:prices:1day');
    const cachedPrices7Days = await getCachedData<Record<string, number>>('stock:prices:7days');
    
    if (cachedPrices1Day && !forceRefresh) {
      console.log('Using cached 1-day historical prices from Redis');
      Object.entries(cachedPrices1Day).forEach(([symbol, price]) => {
        historicalPrices1Day.set(symbol, price);
      });
    }
    
    if (cachedPrices7Days && !forceRefresh) {
      console.log('Using cached 7-day historical prices from Redis');
      Object.entries(cachedPrices7Days).forEach(([symbol, price]) => {
        historicalPrices7Days.set(symbol, price);
      });
    }
    
    // If we need to fetch historical prices (either forced or not cached)
    const needToFetch1Day = forceRefresh || !cachedPrices1Day;
    const needToFetch7Days = forceRefresh || !cachedPrices7Days;
    
    if ((needToFetch1Day || needToFetch7Days) && allSymbols.size > 0) {
      try {
        console.log(`Fetching historical prices for ${allSymbols.size} symbols`);
        const symbols = Array.from(allSymbols);
        
        // For daily data, we want yesterday's closing price
        const oneDayStart = new Date(today);
        oneDayStart.setDate(oneDayStart.getDate() - 2); // Go back 2 days to ensure we get data
        
        // For weekly data, we want the closing price from 7 days ago
        const sevenDayStart = new Date(today);
        sevenDayStart.setDate(sevenDayStart.getDate() - 8); // Go back 8 days to ensure we get data
        
        // End date for both ranges (yesterday's close)
        const endDate = new Date(today);
        endDate.setDate(endDate.getDate() - 1);
        
        console.log(`Daily range: ${oneDayStart.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
        console.log(`Weekly range: ${sevenDayStart.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
        
        for (const symbol of symbols) {
          try {
            // Get daily historical data if needed
            if (needToFetch1Day) {
              try {
                console.log(`Fetching daily historical data for ${symbol}`);
                
                // Use chart method directly
                const chartResult = await yahooFinance.chart(symbol, {
                  period1: oneDayStart,
                  period2: endDate,
                  interval: '1d'
                });
                
                if (chartResult && chartResult.quotes && chartResult.quotes.length > 0) {
                  // Get the most recent price (yesterday's close)
                  const quote = chartResult.quotes[chartResult.quotes.length - 1];
                  if (quote.close !== null) {
                    historicalPrices1Day.set(symbol, quote.close);
                    console.log(`Got daily historical price for ${symbol}: ${quote.close}`);
                  } else {
                    console.log(`No valid close price in daily historical data for ${symbol}, using current price as fallback`);
                    // Use current price as fallback
                    const currentPrice = symbolPrices.get(symbol);
                    if (currentPrice) {
                      historicalPrices1Day.set(symbol, currentPrice);
                    }
                  }
                } else {
                  console.log(`No daily historical data found for ${symbol}, using current price as fallback`);
                  // Use current price as fallback
                  const currentPrice = symbolPrices.get(symbol);
                  if (currentPrice) {
                    historicalPrices1Day.set(symbol, currentPrice);
                  }
                }
              } catch (chartErr) {
                console.error(`Error fetching daily chart data for ${symbol}:`, chartErr);
                // Use current price as fallback
                const currentPrice = symbolPrices.get(symbol);
                if (currentPrice) {
                  historicalPrices1Day.set(symbol, currentPrice);
                }
              }
            }
            
            // Get weekly historical data if needed
            if (needToFetch7Days) {
              try {
                console.log(`Fetching weekly historical data for ${symbol}`);
                
                // Use chart method directly
                const chartResult = await yahooFinance.chart(symbol, {
                  period1: sevenDayStart,
                  period2: endDate,
                  interval: '1d'
                });
                
                if (chartResult && chartResult.quotes && chartResult.quotes.length > 0) {
                  // Get the price from 7 days ago (first data point)
                  const quote = chartResult.quotes[0];
                  if (quote.close !== null) {
                    historicalPrices7Days.set(symbol, quote.close);
                    console.log(`Got weekly historical price for ${symbol}: ${quote.close}`);
                  } else {
                    console.log(`No valid close price in weekly historical data for ${symbol}, using current price as fallback`);
                    // Use current price as fallback
                    const currentPrice = symbolPrices.get(symbol);
                    if (currentPrice) {
                      historicalPrices7Days.set(symbol, currentPrice);
                    }
                  }
                } else {
                  console.log(`No weekly historical data found for ${symbol}, using current price as fallback`);
                  // Use current price as fallback
                  const currentPrice = symbolPrices.get(symbol);
                  if (currentPrice) {
                    historicalPrices7Days.set(symbol, currentPrice);
                  }
                }
              } catch (chartErr) {
                console.error(`Error fetching weekly chart data for ${symbol}:`, chartErr);
                // Use current price as fallback
                const currentPrice = symbolPrices.get(symbol);
                if (currentPrice) {
                  historicalPrices7Days.set(symbol, currentPrice);
                }
              }
            }
          } catch (err) {
            console.error(`Error fetching historical data for ${symbol}:`, err);
            // Use current price as fallback
            const currentPrice = symbolPrices.get(symbol);
            if (currentPrice) {
              if (needToFetch1Day) {
                historicalPrices1Day.set(symbol, currentPrice);
              }
              if (needToFetch7Days) {
                historicalPrices7Days.set(symbol, currentPrice);
              }
            }
          }
        }
        
        // Cache the historical prices
        if (needToFetch1Day) {
          const prices1DayObject = Object.fromEntries(historicalPrices1Day.entries());
          await cacheData('stock:prices:1day', prices1DayObject, 86400); // 24 hours
        }
        
        if (needToFetch7Days) {
          const prices7DaysObject = Object.fromEntries(historicalPrices7Days.entries());
          await cacheData('stock:prices:7days', prices7DaysObject, 86400); // 24 hours
        }
      } catch (e) {
        console.error("Error fetching historical stock data:", e);
      }
    }

    // Calculate real-time portfolio values and gains
    const updatedResults = await Promise.all(results.map(async (user: Record<string, any>) => {
      let totalCurrentValue = 0;
      let totalPurchaseValue = 0;
      let totalValue1DayAgo = 0;
      let totalValue7DaysAgo = 0;
      
      if (user.stocks && Array.isArray(user.stocks)) {
        user.stocks.forEach((stock: Record<string, any>) => {
          // Get current price, with fallback to purchase price
          const currentPrice = symbolPrices.get(stock.symbol) || stock.purchasePrice;
          
          // Get historical prices with fallbacks
          // For 1-day ago, use: 1) historical price if available, 2) current price, 3) purchase price
          const price1DayAgo = historicalPrices1Day.get(stock.symbol) || currentPrice || stock.purchasePrice;
          
          // For 7-days ago, use: 1) historical price if available, 2) current price, 3) purchase price
          const price7DaysAgo = historicalPrices7Days.get(stock.symbol) || currentPrice || stock.purchasePrice;
          
          // Calculate values
          const currentValue = stock.quantity * currentPrice;
          const purchaseValue = stock.quantity * stock.purchasePrice;
          const value1DayAgo = stock.quantity * price1DayAgo;
          const value7DaysAgo = stock.quantity * price7DaysAgo;
          
          // Add to totals
          totalCurrentValue += currentValue;
          totalPurchaseValue += purchaseValue;
          totalValue1DayAgo += value1DayAgo;
          totalValue7DaysAgo += value7DaysAgo;
          
          // Log the values for debugging
          console.log(`Stock ${stock.symbol}: Current: $${currentPrice}, 1-Day: $${price1DayAgo}, 7-Day: $${price7DaysAgo}, Purchase: $${stock.purchasePrice}`);
        });
      }
      
      // Calculate gains and percentages
      const totalGain = totalCurrentValue - totalPurchaseValue;
      const totalGainPercentage = totalPurchaseValue > 0 ? (totalGain / totalPurchaseValue) * 100 : 0;
      
      // Calculate daily and weekly gains based on actual historical data
      const dailyGain = totalCurrentValue - totalValue1DayAgo;
      const dailyGainPercentage = totalValue1DayAgo > 0 ? (dailyGain / totalValue1DayAgo) * 100 : 0;
      
      const weeklyGain = totalCurrentValue - totalValue7DaysAgo;
      const weeklyGainPercentage = totalValue7DaysAgo > 0 ? (weeklyGain / totalValue7DaysAgo) * 100 : 0;
      
      // Log the calculated values
      console.log(`User ${user.username}: Current: $${totalCurrentValue.toFixed(2)}, Purchase: $${totalPurchaseValue.toFixed(2)}`);
      console.log(`  Total Gain: $${totalGain.toFixed(2)} (${totalGainPercentage.toFixed(2)}%)`);
      console.log(`  Daily Gain: $${dailyGain.toFixed(2)} (${dailyGainPercentage.toFixed(2)}%)`);
      console.log(`  Weekly Gain: $${weeklyGain.toFixed(2)} (${weeklyGainPercentage.toFixed(2)}%)`);
      
      // Update database if requested
      if (updateDb && forceRefresh) {
        try {
          await sql`
            UPDATE portfolio_summaries
            SET 
              total_current_value = ${totalCurrentValue},
              total_purchase_value = ${totalPurchaseValue},
              total_gain = ${totalGain},
              total_gain_percentage = ${totalGainPercentage},
              daily_gain = ${dailyGain},
              daily_gain_percentage = ${dailyGainPercentage},
              weekly_gain = ${weeklyGain},
              weekly_gain_percentage = ${weeklyGainPercentage},
              last_updated = NOW()
            WHERE user_id = ${user.id}
          `;
          console.log(`Updated portfolio summary in database for user ${user.username}`);
        } catch (err) {
          console.error(`Error updating portfolio summary for user ${user.username}:`, err);
        }
      }
      
      return {
        ...user,
        current_worth: totalCurrentValue,
        purchase_value: totalPurchaseValue,
        total_gain: totalGain,
        total_gain_percentage: totalGainPercentage,
        daily_gain: dailyGain,
        daily_gain_percentage: dailyGainPercentage,
        weekly_gain: weeklyGain,
        weekly_gain_percentage: weeklyGainPercentage
      };
    }));

    // Format the data for the frontend
    const formattedResults = updatedResults.map((user: Record<string, any>) => {
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