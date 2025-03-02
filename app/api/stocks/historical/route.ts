import { NextResponse } from "next/server";
import yahooFinance from "yahoo-finance2";

export async function GET(request: Request) {
  try {
    // Get the parameters from the URL
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const period1 = searchParams.get('period1') || '2023-01-01';
    const period2 = searchParams.get('period2') || new Date().toISOString().split('T')[0];
    const interval = searchParams.get('interval') || '1d';
    
    if (!symbol) {
      return NextResponse.json(
        { error: 'Stock symbol is required' },
        { status: 400 }
      );
    }
    
    // Validate interval (1d, 1wk, 1mo are common values)
    const validIntervals = ['1d', '1wk', '1mo'];
    if (!validIntervals.includes(interval)) {
      return NextResponse.json(
        { error: 'Invalid interval. Use 1d, 1wk, or 1mo' },
        { status: 400 }
      );
    }
    
    // Fetch historical data from Yahoo Finance
    const queryOptions = {
      period1: period1,
      period2: period2,
      interval: interval as '1d' | '1wk' | '1mo'
    };
    
    const result = await yahooFinance.historical(symbol.toUpperCase(), queryOptions);
    
    // Format the response to a more convenient structure
    const formattedData = result.map(item => ({
      date: item.date.toISOString().split('T')[0],
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      volume: item.volume,
      adjClose: item.adjClose
    }));
    
    return NextResponse.json({
      symbol: symbol.toUpperCase(),
      period1,
      period2,
      interval,
      data: formattedData
    });
  } catch (error) {
    console.error('Error getting historical stock data:', error);
    
    // Check if it's a "symbol not found" error
    if (error instanceof Error && error.message.includes("Not Found")) {
      return NextResponse.json(
        { error: 'Stock symbol not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to get historical stock data' },
      { status: 500 }
    );
  }
} 