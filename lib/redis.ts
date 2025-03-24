/**
 * Redis client implementation for both server and client environments
 */

import { createClient } from 'redis';

// Singleton Redis client
let redisClient: ReturnType<typeof createClient> | null = null;

// Server-side memory cache fallback when Redis is not available
const serverMemoryCache: Record<string, { value: any; expiry: number }> = {};
// Client-side memory cache
const clientMemoryCache: Record<string, { value: any; expiry: number }> = {};

export async function getRedisClient() {
  // For client-side, return null
  if (typeof window !== 'undefined') {
    console.log('Using browser cache (Redis not available client-side)');
    return null;
  }

  // If we already have a client, return it
  if (redisClient) {
    return redisClient;
  }

  // Try to connect to Redis
  try {
    const url = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL;
    
    if (!url) {
      console.warn('No Redis URL found in environment variables, using memory cache');
      return null;
    }
    
    redisClient = createClient({ url });
    
    redisClient.on('error', (err) => {
      console.error('Redis connection error:', err);
      redisClient = null;
    });
    
    await redisClient.connect();
    console.log('Redis client connected successfully');
    return redisClient;
  } catch (error) {
    console.warn('Failed to initialize Redis client, using memory cache:', error);
    redisClient = null;
    return null;
  }
}

// Cache data with expiration (default 1 hour)
export async function cacheData(key: string, data: any, expirationSeconds = 3600) {
  // For client-side, use client memory cache
  if (typeof window !== 'undefined') {
    clientMemoryCache[key] = {
      value: data,
      expiry: Date.now() + (expirationSeconds * 1000)
    };
    return true;
  }

  // Try Redis first
  const client = await getRedisClient();
  if (client) {
    try {
      await client.set(key, JSON.stringify(data), { EX: expirationSeconds });
      return true;
    } catch (error) {
      console.error(`Error caching data for key ${key} in Redis:`, error);
      // Fall back to memory cache on error
    }
  }
  
  // Fall back to server-side memory cache
  serverMemoryCache[key] = {
    value: data,
    expiry: Date.now() + (expirationSeconds * 1000)
  };
  return true;
}

// Get cached data
export async function getCachedData<T>(key: string): Promise<T | null> {
  // For client-side, use client memory cache
  if (typeof window !== 'undefined') {
    const cached = clientMemoryCache[key];
    if (cached && cached.expiry > Date.now()) {
      return cached.value as T;
    }
    return null;
  }
  
  // Try Redis first
  const client = await getRedisClient();
  if (client) {
    try {
      const data = await client.get(key);
      if (data) {
        return JSON.parse(data) as T;
      }
    } catch (error) {
      console.error(`Error retrieving cached data for key ${key} from Redis:`, error);
      // Fall back to memory cache on error
    }
  }
  
  // Fall back to server-side memory cache
  const cached = serverMemoryCache[key];
  if (cached && cached.expiry > Date.now()) {
    return cached.value as T;
  }
  
  return null;
}

// Check if data exists in cache
export async function existsInCache(key: string): Promise<boolean> {
  // For client-side, check client memory cache
  if (typeof window !== 'undefined') {
    const cached = clientMemoryCache[key];
    return !!cached && cached.expiry > Date.now();
  }
  
  // Try Redis first
  const client = await getRedisClient();
  if (client) {
    try {
      return await client.exists(key) === 1;
    } catch (error) {
      console.error(`Error checking existence for key ${key} in Redis:`, error);
      // Fall back to memory cache on error
    }
  }
  
  // Fall back to server-side memory cache
  const cached = serverMemoryCache[key];
  return !!cached && cached.expiry > Date.now();
}

// Clear cache with pattern
export async function clearCacheWithPattern(pattern: string): Promise<number> {
  // For client-side, remove matching keys from client memory cache
  if (typeof window !== 'undefined') {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    let count = 0;
    
    for (const key in clientMemoryCache) {
      if (regex.test(key)) {
        delete clientMemoryCache[key];
        count++;
      }
    }
    return count;
  }
  
  // Try Redis first
  const client = await getRedisClient();
  if (client) {
    try {
      const keys = await client.keys(pattern);
      if (keys.length > 0) {
        await client.del(keys);
        return keys.length;
      }
      return 0;
    } catch (error) {
      console.error(`Error clearing cache with pattern ${pattern} from Redis:`, error);
      // Fall back to memory cache on error
    }
  }
  
  // Fall back to server-side memory cache
  const regex = new RegExp(pattern.replace(/\*/g, '.*'));
  let count = 0;
  
  for (const key in serverMemoryCache) {
    if (regex.test(key)) {
      delete serverMemoryCache[key];
      count++;
    }
  }
  
  return count;
}

/**
 * Specialized functions for leaderboard caching
 */

// Cache leaderboard data - server-side function to update cache from scheduled jobs
export async function cacheLeaderboardData(timeFrame: string, data: any, expirationSeconds = 600): Promise<boolean> {
  const key = `leaderboard:${timeFrame}`;
  
  // Set timestamp for when the data was last updated
  const dataWithTimestamp = {
    data,
    updatedAt: new Date().toISOString()
  };
  
  return cacheData(key, dataWithTimestamp, expirationSeconds);
}

// Get cached leaderboard data
export async function getCachedLeaderboardData(timeFrame: string): Promise<any | null> {
  const key = `leaderboard:${timeFrame}`;
  const result = await getCachedData<{data: any, updatedAt: string}>(key);
  
  if (result) {
    console.log(`Using cached leaderboard data for ${timeFrame} (updated at ${result.updatedAt})`);
    return result.data;
  }
  
  return null;
}

// Clear leaderboard cache for a specific timeframe or all timeframes
export async function clearLeaderboardCache(timeFrame?: string): Promise<number> {
  if (timeFrame) {
    const key = `leaderboard:${timeFrame}`;
    if (await existsInCache(key)) {
      await cacheData(key, null, 0); // Expiry of 0 removes the key
      console.log(`Cleared leaderboard cache for ${timeFrame}`);
      return 1;
    }
    return 0;
  } else {
    // Clear all leaderboard caches
    return clearCacheWithPattern('leaderboard:*');
  }
}

// Get the time when the leaderboard data was last updated
export async function getLeaderboardLastUpdated(timeFrame: string): Promise<string | null> {
  const key = `leaderboard:${timeFrame}`;
  const result = await getCachedData<{data: any, updatedAt: string}>(key);
  
  if (result && result.updatedAt) {
    return result.updatedAt;
  }
  
  return null;
}

/**
 * Stock price caching functions
 */

// Store historical price data
export async function cacheHistoricalStockPrice(symbol: string, date: string, price: number) {
  const key = `stock:${symbol}:price:${date}`;
  return cacheData(key, { price }, 60 * 60 * 24 * 30); // 30 days expiration
}

// Get historical price data
export async function getHistoricalStockPrice(symbol: string, date: string): Promise<number | null> {
  const key = `stock:${symbol}:price:${date}`;
  const data = await getCachedData<{ price: number }>(key);
  return data ? data.price : null;
}

/**
 * Portfolio history caching functions
 */

// Store user portfolio value history
export async function cachePortfolioValue(userId: number, date: string, value: number) {
  const key = `user:${userId}:portfolio:${date}`;
  return cacheData(key, { value }, 60 * 60 * 24 * 90); // 90 days expiration
}

// Get user portfolio value history for the last N days
export async function getPortfolioHistory(userId: number, days: number = 7): Promise<{date: string, value: number}[]> {
  // Try Redis first
  const client = await getRedisClient();
  if (client) {
    try {
      // Get all keys matching the pattern
      const keys = await client.keys(`user:${userId}:portfolio:*`);
      
      if (keys.length === 0) return [];
      
      // Get values for all keys
      const values = await Promise.all(
        keys.map(async (key) => {
          const data = await client.get(key);
          const date = key.split(':')[3]; // Extract date from key
          return { key, date, data };
        })
      );
      
      // Parse values, sort by date (descending) and limit to requested days
      return values
        .filter((item) => item.data !== null)
        .map((item) => ({ 
          date: item.date, 
          value: JSON.parse(item.data!).value 
        }))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, days);
    } catch (error) {
      console.error(`Error retrieving portfolio history for userId ${userId} from Redis:`, error);
      // Fall back to memory cache
    }
  }
  
  // Fall back to memory cache implementation
  const pattern = `user:${userId}:portfolio:`;
  const entries: {date: string, value: number}[] = [];
  
  // Check server memory cache
  for (const key in serverMemoryCache) {
    if (key.startsWith(pattern) && serverMemoryCache[key].expiry > Date.now()) {
      const date = key.split(':')[3]; // Extract date from key
      entries.push({
        date,
        value: serverMemoryCache[key].value.value
      });
    }
  }
  
  // Sort by date (descending) and limit to requested days
  return entries
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, days);
} 