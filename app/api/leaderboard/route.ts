import { NextResponse } from "next/server";
import { createSqlClient } from "@/lib/db";
import { formatCurrency, parseCurrency } from "@/lib/utils";
import { getCachedData, cacheData, getPortfolioHistory } from "@/lib/redis";

// One day in milliseconds for calculating daily metrics
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export async function GET() {
  try {
    // Try to get cached leaderboard data first
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

    // Format the data for the frontend
    const formattedResults = await Promise.all(results.map(async (user) => {
      // Skip users without stocks
      if (!user.stocks || user.stocks.length === 0) {
        return null;
      }

      let totalGain = 0;
      let dailyGain = 0;
      let weeklyGain = 0;
      let currentWorth = user.total_investment || 0;
      
      // Get historical portfolio data from Redis
      const portfolioHistory = await getPortfolioHistory(user.id, 7);
      const hasHistoricalData = portfolioHistory.length > 0;
      
      // If we have historical data, calculate gains
      if (hasHistoricalData) {
        const latestValue = portfolioHistory[0]?.value || currentWorth;
        const oneDayAgoValue = portfolioHistory.find(item => 
          new Date(item.date).getTime() < (today.getTime() - ONE_DAY_MS)
        )?.value;
        
        const sevenDaysAgoValue = portfolioHistory.find(item => 
          new Date(item.date).getTime() <= sevenDaysAgo.getTime()
        )?.value;
        
        // Current worth from latest cached value
        currentWorth = latestValue;
        
        // Calculate gains if we have the data
        if (oneDayAgoValue) {
          dailyGain = latestValue - oneDayAgoValue;
        }
        
        if (sevenDaysAgoValue) {
          weeklyGain = latestValue - sevenDaysAgoValue;
        }
        
        // Total gain based on purchase
        totalGain = latestValue - user.total_investment;
      } else {
        // Fallback to simulated data for testing
        // In a real app, we'd calculate this from actual stock prices
        dailyGain = currentWorth * (Math.random() * 0.04 - 0.02); // -2% to +2%
        weeklyGain = currentWorth * (Math.random() * 0.08 - 0.03); // -3% to +5%
        totalGain = currentWorth * (Math.random() * 0.15); // 0% to +15%
      }

      // Calculate percentages
      const totalGainPercentage = user.total_investment > 0 
        ? (totalGain / user.total_investment) * 100 
        : 0;
      
      const dailyGainPercentage = currentWorth > 0 
        ? (dailyGain / (currentWorth - dailyGain)) * 100 
        : 0;
      
      const weeklyGainPercentage = currentWorth > 0 
        ? (weeklyGain / (currentWorth - weeklyGain)) * 100 
        : 0;

      // Chart data - simplified example (in real app, use actual historical data)
      const chartData = portfolioHistory.length > 0
        ? portfolioHistory.map(item => ({ date: item.date, value: item.value })).reverse()
        : generateMockChartData(user.id, 7); // Fallback to mock data
      
      return {
        id: user.id,
        name: user.username,
        totalGain: formatCurrency(totalGain),
        totalGainPercentage: totalGainPercentage.toFixed(2),
        dailyGain: formatCurrency(dailyGain),
        dailyGainPercentage: dailyGainPercentage.toFixed(2),
        weeklyGain: formatCurrency(weeklyGain),
        weeklyGainPercentage: weeklyGainPercentage.toFixed(2),
        topGainer: user.stocks && user.stocks.length > 0 ? user.stocks[0].symbol : null,
        currentWorth: formatCurrency(currentWorth),
        chartData
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

    // Cache the results for 1 hour
    await cacheData('leaderboard:data', finalResults, 3600);
    
    return NextResponse.json(finalResults);
  } catch (error) {
    console.error("Error fetching leaderboard data:", error);
    return NextResponse.json({ error: "Failed to fetch leaderboard data" }, { status: 500 });
  }
}

// Helper function to generate mock chart data for testing
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