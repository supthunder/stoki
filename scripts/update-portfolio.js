const { Pool } = require('pg');
const yahooFinance = require('yahoo-finance2').default;
const Redis = require('ioredis');

// Constants
const ONE_HOUR_IN_SECONDS = 3600;
const ONE_DAY_IN_SECONDS = 86400;

// Create database connection using environment variables
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Create Redis connection
const redis = new Redis(process.env.REDIS_URL);

// Main function to update all portfolio data
async function updateAllPortfolioData() {
  console.log('Starting portfolio data update from GitHub Actions...');
  const startTime = Date.now();
  
  const client = await pool.connect();
  
  try {
    // Get all users with their stocks
    const usersResult = await client.query(`
      SELECT 
        u.id,
        u.username,
        json_agg(
          json_build_object(
            'symbol', s.symbol,
            'quantity', s.quantity,
            'purchasePrice', s.purchase_price,
            'purchaseDate', s.purchase_date
          )
        ) FILTER (WHERE s.symbol IS NOT NULL) as stocks
      FROM users u
      LEFT JOIN user_stocks s ON u.id = s.user_id
      GROUP BY u.id, u.username
    `);

    const users = usersResult.rows;
    console.log(`Found ${users.length} users to process`);

    // Get all unique stock symbols
    const allSymbols = new Set();
    users.forEach(user => {
      if (user.stocks && Array.isArray(user.stocks)) {
        user.stocks.forEach(stock => {
          if (stock.symbol) {
            allSymbols.add(stock.symbol);
          }
        });
      }
    });

    console.log(`Found ${allSymbols.size} unique stock symbols`);

    // Get current prices for all symbols
    const symbolPrices = new Map();
    const today = new Date();
    const oneDayAgo = new Date(today);
    oneDayAgo.setDate(oneDayAgo.getDate() - 2); // Go back 2 days to ensure we get data
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 8); // Go back 8 days to ensure we get data

    // Fetch current prices
    if (allSymbols.size > 0) {
      try {
        console.log('Fetching current prices from Yahoo Finance...');
        const symbols = Array.from(allSymbols);
        
        // Batch symbols into groups of 10 to avoid rate limiting
        const batchSize = 10;
        for (let i = 0; i < symbols.length; i += batchSize) {
          const batch = symbols.slice(i, i + batchSize);
          console.log(`Processing batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(symbols.length/batchSize)}`);
          
          try {
            const quotesResponse = await yahooFinance.quote(batch);
            
            if (Array.isArray(quotesResponse)) {
              quotesResponse.forEach(quote => {
                if (quote && quote.symbol && quote.regularMarketPrice) {
                  symbolPrices.set(quote.symbol, quote.regularMarketPrice);
                  console.log(`Got price for ${quote.symbol}: $${quote.regularMarketPrice}`);
                }
              });
            } else if (quotesResponse) {
              const singleQuote = quotesResponse;
              if (singleQuote.symbol && singleQuote.regularMarketPrice) {
                symbolPrices.set(singleQuote.symbol, singleQuote.regularMarketPrice);
                console.log(`Got price for ${singleQuote.symbol}: $${singleQuote.regularMarketPrice}`);
              }
            }
          } catch (err) {
            console.error(`Error fetching batch of quotes:`, err.message);
          }
          
          // Add a small delay between batches to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Cache the current prices in Redis
        const pricesObject = Object.fromEntries(symbolPrices.entries());
        await redis.set('stock:prices:current', JSON.stringify(pricesObject), 'EX', ONE_HOUR_IN_SECONDS); // 1 hour
        console.log(`Cached ${symbolPrices.size} current prices in Redis`);
      } catch (err) {
        console.error('Error fetching stock prices:', err.message);
      }
    }

    // Fetch historical prices for 1 day ago and 7 days ago
    const historicalPrices1Day = new Map();
    const historicalPrices7Days = new Map();

    if (allSymbols.size > 0) {
      try {
        console.log('Fetching historical prices...');
        const symbols = Array.from(allSymbols);
        
        // Batch symbols into groups of 5 for historical data to avoid rate limiting
        const batchSize = 5;
        for (let i = 0; i < symbols.length; i += batchSize) {
          const batch = symbols.slice(i, i + batchSize);
          console.log(`Processing historical data batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(symbols.length/batchSize)}`);
          
          for (const symbol of batch) {
            try {
              // Get daily historical data
              console.log(`Fetching daily historical data for ${symbol}`);
              const chartResult1Day = await yahooFinance.chart(symbol, {
                period1: oneDayAgo,
                period2: today,
                interval: '1d'
              });
              
              if (chartResult1Day && chartResult1Day.quotes && chartResult1Day.quotes.length > 0) {
                // Get yesterday's closing price
                const quote = chartResult1Day.quotes[0];
                if (quote.close !== null) {
                  historicalPrices1Day.set(symbol, quote.close);
                  console.log(`Got 1-day historical price for ${symbol}: ${quote.close}`);
                }
              }
              
              // Get weekly historical data
              console.log(`Fetching weekly historical data for ${symbol}`);
              const chartResult7Days = await yahooFinance.chart(symbol, {
                period1: sevenDaysAgo,
                period2: today,
                interval: '1d'
              });
              
              if (chartResult7Days && chartResult7Days.quotes && chartResult7Days.quotes.length > 0) {
                // Get the price from 7 days ago
                const quote = chartResult7Days.quotes[0];
                if (quote.close !== null) {
                  historicalPrices7Days.set(symbol, quote.close);
                  console.log(`Got 7-day historical price for ${symbol}: ${quote.close}`);
                }
              }
            } catch (err) {
              console.error(`Error fetching historical data for ${symbol}:`, err.message);
            }
            
            // Add a small delay between symbols to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
        
        // Cache the historical prices in Redis
        const prices1DayObject = Object.fromEntries(historicalPrices1Day.entries());
        const prices7DaysObject = Object.fromEntries(historicalPrices7Days.entries());
        
        await redis.set('stock:prices:1day', JSON.stringify(prices1DayObject), 'EX', ONE_DAY_IN_SECONDS); // 24 hours
        await redis.set('stock:prices:7days', JSON.stringify(prices7DaysObject), 'EX', ONE_DAY_IN_SECONDS); // 24 hours
        
        console.log(`Cached ${historicalPrices1Day.size} 1-day and ${historicalPrices7Days.size} 7-day historical prices in Redis`);
      } catch (err) {
        console.error('Error fetching historical stock data:', err.message);
      }
    }

    // Process each user and update their portfolio summary
    for (const user of users) {
      if (!user.stocks || user.stocks.length === 0) {
        console.log(`User ${user.username} has no stocks, skipping...`);
        continue;
      }

      console.log(`Processing user ${user.username}...`);

      // Calculate totals
      let totalCurrentValue = 0;
      let totalPurchaseValue = 0;
      let totalValue1DayAgo = 0;
      let totalValue7DaysAgo = 0;

      user.stocks.forEach(stock => {
        // Get current price, with fallback to purchase price
        const currentPrice = symbolPrices.get(stock.symbol) || stock.purchasePrice;
        
        // Get historical prices with fallbacks
        const price1DayAgo = historicalPrices1Day.get(stock.symbol) || currentPrice || stock.purchasePrice;
        const price7DaysAgo = historicalPrices7Days.get(stock.symbol) || currentPrice || stock.purchasePrice;
        
        // Calculate values
        const currentValue = stock.quantity * currentPrice;
        const purchaseValue = stock.quantity * stock.purchasePrice;
        const value1DayAgo = stock.quantity * price1DayAgo;
        const value7DaysAgo = stock.quantity * price7DaysAgo;
        
        // Add to totals
        totalCurrentValue += currentValue;
        totalPurchaseValue += purchaseValue;
        totalValue1DayAgo += value1DayAgo;
        totalValue7DaysAgo += value7DaysAgo;
        
        console.log(`Stock ${stock.symbol}: Current: $${currentPrice}, 1-Day: $${price1DayAgo}, 7-Day: $${price7DaysAgo}, Purchase: $${stock.purchasePrice}`);
      });

      // Calculate gains and percentages
      const totalGain = totalCurrentValue - totalPurchaseValue;
      const totalGainPercentage = totalPurchaseValue > 0 ? (totalGain / totalPurchaseValue) * 100 : 0;
      
      const dailyGain = totalCurrentValue - totalValue1DayAgo;
      const dailyGainPercentage = totalValue1DayAgo > 0 ? (dailyGain / totalValue1DayAgo) * 100 : 0;
      
      const weeklyGain = totalCurrentValue - totalValue7DaysAgo;
      const weeklyGainPercentage = totalValue7DaysAgo > 0 ? (weeklyGain / totalValue7DaysAgo) * 100 : 0;

      // Update portfolio summary in database
      try {
        await client.query(`
          INSERT INTO portfolio_summaries (
            user_id,
            total_current_value,
            total_purchase_value,
            total_gain,
            total_gain_percentage,
            daily_gain,
            daily_gain_percentage,
            weekly_gain,
            weekly_gain_percentage,
            last_updated
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()
          )
          ON CONFLICT (user_id) DO UPDATE SET
            total_current_value = EXCLUDED.total_current_value,
            total_purchase_value = EXCLUDED.total_purchase_value,
            total_gain = EXCLUDED.total_gain,
            total_gain_percentage = EXCLUDED.total_gain_percentage,
            daily_gain = EXCLUDED.daily_gain,
            daily_gain_percentage = EXCLUDED.daily_gain_percentage,
            weekly_gain = EXCLUDED.weekly_gain,
            weekly_gain_percentage = EXCLUDED.weekly_gain_percentage,
            last_updated = EXCLUDED.last_updated
        `, [
          user.id, 
          totalCurrentValue, 
          totalPurchaseValue, 
          totalGain, 
          totalGainPercentage,
          dailyGain,
          dailyGainPercentage,
          weeklyGain,
          weeklyGainPercentage
        ]);

        console.log(`Updated summary for ${user.username}:`);
        console.log(`- Current Value: $${totalCurrentValue.toFixed(2)}`);
        console.log(`- Purchase Value: $${totalPurchaseValue.toFixed(2)}`);
        console.log(`- Total Gain: $${totalGain.toFixed(2)} (${totalGainPercentage.toFixed(2)}%)`);
        console.log(`- Daily Gain: $${dailyGain.toFixed(2)} (${dailyGainPercentage.toFixed(2)}%)`);
        console.log(`- Weekly Gain: $${weeklyGain.toFixed(2)} (${weeklyGainPercentage.toFixed(2)}%)`);
      } catch (err) {
        console.error(`Error updating portfolio summary for user ${user.username}:`, err.message);
      }
    }

    // Cache the last update timestamp in Redis
    await redis.set('portfolio_data:last_updated', new Date().toISOString(), 'EX', ONE_DAY_IN_SECONDS);
    
    // Also cache pre-formatted leaderboard data for each time frame
    await cacheLeaderboardData(client, 'total');
    await cacheLeaderboardData(client, 'daily');
    await cacheLeaderboardData(client, 'weekly');

    const executionTime = (Date.now() - startTime) / 1000;
    console.log(`Portfolio data update completed in ${executionTime.toFixed(2)} seconds`);
  } catch (error) {
    console.error('Error in portfolio update job:', error);
    process.exit(1);
  } finally {
    client.release();
    // Close connections
    await pool.end();
    await redis.quit();
  }
}

// Helper function to cache pre-formatted leaderboard data
async function cacheLeaderboardData(client, timeFrame) {
  try {
    // Get all users with their portfolio data from the database
    const results = await client.query(`
      WITH portfolio_data AS (
        SELECT 
          u.id,
          u.username,
          u.avatar,
          ps.total_current_value as current_worth,
          ps.total_purchase_value as purchase_value,
          ps.total_gain,
          ps.total_gain_percentage,
          ps.daily_gain,
          ps.daily_gain_percentage,
          ps.weekly_gain,
          ps.weekly_gain_percentage,
          ps.last_updated
        FROM users u
        LEFT JOIN portfolio_summaries ps ON u.id = ps.user_id
        ORDER BY 
          CASE 
            WHEN '${timeFrame}' = 'daily' THEN ps.daily_gain_percentage 
            WHEN '${timeFrame}' = 'weekly' THEN ps.weekly_gain_percentage
            ELSE ps.total_gain_percentage
          END DESC NULLS LAST
      )
      SELECT * FROM portfolio_data
    `);

    // Format the data for the frontend
    const formattedResults = results.rows.map(user => {
      return {
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        totalGain: formatCurrency(user.total_gain || 0),
        totalGainPercentage: Number(user.total_gain_percentage || 0).toFixed(2),
        dailyGain: formatCurrency(user.daily_gain || 0),
        dailyGainPercentage: Number(user.daily_gain_percentage || 0).toFixed(2),
        weeklyGain: formatCurrency(user.weekly_gain || 0),
        weeklyGainPercentage: Number(user.weekly_gain_percentage || 0).toFixed(2),
        currentWorth: formatCurrency(user.current_worth || 0),
        startingAmount: formatCurrency(user.purchase_value || 0),
        lastUpdated: user.last_updated ? new Date(user.last_updated).toISOString() : null
      };
    });

    // Cache the results for 1 hour
    const cacheKey = `leaderboard:data:${timeFrame}`;
    await redis.set(cacheKey, JSON.stringify(formattedResults), 'EX', ONE_HOUR_IN_SECONDS);
    console.log(`Cached ${formattedResults.length} leaderboard entries for ${timeFrame} time frame`);
  } catch (error) {
    console.error(`Error caching leaderboard data for ${timeFrame}:`, error);
  }
}

// Helper function to format currency
function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

// Run the update function
updateAllPortfolioData().catch(error => {
  console.error('Unhandled error in update script:', error);
  process.exit(1);
}); 