import { NextResponse } from "next/server";

// Mock stock data for demo purposes
const mockStocks = [
  { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', exchange: 'NASDAQ' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', exchange: 'NASDAQ' },
  { symbol: 'META', name: 'Meta Platforms Inc.', exchange: 'NASDAQ' },
  { symbol: 'TSLA', name: 'Tesla Inc.', exchange: 'NASDAQ' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', exchange: 'NASDAQ' },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.', exchange: 'NYSE' },
  { symbol: 'V', name: 'Visa Inc.', exchange: 'NYSE' },
  { symbol: 'JNJ', name: 'Johnson & Johnson', exchange: 'NYSE' },
  { symbol: 'WMT', name: 'Walmart Inc.', exchange: 'NYSE' },
  { symbol: 'PG', name: 'Procter & Gamble Co.', exchange: 'NYSE' },
  { symbol: 'MA', name: 'Mastercard Inc.', exchange: 'NYSE' },
  { symbol: 'UNH', name: 'UnitedHealth Group Inc.', exchange: 'NYSE' },
  { symbol: 'HD', name: 'Home Depot Inc.', exchange: 'NYSE' },
  { symbol: 'BAC', name: 'Bank of America Corp.', exchange: 'NYSE' },
  { symbol: 'XOM', name: 'Exxon Mobil Corporation', exchange: 'NYSE' },
  { symbol: 'DIS', name: 'Walt Disney Co.', exchange: 'NYSE' },
  { symbol: 'NFLX', name: 'Netflix Inc.', exchange: 'NASDAQ' },
  { symbol: 'ADBE', name: 'Adobe Inc.', exchange: 'NASDAQ' },
];

export async function GET(request: Request) {
  try {
    // Get the search query from the URL
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    
    if (!query) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }
    
    // In a real app, you would call an external API like Alpha Vantage, Yahoo Finance, etc.
    // For this demo, we'll filter our mock data
    const results = mockStocks.filter(stock => 
      stock.symbol.toLowerCase().includes(query.toLowerCase()) || 
      stock.name.toLowerCase().includes(query.toLowerCase())
    );
    
    // Simulate a slight delay for realism
    await new Promise(resolve => setTimeout(resolve, 300));
    
    return NextResponse.json(results);
  } catch (error) {
    console.error('Error searching for stocks:', error);
    return NextResponse.json(
      { error: 'Failed to search for stocks' },
      { status: 500 }
    );
  }
} 