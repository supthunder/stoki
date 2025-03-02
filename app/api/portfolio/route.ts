import { NextResponse } from "next/server";
import { createSqlClient } from "@/lib/db";
import yahooFinance from "yahoo-finance2";

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
    
    // Fetch real-time quotes for all symbols in a single batch request
    const quotesResponse = await yahooFinance.quote(symbols);
    
    // Create a map of symbols to their current prices
    const symbolPrices = new Map<string, number>();
    
    // Type-safe processing of Yahoo Finance response
    try {
      // Process a single quote response
      if (!Array.isArray(quotesResponse)) {
        const quote = quotesResponse as { symbol: string; regularMarketPrice: number };
        if (quote.symbol && quote.regularMarketPrice) {
          symbolPrices.set(quote.symbol, quote.regularMarketPrice);
        }
      } 
      // Process multiple quotes
      else {
        for (const quote of quotesResponse) {
          const typedQuote = quote as unknown as { symbol: string; regularMarketPrice: number };
          if (typedQuote.symbol && typedQuote.regularMarketPrice) {
            symbolPrices.set(typedQuote.symbol, typedQuote.regularMarketPrice);
          }
        }
      }
    } catch (e) {
      console.error("Error processing Yahoo Finance quotes:", e);
      // Fallback to default prices if there's an error
    }
    
    // Process the results to calculate current values and gains
    const portfolioData = result.map((stock: any) => {
      const currentPrice = symbolPrices.get(stock.symbol) || stock.purchasePrice;
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