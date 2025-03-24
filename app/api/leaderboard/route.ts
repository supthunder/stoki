import { NextResponse } from "next/server";
import { createSqlClient } from "@/lib/db";
import { formatCurrency, parseCurrency } from "@/lib/utils";
import { getCachedData, cacheData, getPortfolioHistory, cachePortfolioValue, getCachedLeaderboardData, cacheLeaderboardData } from "@/lib/redis";
import yahooFinance from "yahoo-finance2";
import { isCryptoCurrency, getCryptoPrice, getCryptoHistoricalPrice, getBatchCryptoPrices } from '@/lib/crypto-api';

// One day in milliseconds for calculating daily metrics
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
// Seven days in milliseconds for calculating weekly metrics
const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;

// Type definition for Yahoo Finance quote response
interface YahooQuoteResponse {
  symbol: string;
  regularMarketPrice?: number;
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
    // Get query parameters
    const url = new URL(request.url);
    const refresh = url.searchParams.get('refresh') === 'true';
    const updateDb = url.searchParams.get('updateDb') === 'true';
    const timeFrame = url.searchParams.get('timeFrame') || 'total'; // Default to total
    const useMock = url.searchParams.get('mock') === 'true'; // Add mock data option
    
    console.log(`Leaderboard request: timeFrame=${timeFrame}, refresh=${refresh}, updateDb=${updateDb}, useMock=${useMock}`);

    // If using mock data, return it directly
    if (useMock) {
      console.log("Using mock leaderboard data");
      const mockData = getMockLeaderboardData();
      return NextResponse.json(mockData);
    }

    // If not refreshing, try to get data from Redis cache first
    if (!refresh) {
      const cachedData = await getCachedLeaderboardData(timeFrame);
      if (cachedData) {
        console.log(`Found cached leaderboard data for timeFrame: ${timeFrame}`);
        return NextResponse.json(cachedData);
      }
    }

    const sql = createSqlClient();
    
    try {
      // Check if the user_stocks table exists
      const tableExists = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'user_stocks'
        );
      `;

      if (!tableExists[0]?.exists) {
        console.error("user_stocks table does not exist");
        return NextResponse.json({ 
          error: "Database is not properly initialized",
          message: "Please run the /api/init-db endpoint to set up the database"
        }, { status: 500 });
      }

      // Get all users with their portfolio data
      const users = await sql`
        SELECT 
          u.id, 
          u.username, 
          u.avatar,
          COALESCE(SUM(s.quantity * s.purchase_price)::DECIMAL, 0) as starting_amount
        FROM 
          users u
        LEFT JOIN
          user_stocks s ON u.id = s.user_id
        GROUP BY 
          u.id
        ORDER BY 
          starting_amount DESC
      `;
      
      console.log(`Found ${users.length} users with portfolios`);

      // Process each user's portfolio data to calculate metrics
      const leaderboardData = await Promise.all(users.map(async (user) => {
        // Skip users with no portfolio
        if (user.starting_amount === 0) {
          return {
            id: user.id,
            username: user.username,
            avatar: user.avatar,
            totalGain: "$0.00",
            totalGainPercentage: "0.00",
            dailyGain: "$0.00",
            dailyGainPercentage: "0.00",
            weeklyGain: "$0.00",
            weeklyGainPercentage: "0.00",
            currentWorth: "$0.00",
            startingAmount: "$0.00",
            topGainer: null,
          };
        }
        
        // Get the user's portfolio items
        const portfolio = await sql`
          SELECT 
            s.id, 
            s.symbol, 
            s.quantity, 
            s.purchase_price,
            s.purchase_date,
            s.company_name
          FROM 
            user_stocks s
          WHERE 
            s.user_id = ${user.id}
        `;
        
        // Separate stock symbols and crypto symbols
        const stockSymbols = portfolio
          .filter(item => !isCryptoCurrency(item.symbol))
          .map(item => item.symbol);
        
        const cryptoSymbols = portfolio
          .filter(item => isCryptoCurrency(item.symbol))
          .map(item => item.symbol);
        
        // Initialize a map to store current prices for all symbols
        const symbolPrices = new Map<string, number>();

        // Get current prices for all stocks
        if (stockSymbols.length > 0) {
          console.log(`Fetching prices for ${stockSymbols.length} stocks from Yahoo Finance`);
          
          // First check if we have cached prices 
          const cachedStockPrices = await getCachedData<Record<string, number>>('stocks:prices:current');
          let fetchRequired = true;
          
          if (cachedStockPrices && !refresh) {
            console.log('Using cached stock prices');
            fetchRequired = false;
            
            // Add the cached prices to the map
            stockSymbols.forEach(symbol => {
              if (cachedStockPrices[symbol]) {
                symbolPrices.set(symbol, cachedStockPrices[symbol]);
              } else {
                // If we don't have a cached price for this symbol, we need to fetch
                fetchRequired = true;
              }
            });
          }
          
          if (fetchRequired) {
            try {
              // Use Yahoo Finance to get current prices for each symbol individually
              const stockPricesObject: Record<string, number> = {};
              
              for (const symbol of stockSymbols) {
                try {
                  const quoteResponse = await yahooFinance.quote(symbol);
                  
                  // Handle different response formats
                  let quote: YahooQuoteResponse;
                  if (Array.isArray(quoteResponse)) {
                    quote = quoteResponse[0] || { symbol };
                  } else {
                    quote = quoteResponse as YahooQuoteResponse;
                  }
                  
                  if (quote && typeof quote.regularMarketPrice === 'number') {
                    const price = quote.regularMarketPrice;
                    symbolPrices.set(symbol, price);
                    stockPricesObject[symbol] = price;
                    console.log(`Got price for ${symbol}: ${price}`);
                  }
                } catch (error) {
                  console.error(`Error fetching price for ${symbol}:`, error);
                }
              }
              
              // Cache all stock prices together
              if (Object.keys(stockPricesObject).length > 0) {
                await cacheData('stocks:prices:current', stockPricesObject, 300); // 5 minutes
                console.log(`Cached ${Object.keys(stockPricesObject).length} stock prices for 5 minutes`);
              }
            } catch (yahooError) {
              console.error("Error fetching Yahoo Finance data:", yahooError);
            }
          }
        }

        // Fetch crypto prices from CoinGecko
        if (cryptoSymbols.length > 0) {
          console.log(`Fetching prices for ${cryptoSymbols.length} cryptocurrencies from CoinGecko`);
          
          // First check if we have cached prices
          const cachedCryptoPrices = await getCachedData<Record<string, number>>('crypto:prices:current');
          let fetchRequired = true;
          
          if (cachedCryptoPrices && !refresh) {
            console.log('Using cached crypto prices');
            fetchRequired = false;
            
            // Add the cached prices to the map
            cryptoSymbols.forEach(symbol => {
              if (cachedCryptoPrices[symbol]) {
                symbolPrices.set(symbol, cachedCryptoPrices[symbol]);
              } else {
                // If we don't have a cached price for this symbol, we need to fetch
                fetchRequired = true;
              }
            });
          }
          
          if (fetchRequired) {
            try {
              // Use the batch fetching function to get all prices at once
              const cryptoPriceMap = await getBatchCryptoPrices(cryptoSymbols);
              
              // Add the prices to the main map
              cryptoPriceMap.forEach((price, symbol) => {
                symbolPrices.set(symbol, price);
                console.log(`Got price for ${symbol}: ${price}`);
              });
              
              // Cache all crypto prices together
              const cryptoPricesObject = Object.fromEntries(
                Array.from(cryptoPriceMap.entries())
              );
              
              if (Object.keys(cryptoPricesObject).length > 0) {
                await cacheData('crypto:prices:current', cryptoPricesObject, 300); // 5 minutes
                console.log(`Cached ${Object.keys(cryptoPricesObject).length} crypto prices for 5 minutes`);
              }
            } catch (cryptoError) {
              console.error("Error fetching crypto prices:", cryptoError);
            }
          }
        }
        console.log(`Retrieved ${symbolPrices.size} current prices`);

        // Calculate starting amount and current worth
        let startingAmount = 0;
        let currentWorth = 0;
        
        // For tracking the best performing asset
        let topGainer = {
          symbol: "",
          gainPercentage: -Infinity,
        };
        
        // Get today's and last week's dates
        const today = new Date();
        const yesterday = new Date(today.getTime() - ONE_DAY_MS);
        const lastWeek = new Date(today.getTime() - SEVEN_DAYS_MS);
        
        // Format dates for API calls
        const todayStr = today.toISOString().split('T')[0];
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        const lastWeekStr = lastWeek.toISOString().split('T')[0];
        
        // Historical value tracking
        let valueToday = 0;
        let valueYesterday = 0;
        let valueLastWeek = 0;
        
        // Process each portfolio item
        await Promise.all(portfolio.map(async (item) => {
          // Calculate the starting amount
          const itemStartingAmount = item.quantity * item.purchase_price;
          startingAmount += itemStartingAmount;
          
          // Get the current price
          const currentPrice = symbolPrices.get(item.symbol);
          
          if (currentPrice) {
            // Calculate current worth
            const itemCurrentWorth = item.quantity * currentPrice;
            currentWorth += itemCurrentWorth;
            
            // Calculate gain and gain percentage
            const itemGain = itemCurrentWorth - itemStartingAmount;
            const itemGainPercentage = (itemGain / itemStartingAmount) * 100;
            
            // Track the top gainer
            if (itemGainPercentage > topGainer.gainPercentage && item.symbol) {
              topGainer = {
                symbol: item.symbol,
                gainPercentage: itemGainPercentage,
              };
            }
            
            // Historical values for daily and weekly calculations
            let priceYesterday = currentPrice;
            let priceLastWeek = currentPrice;
            
            // Get historical price for yesterday
            const purchaseDate = new Date(item.purchase_date);
            
            // Only get historical prices if the asset was owned yesterday/last week
            if (purchaseDate < yesterday) {
              try {
                // For stocks, use Yahoo Finance or cache
                if (!isCryptoCurrency(item.symbol)) {
                  const cachedYesterdayPrice = await getCachedData<number>(`stock:${item.symbol}:price:${yesterdayStr}`);
                  
                  if (cachedYesterdayPrice !== null) {
                    priceYesterday = cachedYesterdayPrice;
                  } else {
                    try {
                      console.log(`Fetching historical price for ${item.symbol} on ${yesterdayStr}`);
                      const historicalResult = await yahooFinance.historical(item.symbol, {
                        period1: yesterday,
                        interval: '1d',
                      });
                      
                      if (historicalResult.length > 0) {
                        priceYesterday = historicalResult[0].close;
                        // Cache the result
                        await cacheData(`stock:${item.symbol}:price:${yesterdayStr}`, priceYesterday, 86400); // 24 hours
                      }
                    } catch (error) {
                      console.error(`Error fetching historical price for ${item.symbol}:`, error);
                    }
                  }
                } else {
                  // For crypto, use CoinGecko or cache
                  priceYesterday = await getCryptoHistoricalPrice(item.symbol, yesterday) || currentPrice;
                }
              } catch (error) {
                console.error(`Error getting historical price for ${item.symbol} (yesterday):`, error);
              }
              
              // Calculate yesterday's value
              valueYesterday += item.quantity * priceYesterday;
            } else {
              // If asset was purchased today, use purchase price for yesterday
              valueYesterday += itemStartingAmount;
            }
            
            // Get historical price for last week
            if (purchaseDate < lastWeek) {
              try {
                // For stocks, use Yahoo Finance or cache
                if (!isCryptoCurrency(item.symbol)) {
                  const cachedLastWeekPrice = await getCachedData<number>(`stock:${item.symbol}:price:${lastWeekStr}`);
                  
                  if (cachedLastWeekPrice !== null) {
                    priceLastWeek = cachedLastWeekPrice;
                  } else {
                    try {
                      console.log(`Fetching historical price for ${item.symbol} on ${lastWeekStr}`);
                      const historicalResult = await yahooFinance.historical(item.symbol, {
                        period1: lastWeek,
                        interval: '1d',
                      });
                      
                      if (historicalResult.length > 0) {
                        priceLastWeek = historicalResult[0].close;
                        // Cache the result
                        await cacheData(`stock:${item.symbol}:price:${lastWeekStr}`, priceLastWeek, 86400 * 7); // 7 days
                      }
                    } catch (error) {
                      console.error(`Error fetching historical price for ${item.symbol}:`, error);
                    }
                  }
                } else {
                  // For crypto, use CoinGecko or cache
                  priceLastWeek = await getCryptoHistoricalPrice(item.symbol, lastWeek) || currentPrice;
                }
              } catch (error) {
                console.error(`Error getting historical price for ${item.symbol} (last week):`, error);
              }
              
              // Calculate last week's value
              valueLastWeek += item.quantity * priceLastWeek;
            } else {
              // If asset was purchased this week, use purchase price for last week
              valueLastWeek += itemStartingAmount;
            }
            
            // Calculate today's value
            valueToday += itemCurrentWorth;
          }
        }));
        
        // Store portfolio value for today if updating DB
        if (updateDb) {
          await cachePortfolioValue(user.id, todayStr, currentWorth);
        }
        
        // Calculate total, daily, and weekly gains
        const totalGain = currentWorth - startingAmount;
        const totalGainPercentage = startingAmount > 0 ? (totalGain / startingAmount) * 100 : 0;
        
        const dailyGain = valueToday - valueYesterday;
        const dailyGainPercentage = valueYesterday > 0 ? (dailyGain / valueYesterday) * 100 : 0;
        
        const weeklyGain = valueToday - valueLastWeek;
        const weeklyGainPercentage = valueLastWeek > 0 ? (weeklyGain / valueLastWeek) * 100 : 0;
        
        // Get portfolio history for chart data
        const chartData = await getPortfolioHistory(user.id);
        
        // Get latest purchase
        let latestPurchase = null;
        if (portfolio.length > 0) {
          const sorted = [...portfolio].sort((a, b) => 
            new Date(b.purchase_date).getTime() - new Date(a.purchase_date).getTime()
          );
          
          if (sorted.length > 0) {
            latestPurchase = {
              symbol: sorted[0].symbol,
              date: sorted[0].purchase_date,
              price: sorted[0].purchase_price
            };
          }
        }
        
        // Calculate stock distribution
        const stockDistribution = portfolio.reduce((acc: any[], item) => {
          const currentPrice = symbolPrices.get(item.symbol);
          if (currentPrice) {
            const value = item.quantity * currentPrice;
            acc.push({
              name: item.symbol,
              value: value
            });
          }
          return acc;
        }, []).sort((a, b) => b.value - a.value).slice(0, 5); // Get top 5 by value
        
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
          currentWorth: formatCurrency(currentWorth),
          startingAmount: formatCurrency(startingAmount),
          topGainer: topGainer.symbol || null,
          topGainerPercentage: topGainer.symbol ? topGainer.gainPercentage.toFixed(2) : null,
          latestPurchase,
          chartData,
          stockDistribution
        };
      }));
      
      // Cache the result for future requests
      await cacheLeaderboardData(timeFrame, leaderboardData);
      
      return NextResponse.json(leaderboardData);
    } catch (dbError: any) {
      console.error("Database error:", dbError);
      // Check for specific database errors
      if (dbError.code === '42P01') { // relation does not exist
        return NextResponse.json({
          error: "Database table not found",
          message: "One of the required tables does not exist. Please run the /api/init-db endpoint to set up the database."
        }, { status: 500 });
      }
      
      throw dbError; // Rethrow to be caught by the outer catch
    }
  } catch (error) {
    console.error("Error generating leaderboard:", error);
    return NextResponse.json({ error: "Failed to generate leaderboard" }, { status: 500 });
  }
}

/**
 * This endpoint is designed to be called by GitHub Actions to update the leaderboard cache.
 * It can be called with a CRON job to keep leaderboard data fresh for all users.
 */
export async function POST(request: Request) {
  try {
    console.log("Starting scheduled leaderboard update");
    const url = new URL(request.url);
    
    // Get the API key from the request header
    const authHeader = request.headers.get('Authorization');
    const apiKey = process.env.LEADERBOARD_UPDATE_API_KEY;
    
    // Verify the API key if one is set
    if (apiKey && (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.slice(7) !== apiKey)) {
      console.error("Invalid or missing API key for scheduled leaderboard update");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Force refresh and update the database
    const timeFrames = ['daily', 'weekly', 'total'];
    const results: Record<string, string> = {};
    
    // Update each time frame
    for (const timeFrame of timeFrames) {
      console.log(`Updating leaderboard for ${timeFrame} time frame`);
      
      // Create internal request URL with required parameters
      const internalUrl = new URL(request.url);
      internalUrl.searchParams.set('timeFrame', timeFrame);
      internalUrl.searchParams.set('refresh', 'true');
      internalUrl.searchParams.set('updateDb', 'true');
      
      // Call the GET handler directly to update the cache
      const internalRequest = new Request(internalUrl.toString(), {
        method: 'GET',
      });
      
      const response = await GET(internalRequest);
      if (response.ok) {
        results[timeFrame] = 'updated';
      } else {
        results[timeFrame] = 'failed';
      }
    }
    
    console.log("Scheduled leaderboard update completed");
    return NextResponse.json({ 
      status: 'success', 
      message: 'Leaderboard data updated',
      updated: results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error in scheduled leaderboard update:", error);
    return NextResponse.json({ error: "Failed to update leaderboard data" }, { status: 500 });
  }
}

// Helper function to generate mock leaderboard data for development
function getMockLeaderboardData() {
  const mockUsers = [
    { id: 1, username: 'investor_pro', avatar: null },
    { id: 2, username: 'stock_guru', avatar: null },
    { id: 3, username: 'crypto_king', avatar: null },
    { id: 4, username: 'wall_street_wizard', avatar: null },
    { id: 5, username: 'diamond_hands', avatar: null }
  ];
  
  return mockUsers.map((user, index) => {
    // Generate random values
    const startingAmount = 10000 + (Math.random() * 5000);
    const totalGainPercent = (Math.random() * 40) - 10; // -10% to +30%
    const totalGain = startingAmount * (totalGainPercent / 100);
    const currentWorth = startingAmount + totalGain;
    
    const dailyGainPercent = (Math.random() * 6) - 2; // -2% to +4%
    const dailyGain = currentWorth * (dailyGainPercent / 100);
    
    const weeklyGainPercent = (Math.random() * 10) - 3; // -3% to +7%
    const weeklyGain = currentWorth * (weeklyGainPercent / 100);
    
    // Generate chart data
    const chartData = [];
    const today = new Date();
    let value = currentWorth;
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      // Slight randomness in daily values
      value = value * (1 + ((Math.random() * 0.04) - 0.02)); // -2% to +2%
      
      chartData.push({
        date: dateStr,
        value: Math.round(value * 100) / 100
      });
    }
    
    // Generate stock distribution
    const stockSymbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA'];
    const stockDistribution = stockSymbols.map((symbol, i) => {
      return {
        name: symbol,
        value: (currentWorth / (i + 1.5)) * (0.8 + (Math.random() * 0.4)) // Distribute total value
      };
    }).sort((a, b) => b.value - a.value);
    
    return {
      id: user.id,
      username: user.username,
      avatar: user.avatar,
      totalGain: formatCurrency(totalGain),
      totalGainPercentage: totalGainPercent.toFixed(2),
      dailyGain: formatCurrency(dailyGain),
      dailyGainPercentage: dailyGainPercent.toFixed(2),
      weeklyGain: formatCurrency(weeklyGain),
      weeklyGainPercentage: weeklyGainPercent.toFixed(2),
      currentWorth: formatCurrency(currentWorth),
      startingAmount: formatCurrency(startingAmount),
      topGainer: stockSymbols[Math.floor(Math.random() * stockSymbols.length)],
      topGainerPercentage: (Math.random() * 15).toFixed(2),
      latestPurchase: {
        symbol: stockSymbols[Math.floor(Math.random() * stockSymbols.length)],
        date: new Date(Date.now() - (Math.random() * 30 * 24 * 60 * 60 * 1000)).toISOString(), // Random date in last 30 days
        price: Math.random() * 500
      },
      chartData,
      stockDistribution
    };
  });
} 