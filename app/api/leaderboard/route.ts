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

export async function GET() {
  try {
    // Try to get cached leaderboard data first (short TTL to ensure fresh data)
    const cachedLeaderboard = await getCachedData<any[]>('leaderboard:data');
    if (cachedLeaderboard) {
      console.log('Returning cached leaderboard data');
      return NextResponse.json(cachedLeaderboard);
    }

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
      // Skip users without stocks
      if (!user.stocks || user.stocks.length === 0) {
        return null;
      }

      // Calculate current portfolio value using real Yahoo Finance data
      let currentWorth = 0;
      const stocksWithCurrentPrices = user.stocks.map((stock: Record<string, any>) => {
        const currentPrice = symbolPrices.get(stock.symbol) || stock.purchasePrice;
        const currentValue = stock.quantity * currentPrice;
        currentWorth += currentValue;
        
        return {
          ...stock,
          currentPrice,
          currentValue
        };
      });

      // Calculate total gain based on purchase vs current value
      const totalGain = currentWorth - user.total_investment;
      const totalGainPercentage = user.total_investment > 0 
        ? (totalGain / user.total_investment) * 100 
        : 0;
        
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
      
      if (stocksWithCurrentPrices.length > 0) {
        // Calculate gain percentage for each stock
        const stocksWithGains = stocksWithCurrentPrices.map((stock: Record<string, any>) => {
          const gain = (stock.currentPrice - stock.purchasePrice) * stock.quantity;
          const gainPercentage = stock.purchasePrice > 0 
            ? ((stock.currentPrice - stock.purchasePrice) / stock.purchasePrice) * 100 
            : 0;
          
          return { ...stock, gain, gainPercentage };
        });
        
        // Sort by gain percentage to find top gainer
        const sortedByGain = [...stocksWithGains].sort((a, b) => b.gainPercentage - a.gainPercentage);
        if (sortedByGain.length > 0) {
          topGainer = sortedByGain[0].symbol;
          topGainerPercentage = sortedByGain[0].gainPercentage;
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
        name: user.username,
        totalGain: formatCurrency(totalGain),
        totalGainPercentage: totalGainPercentage.toFixed(2),
        dailyGain: formatCurrency(dailyGain),
        dailyGainPercentage: dailyGainPercentage.toFixed(2),
        weeklyGain: formatCurrency(weeklyGain),
        weeklyGainPercentage: weeklyGainPercentage.toFixed(2),
        topGainer,
        topGainerPercentage: topGainerPercentage.toFixed(2),
        currentWorth: formatCurrency(currentWorth),
        chartData,
        stockDistribution
      };
    }));

    // Filter out null entries (users without stocks)
    const finalResults = formattedResults.filter(Boolean);
    
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