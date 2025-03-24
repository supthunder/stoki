/**
 * Simple cache implementation that works on both client and server sides
 */

// Server-side memory cache when Redis is not available
const serverMemoryCache: Record<string, { value: any; expiry: number }> = {};
// Client-side memory cache
const clientMemoryCache: Record<string, { value: any; expiry: number }> = {};

/**
 * Get data from cache
 */
export async function getCachedData<T>(key: string): Promise<T | null> {
  // For client-side, use client memory cache
  if (typeof window !== 'undefined') {
    const cached = clientMemoryCache[key];
    if (cached && cached.expiry > Date.now()) {
      return cached.value as T;
    }
    return null;
  }
  
  // For server-side, use server memory cache
  const cached = serverMemoryCache[key];
  if (cached && cached.expiry > Date.now()) {
    return cached.value as T;
  }
  
  return null;
}

/**
 * Cache data with expiry time in seconds
 */
export async function cacheData<T>(key: string, value: T, expirySeconds: number): Promise<void> {
  const cacheEntry = {
    value,
    expiry: Date.now() + (expirySeconds * 1000)
  };
  
  // For client-side, use client memory cache
  if (typeof window !== 'undefined') {
    clientMemoryCache[key] = cacheEntry;
    return;
  }
  
  // For server-side, use server memory cache
  serverMemoryCache[key] = cacheEntry;
  return;
}

/**
 * Remove cached data
 */
export async function removeCachedData(key: string): Promise<boolean> {
  // For client-side, remove from client memory cache
  if (typeof window !== 'undefined') {
    if (key in clientMemoryCache) {
      delete clientMemoryCache[key];
      return true;
    }
    return false;
  }
  
  // For server-side, remove from server memory cache
  if (key in serverMemoryCache) {
    delete serverMemoryCache[key];
    return true;
  }
  
  return false;
}

/**
 * Check if data exists in cache
 */
export async function existsInCache(key: string): Promise<boolean> {
  if (typeof window !== 'undefined') {
    const cached = clientMemoryCache[key];
    return !!cached && cached.expiry > Date.now();
  }
  
  const cached = serverMemoryCache[key];
  return !!cached && cached.expiry > Date.now();
}

/**
 * Clear cache with pattern
 */
export async function clearCacheWithPattern(pattern: string): Promise<number> {
  const regex = new RegExp(pattern.replace(/\*/g, '.*'));
  let count = 0;
  
  // For client-side, remove matching keys from client memory cache
  if (typeof window !== 'undefined') {
    for (const key in clientMemoryCache) {
      if (regex.test(key)) {
        delete clientMemoryCache[key];
        count++;
      }
    }
    return count;
  }
  
  // For server-side, remove matching keys from server memory cache
  for (const key in serverMemoryCache) {
    if (regex.test(key)) {
      delete serverMemoryCache[key];
      count++;
    }
  }
  
  return count;
}

/**
 * Store historical price data
 */
export async function cacheHistoricalStockPrice(symbol: string, date: string, price: number) {
  const key = `stock:${symbol}:price:${date}`;
  return cacheData(key, { price }, 60 * 60 * 24 * 30); // 30 days expiration
}

/**
 * Get historical price data
 */
export async function getHistoricalStockPrice(symbol: string, date: string): Promise<number | null> {
  const key = `stock:${symbol}:price:${date}`;
  const data = await getCachedData<{ price: number }>(key);
  return data ? data.price : null;
}

/**
 * Store user portfolio value history
 */
export async function cachePortfolioValue(userId: number, date: string, value: number) {
  const key = `user:${userId}:portfolio:${date}`;
  return cacheData(key, { value }, 60 * 60 * 24 * 90); // 90 days expiration
}

/**
 * Get user portfolio value history for the last N days
 */
export async function getPortfolioHistory(userId: number, days: number = 7): Promise<{date: string, value: number}[]> {
  const pattern = `user:${userId}:portfolio:`;
  
  // Find all matching keys
  const entries: {date: string, value: number}[] = [];
  
  if (typeof window !== 'undefined') {
    // Client-side
    for (const key in clientMemoryCache) {
      if (key.startsWith(pattern) && clientMemoryCache[key].expiry > Date.now()) {
        const date = key.split(':')[3]; // Extract date from key
        entries.push({
          date,
          value: clientMemoryCache[key].value.value
        });
      }
    }
  } else {
    // Server-side
    for (const key in serverMemoryCache) {
      if (key.startsWith(pattern) && serverMemoryCache[key].expiry > Date.now()) {
        const date = key.split(':')[3]; // Extract date from key
        entries.push({
          date,
          value: serverMemoryCache[key].value.value
        });
      }
    }
  }
  
  // Sort by date (descending) and limit to requested days
  return entries
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, days);
}

/**
 * Cache and retrieve leaderboard data with browser storage
 */

// Maximum age for cached leaderboard data (5 minutes)
const LEADERBOARD_CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Get leaderboard data from browser cache
 */
export function getCachedLeaderboardData(timeFrame: string): any | null {
  if (typeof window === 'undefined') {
    return null; // Not available server-side
  }
  
  try {
    const cachedData = localStorage.getItem(`leaderboard-${timeFrame}`);
    const cachedTimestamp = localStorage.getItem(`leaderboard-${timeFrame}-timestamp`);
    
    if (!cachedData || !cachedTimestamp) {
      return null;
    }
    
    const cacheAge = Date.now() - parseInt(cachedTimestamp);
    
    // Return cached data if it's fresh (less than TTL)
    if (cacheAge < LEADERBOARD_CACHE_TTL) {
      console.log(`Using cached leaderboard data for ${timeFrame} (${Math.round(cacheAge / 1000)}s old)`);
      return JSON.parse(cachedData);
    }
    
    // Cache is stale
    return null;
  } catch (error) {
    console.warn('Error reading from leaderboard cache:', error);
    return null;
  }
}

/**
 * Cache leaderboard data to browser storage
 */
export function cacheLeaderboardData(timeFrame: string, data: any): void {
  if (typeof window === 'undefined') {
    return; // Not available server-side
  }
  
  try {
    localStorage.setItem(`leaderboard-${timeFrame}`, JSON.stringify(data));
    localStorage.setItem(`leaderboard-${timeFrame}-timestamp`, Date.now().toString());
    console.log(`Cached leaderboard data for ${timeFrame}`);
  } catch (error) {
    console.warn('Error caching leaderboard data:', error);
  }
}

/**
 * Clear all leaderboard caches or a specific timeframe
 */
export function clearLeaderboardCache(timeFrame?: string): void {
  if (typeof window === 'undefined') {
    return; // Not available server-side
  }
  
  try {
    if (timeFrame) {
      // Clear specific timeframe
      localStorage.removeItem(`leaderboard-${timeFrame}`);
      localStorage.removeItem(`leaderboard-${timeFrame}-timestamp`);
      console.log(`Cleared leaderboard cache for ${timeFrame}`);
    } else {
      // Clear all leaderboard caches
      const timeFrames = ['total', 'daily', 'weekly', 'worth'];
      timeFrames.forEach(tf => {
        localStorage.removeItem(`leaderboard-${tf}`);
        localStorage.removeItem(`leaderboard-${tf}-timestamp`);
      });
      console.log('Cleared all leaderboard caches');
    }
  } catch (error) {
    console.warn('Error clearing leaderboard cache:', error);
  }
} 