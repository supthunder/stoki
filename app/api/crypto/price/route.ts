import { NextRequest, NextResponse } from 'next/server';
import { getCryptoPrice } from '@/lib/crypto-api';
import { cacheData, getCachedData } from '@/lib/cache';

export async function GET(req: NextRequest) {
  try {
    // Get ID from query parameter
    const url = new URL(req.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: "Missing cryptocurrency ID" },
        { status: 400 }
      );
    }

    // Try to get from cache first with a specific cache key
    const cacheKey = `crypto:price:${id.toLowerCase()}`;
    let price = null;
    
    try {
      price = await getCachedData<number>(cacheKey);
      if (price !== null) {
        console.log(`Using cached price for ${id}: ${price}`);
        return NextResponse.json({ price });
      }
    } catch (cacheError) {
      console.warn('Cache retrieval error:', cacheError);
    }

    // If not in cache or cache error, fetch from API
    console.log(`Fetching price for ${id} from CoinGecko API`);
    price = await getCryptoPrice(id);

    if (price === null) {
      return NextResponse.json(
        { error: "Failed to fetch cryptocurrency price" },
        { status: 500 }
      );
    }

    // Cache the price for 5 minutes
    try {
      await cacheData(cacheKey, price, 300);
    } catch (cacheError) {
      console.warn('Cache storage error:', cacheError);
    }

    // Return the price
    return NextResponse.json({ price });
  } catch (error) {
    console.error('Error fetching cryptocurrency price:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 