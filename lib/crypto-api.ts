import { getCachedData, cacheData } from './cache';

const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY || '';
const COINGECKO_API_BASE = 'https://api.coingecko.com/api/v3';
const COINGECKO_PRO_API_BASE = 'https://pro-api.coingecko.com/api/v3';

// Mapping for crypto symbols to CoinGecko IDs
const CRYPTO_ID_MAP: Record<string, string> = {
  // Common cryptocurrencies
  'btc': 'bitcoin',
  'eth': 'ethereum',
  'sol': 'solana',
  'doge': 'dogecoin',
  'ada': 'cardano',
  'dot': 'polkadot',
  'xrp': 'ripple',
  'ltc': 'litecoin',
  'avax': 'avalanche-2',
  'link': 'chainlink',
  'matic': 'matic-network',
  'uni': 'uniswap',
  'shib': 'shiba-inu',
  'atom': 'cosmos',
  'xlm': 'stellar',
  'algo': 'algorand',
  'bnb': 'binancecoin',
};

// Get CoinGecko ID from symbol
function getCoinGeckoId(symbol: string): string {
  // Remove @ prefix if present
  const cleanSymbol = symbol.startsWith('@') ? symbol.substring(1).toLowerCase() : symbol.toLowerCase();
  
  // Check if we have a direct mapping
  if (CRYPTO_ID_MAP[cleanSymbol]) {
    return CRYPTO_ID_MAP[cleanSymbol];
  }
  
  // Otherwise, use the symbol as the ID (may not work for all cryptos)
  return cleanSymbol;
}

// Get nice display name for cryptocurrency
export function getCryptoDisplayName(symbol: string): string {
  const cleanSymbol = symbol.startsWith('@') ? symbol.substring(1).toLowerCase() : symbol.toLowerCase();
  
  // Map of nice display names
  const displayNames: Record<string, string> = {
    'btc': 'Bitcoin',
    'eth': 'Ethereum',
    'sol': 'Solana',
    'doge': 'Dogecoin',
    'ada': 'Cardano',
    'dot': 'Polkadot',
    'xrp': 'XRP',
    'ltc': 'Litecoin',
    'avax': 'Avalanche',
    'link': 'Chainlink',
    'matic': 'Polygon',
    'uni': 'Uniswap',
    'shib': 'Shiba Inu',
    'atom': 'Cosmos',
    'xlm': 'Stellar',
    'algo': 'Algorand',
    'bnb': 'Binance Coin',
  };
  
  return displayNames[cleanSymbol] || cleanSymbol.toUpperCase();
}

// Get current price for a cryptocurrency
export async function getCryptoPrice(cryptoId: string): Promise<number | null> {
  try {
    // Get CoinGecko ID
    const id = getCoinGeckoId(cryptoId);
    
    // Try to get from cache first
    const cacheKey = `crypto:price:${id}`;
    let cachedPrice = null;
    try {
      cachedPrice = await getCachedData<number>(cacheKey);
    } catch (error) {
      console.warn('Cache error, skipping cache:', error);
    }
    
    if (cachedPrice !== null) {
      console.log(`Using cached price for ${id}: ${cachedPrice}`);
      return cachedPrice;
    }
    
    // If we're on client-side, try to fetch from our API endpoint instead of directly from CoinGecko
    if (typeof window !== 'undefined') {
      try {
        const response = await fetch(`/api/crypto/price?id=${id}`);
        if (response.ok) {
          const data = await response.json();
          if (data.price) {
            // No need to cache as the API will have already cached it
            return data.price;
          }
        }
      } catch (apiError) {
        console.warn('Error fetching from API, falling back to direct CoinGecko call:', apiError);
      }
    }
    
    // Only make a direct API call to CoinGecko if we're on the server side or the API call failed
    const url = `${COINGECKO_API_BASE}/simple/price?ids=${id}&vs_currencies=usd`;
    
    console.log(`Fetching price for ${id} from CoinGecko API`);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      // Handle rate limiting
      if (response.status === 429) {
        console.warn('CoinGecko API rate limit reached, waiting for next available slot');
        // Return latest cached price, or 0 if none exists
        return 0;
      }
      
      throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    if (data[id] && data[id].usd) {
      const price = data[id].usd;
      
      // Cache for 5 minutes
      try {
        await cacheData(cacheKey, price, 300);
      } catch (error) {
        console.warn('Failed to cache price data:', error);
      }
      
      return price;
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching crypto price for ${cryptoId}:`, error);
    return null;
  }
}

// Get historical price for a cryptocurrency
export async function getCryptoHistoricalPrice(
  cryptoId: string, 
  date: Date
): Promise<number | null> {
  try {
    // Check if date is in the future or invalid
    const now = new Date();
    if (isNaN(date.getTime())) {
      console.warn(`Invalid date provided for ${cryptoId}: ${date}`);
      return null;
    }
    
    if (date > now) {
      console.warn(`Cannot get historical price for ${cryptoId} as date ${date.toISOString()} is in the future`);
      // Return current price for future dates
      return await getCryptoPrice(cryptoId);
    }
    
    // Get CoinGecko ID
    const id = getCoinGeckoId(cryptoId);
    
    // Format date to UNIX timestamp (seconds)
    const timestamp = Math.floor(date.getTime() / 1000);
    
    // Try to get from cache first
    const cacheKey = `crypto:historical:${id}:${timestamp}`;
    let cachedPrice = null;
    try {
      cachedPrice = await getCachedData<number>(cacheKey);
    } catch (error) {
      console.warn('Cache error, skipping cache:', error);
    }
    
    if (cachedPrice !== null) {
      console.log(`Using cached historical price for ${id} at ${date.toISOString()}: ${cachedPrice}`);
      return cachedPrice;
    }
    
    // If we're on client-side, try to fetch from our API endpoint instead of directly from CoinGecko
    if (typeof window !== 'undefined') {
      try {
        const formattedDate = date.toISOString();
        const response = await fetch(`/api/crypto/history?id=${id}&date=${formattedDate}`);
        if (response.ok) {
          const data = await response.json();
          if (data.price) {
            // No need to cache as the API will have already cached it
            return data.price;
          }
        }
      } catch (apiError) {
        console.warn('Error fetching from API, falling back to direct CoinGecko call:', apiError);
      }
    }
    
    // Make sure the date isn't too far in the past (CoinGecko has limits)
    const oldestAllowedDate = new Date();
    oldestAllowedDate.setFullYear(oldestAllowedDate.getFullYear() - 5); // 5 years ago
    
    if (date < oldestAllowedDate) {
      console.warn(`Date ${date.toISOString()} for ${id} is too far in the past, using oldest available data`);
      date = oldestAllowedDate;
    }
    
    // Format date for CoinGecko (dd-mm-yyyy)
    const formattedDate = `${date.getDate().toString().padStart(2, '0')}-${
      (date.getMonth() + 1).toString().padStart(2, '0')}-${
      date.getFullYear()}`;
    
    // Only make a direct API call to CoinGecko if we're on the server side or the API call failed
    const url = `${COINGECKO_API_BASE}/coins/${id}/history?date=${formattedDate}`;
    
    console.log(`Fetching historical price for ${id} at ${formattedDate} from CoinGecko API`);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      // Handle rate limiting
      if (response.status === 429) {
        console.warn('CoinGecko API rate limit reached for historical data, using current price as fallback');
        // Try to get current price as fallback
        return await getCryptoPrice(cryptoId);
      }
      
      throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    if (data.market_data && data.market_data.current_price && data.market_data.current_price.usd) {
      const price = data.market_data.current_price.usd;
      
      // Cache for a day (historical data doesn't change)
      try {
        await cacheData(cacheKey, price, 86400);
      } catch (error) {
        console.warn('Failed to cache historical price data:', error);
      }
      
      return price;
    }
    
    // If we couldn't get historical data, try current price as fallback
    console.warn(`No historical data available for ${id} at ${formattedDate}, using current price as fallback`);
    return await getCryptoPrice(cryptoId);
  } catch (error) {
    console.error(`Error fetching historical crypto price for ${cryptoId}:`, error);
    // Try to get current price as fallback
    try {
      console.warn(`Falling back to current price for ${cryptoId}`);
      return await getCryptoPrice(cryptoId);
    } catch (fallbackError) {
      console.error(`Fallback to current price also failed:`, fallbackError);
      return null;
    }
  }
}

// Check if a symbol is a cryptocurrency (starts with @)
export function isCryptoCurrency(symbol: string): boolean {
  return symbol.startsWith('@');
}

// Get current prices for multiple cryptocurrencies in a single API call
export async function getBatchCryptoPrices(cryptoIds: string[]): Promise<Map<string, number>> {
  try {
    if (cryptoIds.length === 0) {
      return new Map();
    }
    
    // Get CoinGecko IDs
    const coinGeckoIds = cryptoIds.map(id => getCoinGeckoId(id));
    
    // Create a map to store the results
    const priceMap = new Map<string, number>();
    const missingIds: string[] = [];
    
    // First try to get prices from cache
    await Promise.all(coinGeckoIds.map(async (id, index) => {
      const originalId = cryptoIds[index];
      const cacheKey = `crypto:price:${id}`;
      
      try {
        const cachedPrice = await getCachedData<number>(cacheKey);
        if (cachedPrice !== null) {
          console.log(`Using cached price for ${id}: ${cachedPrice}`);
          priceMap.set(originalId, cachedPrice);
        } else {
          missingIds.push(id);
        }
      } catch (error) {
        console.warn(`Cache error for ${id}, will fetch from API:`, error);
        missingIds.push(id);
      }
    }));
    
    // If all prices were found in cache, return early
    if (missingIds.length === 0) {
      return priceMap;
    }
    
    // If we're on client-side, let the server handle the API calls
    if (typeof window !== 'undefined') {
      try {
        // Create a comma-separated list of ids
        const idsParam = missingIds.join(',');
        const response = await fetch(`/api/crypto/batch-prices?ids=${idsParam}`);
        
        if (response.ok) {
          const data = await response.json();
          
          // Add the fetched prices to the map
          Object.entries(data.prices).forEach(([id, price]) => {
            // Find the original ID that corresponds to this CoinGecko ID
            const originalIdIndex = coinGeckoIds.findIndex(cgId => cgId === id);
            if (originalIdIndex !== -1) {
              priceMap.set(cryptoIds[originalIdIndex], price as number);
            }
          });
          
          return priceMap;
        }
      } catch (apiError) {
        console.warn('Error fetching from batch API, falling back to individual calls:', apiError);
        // Continue with individual API calls as fallback
      }
    }
    
    // Only make a direct API call to CoinGecko if we're on the server side or the batch API call failed
    if (missingIds.length > 0) {
      // Fetch in batches to avoid URL length limits
      const BATCH_SIZE = 25;
      
      for (let i = 0; i < missingIds.length; i += BATCH_SIZE) {
        const batchIds = missingIds.slice(i, i + BATCH_SIZE);
        const idsList = batchIds.join(',');
        
        const url = `${COINGECKO_API_BASE}/simple/price?ids=${idsList}&vs_currencies=usd`;
        
        console.log(`Fetching batch prices for ${batchIds.length} cryptocurrencies from CoinGecko API`);
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'accept': 'application/json'
          }
        });
        
        if (!response.ok) {
          if (response.status === 429) {
            console.warn('CoinGecko API rate limit reached for batch request');
            // Break the loop and return what we have so far
            break;
          }
          console.error(`CoinGecko API error: ${response.status} ${response.statusText}`);
          continue;
        }
        
        const data = await response.json();
        
        // Process the data and update the map
        for (const [id, priceData] of Object.entries(data)) {
          if (priceData && (priceData as any).usd) {
            const price = (priceData as any).usd;
            
            // Find the original ID that corresponds to this CoinGecko ID
            const originalIdIndex = coinGeckoIds.findIndex(cgId => cgId === id);
            if (originalIdIndex !== -1) {
              const originalId = cryptoIds[originalIdIndex];
              priceMap.set(originalId, price);
              
              // Cache the individual price
              try {
                await cacheData(`crypto:price:${id}`, price, 300);
              } catch (error) {
                console.warn(`Failed to cache price data for ${id}:`, error);
              }
            }
          }
        }
      }
    }
    
    return priceMap;
  } catch (error) {
    console.error(`Error in batch crypto price fetch:`, error);
    return new Map();
  }
} 