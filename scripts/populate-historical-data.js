require('dotenv').config({ path: '.env.local' });
const { createClient } = require('redis');
const postgres = require('postgres');

// Initialize SQL client
function createSqlClient() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  
  if (!connectionString) {
    throw new Error('No database connection string provided');
  }

  return postgres(connectionString, {
    ssl: 'require',
  });
}

// Initialize Redis client
async function getRedisClient() {
  try {
    const url = process.env.REDIS_URL;
    
    if (!url) {
      console.error('REDIS_URL not found in environment variables');
      return null;
    }
    
    const client = createClient({ url });
    
    client.on('error', (err) => {
      console.error('Redis connection error:', err);
    });
    
    await client.connect();
    console.log('Redis client connected successfully');
    return client;
  } catch (error) {
    console.error('Failed to initialize Redis client:', error);
    return null;
  }
}

// Main function to populate historical data
async function populateHistoricalData() {
  try {
    // Connect to database
    const sql = createSqlClient();
    console.log('Connected to database');
    
    // Connect to Redis
    const redisClient = await getRedisClient();
    if (!redisClient) {
      console.error('Failed to connect to Redis, aborting');
      return;
    }

    // Get all users with stocks
    const users = await sql`
      SELECT DISTINCT u.id, u.username 
      FROM users u
      JOIN user_stocks s ON u.id = s.user_id
      ORDER BY u.username
    `;

    console.log(`Found ${users.length} users with stocks`);

    // For each user, generate 30 days of historical data
    for (const user of users) {
      console.log(`Generating historical data for ${user.username} (ID: ${user.id})`);
      
      // Get user's current portfolio value
      const portfolioResult = await sql`
        SELECT SUM(quantity * purchase_price) as total_value
        FROM user_stocks
        WHERE user_id = ${user.id}
      `;

      // Ensure baseValue is a number
      const baseValue = parseFloat(portfolioResult[0]?.total_value || 10000);
      console.log(`  Base portfolio value: $${baseValue.toFixed(2)}`);
      
      // Generate 30 days of historical data
      const today = new Date();
      let currentValue = baseValue;
      
      for (let i = 30; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        // Add some randomness to simulate market fluctuations
        // Earlier dates have more volatility
        const volatility = 0.02 - (i * 0.0004); // Ranges from 0.008 to 0.02
        const randomFactor = 1 + ((Math.random() * volatility * 2) - volatility);
        
        // Apply random factor but also add an upward trend over time
        // Politicians typically have insider knowledge, so their portfolios tend to go up
        const trendFactor = 1 + (0.002 * (30 - i) / 30); // Slight upward trend
        currentValue = currentValue * randomFactor * trendFactor;
        
        // Round to 2 decimal places
        const roundedValue = Math.round(currentValue * 100) / 100;
        
        // Store in Redis
        const key = `user:${user.id}:portfolio:${dateStr}`;
        await redisClient.set(key, JSON.stringify({ value: roundedValue }), { EX: 60 * 60 * 24 * 90 }); // 90 days expiration
        
        console.log(`  Added data for ${dateStr}: $${roundedValue.toFixed(2)}`);
      }
    }

    console.log('Finished populating historical data');
    await redisClient.quit();
    await sql.end();
    process.exit(0);
  } catch (error) {
    console.error('Error populating historical data:', error);
    process.exit(1);
  }
}

// Run the script
populateHistoricalData(); 