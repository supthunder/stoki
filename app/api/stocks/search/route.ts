import { NextResponse } from "next/server";
import yahooFinance from "yahoo-finance2";

// Define types for the Yahoo Finance search results
type YahooSearchResultQuote = {
  exchange?: string;
  shortname?: string;
  longname?: string;
  quoteType?: string;
  symbol?: string;
  index?: string;
  score?: number;
  typeDisp?: string;
  isYahooFinance?: boolean;
  name?: string;
};

export async function GET(request: Request) {
  try {
    // Get the search query from the URL
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    
    if (!query || query.length < 1) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }
    
    // Use the search module from Yahoo Finance
    const result = await yahooFinance.search(query);
    
    // Filter out results that aren't quotes (stocks, ETFs)
    const stockResults = result.quotes
      .filter((item: YahooSearchResultQuote) => 
        item.quoteType === 'EQUITY' || item.quoteType === 'ETF')
      .map((item: YahooSearchResultQuote) => ({
        symbol: item.symbol || '',
        name: item.shortname || item.longname || item.name || item.symbol || '',
        exchange: item.exchange || '',
        quoteType: item.quoteType || item.typeDisp || ''
      }));
    
    // If no results, return a 404
    if (stockResults.length === 0) {
      return NextResponse.json(
        { error: 'No stocks found matching your query' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(stockResults);
  } catch (error) {
    console.error('Error searching for stocks:', error);
    return NextResponse.json(
      { error: 'Failed to search for stocks' },
      { status: 500 }
    );
  }
} 