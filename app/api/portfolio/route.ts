import { NextResponse } from "next/server";
import { createSqlClient } from "@/lib/db";

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
  gain: number;
  gainPercentage: number;
};

type PortfolioSummary = {
  totalCurrentValue: number;
  totalPurchaseValue: number;
  totalGain: number;
  totalGainPercentage: number;
};

export async function GET(request: Request) {
  try {
    // Get the userId from the query parameters
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
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
    
    // Process the results to calculate current values and gains
    // In a real app, you would fetch current prices from an external API
    // For now, we'll simulate with random gains
    const portfolioData = result.map((stock: Record<string, any>) => {
      // Simulate current price with a random gain/loss between -20% and +50%
      const randomFactor = 0.8 + (Math.random() * 0.7); // Between 0.8 and 1.5
      const currentPrice = stock.purchasePrice * randomFactor;
      const currentValue = stock.quantity * currentPrice;
      const purchaseValue = stock.quantity * stock.purchasePrice;
      const gain = currentValue - purchaseValue;
      const gainPercentage = (gain / purchaseValue) * 100;
      
      return {
        ...stock,
        currentPrice,
        currentValue,
        gain,
        gainPercentage
      } as EnrichedStock;
    });
    
    // Calculate portfolio totals
    const totalCurrentValue = portfolioData.reduce((sum: number, stock: EnrichedStock) => sum + stock.currentValue, 0);
    const totalPurchaseValue = portfolioData.reduce((sum: number, stock: EnrichedStock) => sum + (stock.quantity * stock.purchasePrice), 0);
    const totalGain = totalCurrentValue - totalPurchaseValue;
    const totalGainPercentage = totalPurchaseValue > 0 ? (totalGain / totalPurchaseValue) * 100 : 0;
    
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