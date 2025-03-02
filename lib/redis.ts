import { createClient } from 'redis';

// Redis client singleton
let redisClient: ReturnType<typeof createClient> | null = null;

// Initialize Redis client
export async function getRedisClient() {
  if (!redisClient) {
    try {
      const url = process.env.REDIS_URL;
      
      if (!url) {
        console.warn('REDIS_URL not found in environment variables, Redis caching disabled');
        return null;
      }
      
      redisClient = createClient({ url });
      
      redisClient.on('error', (err) => {
        console.error('Redis connection error:', err);
        redisClient = null;
      });
      
      await redisClient.connect();
      console.log('Redis client connected successfully');
    } catch (error) {
      console.error('Failed to initialize Redis client:', error);
      redisClient = null;
    }
  }
  
  return redisClient;
}

// Cache data with expiration (default 1 hour)
export async function cacheData(key: string, data: any, expirationSeconds = 3600) {
  const client = await getRedisClient();
  if (!client) return false;
  
  try {
    await client.set(key, JSON.stringify(data), { EX: expirationSeconds });
    return true;
  } catch (error) {
    console.error(`Error caching data for key ${key}:`, error);
    return false;
  }
}

// Get cached data
export async function getCachedData<T>(key: string): Promise<T | null> {
  const client = await getRedisClient();
  if (!client) return null;
  
  try {
    const data = await client.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch (error) {
    console.error(`Error retrieving cached data for key ${key}:`, error);
    return null;
  }
}

// Check if data exists in cache
export async function existsInCache(key: string): Promise<boolean> {
  const client = await getRedisClient();
  if (!client) return false;
  
  try {
    return await client.exists(key) === 1;
  } catch (error) {
    console.error(`Error checking existence for key ${key}:`, error);
    return false;
  }
}

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

// Store user portfolio value history
export async function cachePortfolioValue(userId: number, date: string, value: number) {
  const key = `user:${userId}:portfolio:${date}`;
  return cacheData(key, { value }, 60 * 60 * 24 * 90); // 90 days expiration
}

// Get user portfolio value history for the last N days
export async function getPortfolioHistory(userId: number, days: number = 7): Promise<{date: string, value: number}[]> {
  const client = await getRedisClient();
  if (!client) return [];
  
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
    console.error(`Error retrieving portfolio history for userId ${userId}:`, error);
    return [];
  }
} 