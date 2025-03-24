import { NextResponse } from "next/server";
import { createSqlClient } from "@/lib/db";
import yahooFinance from "yahoo-finance2";
import { getCachedData, cacheData } from "@/lib/redis";
import { isCryptoCurrency, getCryptoPrice, getCryptoHistoricalPrice } from '@/lib/crypto-api';

// Define types for our data structures
type StockRecord = {
  id: number;
  symbol: string;
  companyName: string;
  quantity: number;
  purchasePrice: number;
  purchaseDate: string;
};

type EnrichedStock = StockRecord & {
  currentPrice: number;
  currentValue: number;
  historicalPrice: number;
  gain: number;
  gainPercentage: number;
};

type PortfolioSummary = {
  totalCurrentValue: number;
  totalPurchaseValue: number;
  totalGain: number;
  totalGainPercentage: number;
};

// Yahoo Finance quote response type - make properties optional to handle various response formats
type YahooQuote = {
  symbol: string;
  regularMarketPrice?: number;
  [key: string]: any;
};

export async function GET(request: Request) {
  try {
    // Get the userId from the query parameters
    const { searchParams } = new URL(request.url);
    const userIdParam = searchParams.get("userId");
    const forceRefresh = searchParams.get("refresh") === "true";

    if (!userIdParam) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Parse userId as an integer
    const userId = parseInt(userIdParam, 10);
    
    if (isNaN(userId)) {
      return NextResponse.json(
        { error: "Invalid User ID" },
        { status: 400 }
      );
    }

    const sql = createSqlClient();
    
    // Query to get user's stocks
    const result = await sql`
      SELECT 
        s.id,
        s.symbol,
        s.company_name as "companyName",
        s.quantity,
        s.purchase_price as "purchasePrice",
        s.purchase_date as "purchaseDate"
      FROM user_stocks s
      WHERE s.user_id = ${userId}
      ORDER BY s.symbol
    `;
    
    // If the user has no stocks, return an empty portfolio
    if (result.length === 0) {
      return NextResponse.json({
        stocks: [],
        summary: {
          totalCurrentValue: 0,
          totalPurchaseValue: 0,
          totalGain: 0,
          totalGainPercentage: 0
        }
      });
    }
    
    // Get all unique symbols from the portfolio
    const symbols = Array.from(new Set(result.map((stock: any) => stock.symbol)));
    
    // Filter symbols into stocks and cryptocurrencies
    const stockSymbols = symbols.filter(symbol => !isCryptoCurrency(symbol));
    const cryptoSymbols = symbols.filter(isCryptoCurrency);
    
    console.log(`Portfolio contains ${stockSymbols.length} stocks and ${cryptoSymbols.length} cryptocurrencies`);
    
    // Try to get cached stock prices first - only use a short cache (5 minutes)
    const stockCacheKey = `yahoo:quotes:${stockSymbols.join(',')}`;
    const cryptoCacheKey = `crypto:prices:${cryptoSymbols.join(',')}`;
    let symbolPrices = new Map<string, number>();
    let useCachedData = !forceRefresh;
    
    // Handle stock prices
    if (stockSymbols.length > 0) {
      const cachedStockPrices = useCachedData ? await getCachedData<Record<string, number>>(stockCacheKey) : null;
      
      // If we have cached prices, use them
      if (cachedStockPrices) {
        console.log('Using cached stock prices from Redis (5-minute cache)');
        Object.entries(cachedStockPrices).forEach(([symbol, price]) => {
          symbolPrices.set(symbol, price);
        });
      } else {
        // If no cached data, fetch from Yahoo Finance
        console.log('Fetching fresh stock prices from Yahoo Finance');
        try {
          // Fetch real-time quotes for all symbols in a single batch request
          const quotesResponse = await yahooFinance.quote(stockSymbols);
          
          // Type-safe processing of Yahoo Finance response
          // Process a single quote response
          if (!Array.isArray(quotesResponse)) {
            const quote = quotesResponse as YahooQuote;
            if (quote.symbol && quote.regularMarketPrice) {
              symbolPrices.set(quote.symbol, quote.regularMarketPrice);
            }
          } 
          // Process multiple quotes
          else {
            for (const quote of quotesResponse) {
              const typedQuote = quote as YahooQuote;
              if (typedQuote.symbol && typedQuote.regularMarketPrice) {
                symbolPrices.set(typedQuote.symbol, typedQuote.regularMarketPrice);
              }
            }
          }
          
          // Cache the prices for 5 minutes (300 seconds) to balance freshness with API rate limits
          if (symbolPrices.size > 0) {
            const pricesToCache: Record<string, number> = {};
            symbolPrices.forEach((price, symbol) => {
              pricesToCache[symbol] = price;
            });
            await cacheData(stockCacheKey, pricesToCache, 300); // 5 minute cache
            console.log('Cached new stock prices for 5 minutes:', pricesToCache);
          }
        } catch (e) {
          console.error("Error processing Yahoo Finance quotes:", e);
          // Fallback to default prices if there's an error
        }
      }
    }
    
    // Handle cryptocurrency prices
    if (cryptoSymbols.length > 0) {
      const cachedCryptoPrices = useCachedData ? await getCachedData<Record<string, number>>(cryptoCacheKey) : null;
      
      // If we have cached prices, use them
      if (cachedCryptoPrices) {
        console.log('Using cached crypto prices from Redis (5-minute cache)');
        Object.entries(cachedCryptoPrices).forEach(([symbol, price]) => {
          symbolPrices.set(symbol, price);
        });
      } else {
        // If no cached data, fetch from CoinGecko
        console.log('Fetching fresh crypto prices from CoinGecko');
        try {
          // Fetch prices for each crypto
          const cryptoPrices = await Promise.all(
            cryptoSymbols.map(async (symbol) => {
              const price = await getCryptoPrice(symbol);
              return { symbol, price };
            })
          );
          
          // Add prices to the map and prepare for caching
          const pricesToCache: Record<string, number> = {};
          
          cryptoPrices.forEach(({ symbol, price }) => {
            if (price !== null) {
              symbolPrices.set(symbol, price);
              pricesToCache[symbol] = price;
              console.log(`Got price for ${symbol}: ${price}`);
            }
          });
          
          // Cache the prices
          if (Object.keys(pricesToCache).length > 0) {
            await cacheData(cryptoCacheKey, pricesToCache, 300); // 5 minute cache
            console.log('Cached new crypto prices for 5 minutes:', pricesToCache);
          }
        } catch (e) {
          console.error("Error processing CoinGecko prices:", e);
        }
      }
    }
    
    // Helper function to check if a date is in the future
    const isDateInFuture = (dateString: string): boolean => {
      const date = new Date(dateString);
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Compare dates only
      return date > today;
    };
    
    // Get historical prices for each stock based on purchase date
    const getHistoricalPrice = async (symbol: string, purchaseDate: string): Promise<number | null> => {
      // If the purchase date is in the future, we can't get historical data
      if (isDateInFuture(purchaseDate)) {
        console.log(`Cannot get historical price for ${symbol} as date ${purchaseDate} is in the future`);
        return null;
      }
      
      // If it's a cryptocurrency, use CoinGecko
      if (isCryptoCurrency(symbol)) {
        const purchaseDateObj = new Date(purchaseDate);
        return getCryptoHistoricalPrice(symbol, purchaseDateObj);
      }
      
      // For stocks, continue with the existing implementation
      
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
      const oneDayInMs = 24 * 60 * 60 * 1000;
      
      if (now - purchaseTime < oneDayInMs) {
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
    
    // Process all stocks and get their historical prices
    const portfolioData = await Promise.all(result.map(async (stock: any) => {
      const currentPrice = symbolPrices.get(stock.symbol) || stock.purchasePrice;
      const currentValue = stock.quantity * currentPrice;
      
      // Try to get the actual historical price for more accurate gain calculation
      const historicalPrice = await getHistoricalPrice(stock.symbol, stock.purchaseDate);
      
      // If we couldn't get historical price, use the purchase price that was recorded
      const actualPurchasePrice = stock.purchasePrice; // Always use the recorded purchase price for accuracy
      const purchaseValue = stock.quantity * actualPurchasePrice;
      
      // Calculate gain/loss based on purchase vs current price
      const gain = currentValue - purchaseValue;
      const gainPercentage = ((currentPrice - actualPurchasePrice) / actualPurchasePrice) * 100;
      
      console.log(`Stock ${stock.symbol}: Purchase Price: ${actualPurchasePrice}, Current Price: ${currentPrice}, Gain: ${gain}, Gain %: ${gainPercentage}%`);
      
      return {
        ...stock,
        currentPrice,
        currentValue,
        historicalPrice: actualPurchasePrice,
        gain,
        gainPercentage
      } as EnrichedStock;
    }));
    
    // Calculate portfolio totals using the historical prices for accuracy
    const totalCurrentValue = portfolioData.reduce((sum: number, stock: EnrichedStock) => sum + stock.currentValue, 0);
    const totalPurchaseValue = portfolioData.reduce((sum: number, stock: EnrichedStock) => sum + (stock.quantity * stock.historicalPrice), 0);
    const totalGain = totalCurrentValue - totalPurchaseValue;
    const totalGainPercentage = totalPurchaseValue > 0 ? (totalGain / totalPurchaseValue) * 100 : 0;
    
    console.log(`Portfolio summary: Total Current: ${totalCurrentValue}, Total Purchase: ${totalPurchaseValue}, Total Gain: ${totalGain}`);

    // Store the portfolio summary in the database
    try {
      await sql`
        INSERT INTO portfolio_summaries (
          user_id,
          total_current_value,
          total_purchase_value,
          total_gain,
          total_gain_percentage,
          last_updated
        ) VALUES (
          ${userId},
          ${totalCurrentValue},
          ${totalPurchaseValue},
          ${totalGain},
          ${totalGainPercentage},
          NOW()
        )
        ON CONFLICT (user_id) DO UPDATE SET
          total_current_value = EXCLUDED.total_current_value,
          total_purchase_value = EXCLUDED.total_purchase_value,
          total_gain = EXCLUDED.total_gain,
          total_gain_percentage = EXCLUDED.total_gain_percentage,
          last_updated = EXCLUDED.last_updated
      `;
      console.log('Portfolio summary stored in database');
    } catch (error) {
      console.error('Error storing portfolio summary:', error);
    }
    
    return NextResponse.json({
      stocks: portfolioData,
      summary: {
        totalCurrentValue,
        totalPurchaseValue,
        totalGain,
        totalGainPercentage
      }
    });
  } catch (error) {
    console.error("Error fetching portfolio data:", error);
    return NextResponse.json(
      { error: "Failed to fetch portfolio data" },
      { status: 500 }
    );
  }
} 