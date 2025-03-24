import { NextRequest, NextResponse } from 'next/server';
import { getCryptoHistoricalPrice } from '@/lib/crypto-api';
import { cacheData, getCachedData } from '@/lib/cache';

export async function GET(req: NextRequest) {
  try {
    // Get ID and date from query parameters
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const dateStr = url.searchParams.get('date');

    if (!id) {
      return NextResponse.json(
        { error: "Missing cryptocurrency ID" },
        { status: 400 }
      );
    }

    if (!dateStr) {
      return NextResponse.json(
        { error: "Missing date parameter" },
        { status: 400 }
      );
    }

    let date;
    try {
      // Try to parse the date
      date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        throw new Error('Invalid date');
      }
      
      // Check if date is in the future
      if (date > new Date()) {
        return NextResponse.json(
          { error: "Cannot request prices for future dates" },
          { status: 400 }
        );
      }
    } catch (e) {
      return NextResponse.json(
        { error: "Invalid date format" },
        { status: 400 }
      );
    }

    // Try to get from cache first with a specific cache key
    const timestamp = Math.floor(date.getTime() / 1000);
    const cacheKey = `crypto:historical:${id.toLowerCase()}:${timestamp}`;
    let price = null;
    
    try {
      price = await getCachedData<number>(cacheKey);
      if (price !== null) {
        console.log(`Using cached historical price for ${id} at ${date.toISOString()}: ${price}`);
        return NextResponse.json({ price });
      }
    } catch (cacheError) {
      console.warn('Cache retrieval error:', cacheError);
    }

    // If not in cache or cache error, fetch from API
    console.log(`Fetching historical price for ${id} at ${date.toISOString()} from CoinGecko API`);
    price = await getCryptoHistoricalPrice(id, date);

    if (price === null) {
      return NextResponse.json(
        { error: "Failed to fetch historical cryptocurrency price" },
        { status: 500 }
      );
    }

    // Cache the price for longer since historical data doesn't change
    try {
      await cacheData(cacheKey, price, 86400); // Cache for 1 day
    } catch (cacheError) {
      console.warn('Cache storage error:', cacheError);
    }

    // Return the price
    return NextResponse.json({ price });
  } catch (error) {
    console.error('Error fetching historical cryptocurrency price:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 