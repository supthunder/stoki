import { NextRequest, NextResponse } from 'next/server';
import { getCryptoPrice } from '@/lib/crypto-api';
import { cacheData, getCachedData } from '@/lib/cache';

export async function GET(req: NextRequest) {
  try {
    // Get IDs from query parameter
    const url = new URL(req.url);
    const ids = url.searchParams.get('ids');

    if (!ids) {
      return NextResponse.json(
        { error: "Missing cryptocurrency IDs" },
        { status: 400 }
      );
    }

    // Split the comma-separated list
    const idList = ids.split(',').map(id => id.trim());
    
    if (idList.length === 0) {
      return NextResponse.json(
        { error: "No valid cryptocurrency IDs provided" },
        { status: 400 }
      );
    }

    // Limit the number of IDs to process
    const MAX_IDS = 50;
    if (idList.length > MAX_IDS) {
      console.warn(`Too many IDs requested (${idList.length}), limiting to ${MAX_IDS}`);
      idList.splice(MAX_IDS);
    }

    // Create a map to store the results
    const prices: Record<string, number | null> = {};
    
    // Try to get from cache first
    const cachedPrices: Record<string, number | null> = {};
    let allCached = true;
    
    await Promise.all(idList.map(async (id) => {
      const cacheKey = `crypto:price:${id.toLowerCase()}`;
      try {
        const cachedPrice = await getCachedData<number>(cacheKey);
        if (cachedPrice !== null) {
          cachedPrices[id] = cachedPrice;
        } else {
          allCached = false;
        }
      } catch (cacheError) {
        console.warn(`Cache error for ${id}:`, cacheError);
        allCached = false;
      }
    }));
    
    // If all prices were found in cache, return early
    if (allCached) {
      console.log(`Returning all cached prices for ${idList.length} cryptocurrencies`);
      return NextResponse.json({ prices: cachedPrices });
    }
    
    // For IDs not in cache, make a batch request to CoinGecko
    const missingIds = idList.filter(id => !(id in cachedPrices));
    console.log(`Fetching prices for ${missingIds.length} cryptocurrencies from CoinGecko`);
    
    // Adapt for CoinGecko API limitations (max 100 ids per request)
    const BATCH_SIZE = 100;
    
    for (let i = 0; i < missingIds.length; i += BATCH_SIZE) {
      const batchIds = missingIds.slice(i, i + BATCH_SIZE);
      
      // Prepare the API URL
      const apiUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${batchIds.join(',')}&vs_currencies=usd`;
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        // Handle rate limiting
        if (response.status === 429) {
          console.warn('CoinGecko API rate limit reached, returning cached prices only');
          break;
        }
        
        console.error(`CoinGecko API error: ${response.status} ${response.statusText}`);
        continue;
      }
      
      const data = await response.json();
      
      // Process results and update cache
      for (const id of batchIds) {
        if (data[id] && data[id].usd) {
          const price = data[id].usd;
          prices[id] = price;
          
          // Cache for 5 minutes
          try {
            const cacheKey = `crypto:price:${id.toLowerCase()}`;
            await cacheData(cacheKey, price, 300);
          } catch (cacheError) {
            console.warn(`Cache error for ${id}:`, cacheError);
          }
        } else {
          prices[id] = null;
        }
      }
    }
    
    // Combine cached and fresh prices
    const result = { ...cachedPrices, ...prices };
    
    return NextResponse.json({ prices: result });
  } catch (error) {
    console.error('Error fetching cryptocurrency prices:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 