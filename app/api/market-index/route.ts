import { NextResponse } from 'next/server';
import { getRedisClient, cacheData, getCachedData } from '@/lib/redis';

type PerformanceData = {
  date: string;
  value: number;
};

// Generate realistic market index data with slight randomization but following general market trends
function generateMarketIndexData(
  index: string,
  days: number = 30,
  seedDate?: string
): PerformanceData[] {
  const result: PerformanceData[] = [];
  const now = seedDate ? new Date(seedDate) : new Date();
  
  // Set base values for different indices
  const baseValues: Record<string, number> = {
    'sp500': 4800, // S&P 500 approximate value
    'nasdaq': 15000, // Nasdaq approximate value
    'dow': 38000, // Dow Jones approximate value
  };
  
  // Different trend factors for different indices
  const trendFactors: Record<string, number> = {
    'sp500': 1.0004, // S&P 500 trend
    'nasdaq': 1.0006, // Nasdaq trend (slightly more aggressive)
    'dow': 1.0003, // Dow Jones trend (more conservative)
  };
  
  // Different volatility for different indices
  const volatilities: Record<string, number> = {
    'sp500': 0.007, // S&P 500 volatility
    'nasdaq': 0.01, // Nasdaq volatility (higher tech volatility)
    'dow': 0.005, // Dow Jones volatility (lower blue chip volatility)
  };

  // Starting value for the selected index
  let value = baseValues[index] || 5000;
  
  // Generate data for each day
  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    // Skip weekends
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      continue;
    }
    
    // Adjust with trend and random factor
    if (result.length > 0) {
      const trendFactor = trendFactors[index] || 1.0005;
      const volatility = volatilities[index] || 0.008;
      
      const randomFactor = 1 + (Math.random() * 2 - 1) * volatility;
      value = result[result.length - 1].value * trendFactor * randomFactor;
      
      // Add occasional market events (small crashes, rallies)
      const eventProbability = 0.05; // 5% chance of an event
      if (Math.random() < eventProbability) {
        // 50/50 chance of positive/negative event
        const eventFactor = Math.random() < 0.5 
          ? 0.98 - Math.random() * 0.01 // Small crash (0.98-0.97)
          : 1.02 + Math.random() * 0.01; // Small rally (1.02-1.03)
        value *= eventFactor;
      }
    }
    
    // Format the date as YYYY-MM-DD
    const dateStr = date.toISOString().split('T')[0];
    
    // Add to result
    result.push({
      date: dateStr,
      value: parseFloat(value.toFixed(2))
    });
  }
  
  return result;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const index = searchParams.get('index') || 'sp500';
  const days = parseInt(searchParams.get('days') || '30', 10);
  const force = searchParams.get('force') === 'true';
  
  // Only allow valid indices
  if (!['sp500', 'nasdaq', 'dow'].includes(index)) {
    return NextResponse.json(
      { error: 'Invalid index parameter. Must be one of: sp500, nasdaq, dow' },
      { status: 400 }
    );
  }

  // Cache key includes index and days
  const cacheKey = `market-index:${index}:${days}`;
  
  try {
    // Check if we should use cached data
    if (!force) {
      const cachedData = await getCachedData<PerformanceData[]>(cacheKey);
      if (cachedData) {
        console.log(`Using cached market data for ${index} (${days} days)`);
        return NextResponse.json({ performance: cachedData });
      }
    } else {
      console.log(`Force-refreshing market index data for ${index} (${days} days)`);
    }
    
    // Generate fresh mock data
    console.log(`Generating fresh market data for ${index} (${days} days)`);
    const performance = generateMarketIndexData(index, days);
    
    // Cache for 2 hours
    await cacheData(cacheKey, performance, 60 * 60 * 2);
    
    return NextResponse.json({ performance });
  } catch (error) {
    console.error(`Error fetching market index data: ${error}`);
    return NextResponse.json(
      { error: 'Failed to fetch market index data' },
      { status: 500 }
    );
  }
} 