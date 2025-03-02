import { NextResponse } from "next/server";
import { createSqlClient } from "@/lib/db";

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
    
    // Query to get users with their portfolio data
    const query = `
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
          ) as stocks
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
    
    const result = await sql.query(query);
    
    // Process the results to calculate gains
    // In a real app, you would fetch current prices from an external API
    // For now, we'll simulate with random gains
    const leaderboardData = result.map((user: UserWithStocks) => {
      // Skip users with no stocks
      if (!user.stocks || user.stocks[0]?.symbol === null) {
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
      let totalInvested = parseFloat(user.total_invested);
      
      // Process each stock to calculate current worth and find top gainer
      const stocksWithGains = user.stocks.map((stock: Stock) => {
        // Simulate current price with a random gain/loss between -20% and +50%
        const randomFactor = 0.8 + (Math.random() * 0.7); // Between 0.8 and 1.5
        const currentPrice = stock.purchasePrice * randomFactor;
        const stockWorth = stock.quantity * currentPrice;
        const stockGain = stockWorth - (stock.quantity * stock.purchasePrice);
        const stockGainPercentage = (stockGain / (stock.quantity * stock.purchasePrice)) * 100;
        
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
    });
    
    return NextResponse.json(leaderboardData);
  } catch (error) {
    console.error("Error fetching leaderboard data:", error);
    return NextResponse.json(
      { error: "Failed to fetch leaderboard data" },
      { status: 500 }
    );
  }
} 