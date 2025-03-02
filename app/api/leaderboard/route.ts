import { NextResponse } from "next/server";
import { createSqlClient } from "@/lib/db";
import yahooFinance from "yahoo-finance2";

// Define types for our data structures
type Stock = {
  symbol: string;
  quantity: number;
  purchasePrice: number;
  purchaseDate: string;
};

type UserWithStocks = {
  id: number;
  name: string;
  total_invested: string;
  stocks: Stock[];
};

type StockWithGains = Stock & {
  currentPrice: number;
  gain: number;
  gainPercentage: number;
};

type LeaderboardUser = {
  id: number;
  name: string;
  totalGain: number;
  totalGainPercentage: number;
  topGainer: string | null;
  topGainerPercentage: number;
  currentWorth: number;
};

export async function GET() {
  try {
    const sql = createSqlClient();
    
    // Execute query to get users with their portfolio data using tagged template literal
    const result = await sql`
      WITH user_portfolio AS (
        SELECT 
          u.id as user_id,
          u.username as username,
          s.symbol,
          s.quantity,
          s.purchase_price,
          s.purchase_date
        FROM users u
        LEFT JOIN user_stocks s ON u.id = s.user_id
      ),
      user_totals AS (
        SELECT 
          up.user_id,
          up.username,
          SUM(up.quantity * up.purchase_price) as total_invested,
          json_agg(
            json_build_object(
              'symbol', up.symbol,
              'quantity', up.quantity,
              'purchasePrice', up.purchase_price,
              'purchaseDate', up.purchase_date
            )
          ) FILTER (WHERE up.symbol IS NOT NULL) as stocks
        FROM user_portfolio up
        GROUP BY up.user_id, up.username
      )
      SELECT 
        ut.user_id as id,
        ut.username as name,
        COALESCE(ut.total_invested, 0) as total_invested,
        ut.stocks
      FROM user_totals ut
      ORDER BY total_invested DESC
    `;
    
    console.log('Leaderboard query result:', result);
    
    // Get specific politician data to ensure they're included
    const politicianResult = await sql`
      SELECT 
        u.id as id,
        u.username as name,
        SUM(s.quantity * s.purchase_price) as total_invested,
        json_agg(
          json_build_object(
            'symbol', s.symbol,
            'quantity', s.quantity,
            'purchasePrice', s.purchase_price,
            'purchaseDate', s.purchase_date
          )
        ) as stocks
      FROM users u
      JOIN user_stocks s ON u.id = s.user_id
      WHERE u.username LIKE '%(%)'
      GROUP BY u.id, u.username
      ORDER BY u.username
    `;
    
    console.log('Politician query result:', politicianResult);
    
    // Combine results, ensuring no duplicates
    const combinedResults = [...result];
    
    // Add politicians that might be missing
    for (const politician of politicianResult) {
      if (!combinedResults.find(user => user.id === politician.id)) {
        combinedResults.push(politician);
      }
    }
    
    console.log('Combined results count:', combinedResults.length);
    
    // Collect all unique stock symbols across all users
    const allSymbols = new Set<string>();
    for (const user of combinedResults) {
      if (user.stocks && Array.isArray(user.stocks)) {
        for (const stock of user.stocks) {
          if (stock.symbol) {
            allSymbols.add(stock.symbol);
          }
        }
      }
    }
    
    // Fetch real-time quotes for all symbols in a single batch request
    const symbolPrices = new Map<string, number>();
    
    if (allSymbols.size > 0) {
      try {
        const symbols = Array.from(allSymbols);
        const quotesResponse = await yahooFinance.quote(symbols);
        
        // Process the quotes response
        if (Array.isArray(quotesResponse)) {
          for (const quote of quotesResponse) {
            const typedQuote = quote as unknown as { symbol: string; regularMarketPrice: number };
            if (typedQuote.symbol && typedQuote.regularMarketPrice) {
              symbolPrices.set(typedQuote.symbol, typedQuote.regularMarketPrice);
            }
          }
        } else if (quotesResponse) {
          const quote = quotesResponse as unknown as { symbol: string; regularMarketPrice: number };
          if (quote.symbol && quote.regularMarketPrice) {
            symbolPrices.set(quote.symbol, quote.regularMarketPrice);
          }
        }
      } catch (e) {
        console.error("Error fetching stock quotes:", e);
        // Continue with default prices if fetch fails
      }
    }
    
    // Process the results to calculate gains
    const leaderboardData = combinedResults.map((user: Record<string, any>) => {
      console.log('Processing user:', user.name, 'with stocks:', user.stocks ? (Array.isArray(user.stocks) ? user.stocks.length : 'non-array') : 'none');
      
      // Handle users with no stocks
      if (!user.stocks || !Array.isArray(user.stocks) || user.stocks.length === 0) {
        console.log('User has no stocks:', user.name);
        return {
          id: user.id,
          name: user.name,
          totalGain: 0,
          totalGainPercentage: 0,
          topGainer: null,
          topGainerPercentage: 0,
          currentWorth: 0
        };
      }
      
      // Calculate current worth and gains
      let totalCurrentWorth = 0;
      let totalInvested = parseFloat(user.total_invested || '0');
      
      // Process each stock to calculate current worth and find top gainer
      const stocksWithGains = user.stocks.map((stock: Stock) => {
        // Get the current price from our map, or fall back to purchase price
        const currentPrice = symbolPrices.get(stock.symbol) || stock.purchasePrice;
        const stockWorth = stock.quantity * currentPrice;
        const stockGain = stockWorth - (stock.quantity * stock.purchasePrice);
        const stockGainPercentage = stock.purchasePrice > 0 ? 
          (stockGain / (stock.quantity * stock.purchasePrice)) * 100 : 0;
        
        totalCurrentWorth += stockWorth;
        
        return {
          ...stock,
          currentPrice,
          gain: stockGain,
          gainPercentage: stockGainPercentage
        };
      });
      
      // Find top gainer
      let topGainer = null;
      let topGainerPercentage = 0;
      
      if (stocksWithGains.length > 0) {
        const sortedStocks = [...stocksWithGains].sort((a, b) => b.gainPercentage - a.gainPercentage);
        topGainer = sortedStocks[0].symbol;
        topGainerPercentage = sortedStocks[0].gainPercentage;
      }
      
      // Calculate total gain
      const totalGain = totalCurrentWorth - totalInvested;
      const totalGainPercentage = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;
      
      return {
        id: user.id,
        name: user.name,
        totalGain,
        totalGainPercentage,
        topGainer,
        topGainerPercentage,
        currentWorth: totalCurrentWorth
      };
    }).filter(user => user.name); // Filter out any users with no name
    
    // Sort by total gain in descending order
    leaderboardData.sort((a, b) => b.currentWorth - a.currentWorth);
    
    return NextResponse.json(leaderboardData);
  } catch (error) {
    console.error("Error fetching leaderboard data:", error);
    return NextResponse.json(
      { error: "Failed to fetch leaderboard data" },
      { status: 500 }
    );
  }
} 