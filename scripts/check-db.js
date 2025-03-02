// Load environment variables
require('dotenv').config({ path: '.env.local' });

// Dynamic import for ESM compatibility
const importDependencies = async () => {
  try {
    // Try ESM style first
    const { neon } = await import('@neondatabase/serverless');
    return { neon };
  } catch (err) {
    // Fall back to CommonJS
    const neon = require('@neondatabase/serverless').neon;
    return { neon };
  }
};

// Create SQL client directly (similar to lib/db.ts but inline)
const createSqlClient = () => {
  const url = 
    process.env.DATABASE_URL || 
    process.env.POSTGRES_URL || 
    process.env.POSTGRES_URL_NON_POOLING;
  
  if (!url) {
    throw new Error('Database connection string missing. Please check your environment variables.');
  }
  
  // Will be defined in the scope where this is called
  return neon(url);
};

async function checkDatabase() {
  try {
    // Import dependencies dynamically
    const { neon } = await importDependencies();
    
    // Make neon available to createSqlClient
    global.neon = neon;
    
    const sql = createSqlClient();
    console.log('Connected to database');
    
    // First, check if there are any users
    console.log('Checking users...');
    const users = await sql`SELECT id, username FROM users`;
    console.log('Users:', users);
    
    // Then check if there are any stocks
    console.log('\nChecking stocks...');
    const stocks = await sql`SELECT * FROM user_stocks LIMIT 5`;
    console.log('Stocks:', stocks);
    
    // Check all steps of the leaderboard query separately
    console.log('\nStep 1: Checking user_portfolio CTE...');
    const userPortfolio = await sql`
      SELECT 
        u.id as user_id,
        u.username as username,
        s.symbol,
        s.quantity,
        s.purchase_price,
        s.purchase_date
      FROM users u
      LEFT JOIN user_stocks s ON u.id = s.user_id
      LIMIT 10
    `;
    console.log('User portfolio (first 10):', userPortfolio);
    
    console.log('\nStep 2: Checking user_totals CTE...');
    const userTotals = await sql`
      WITH user_portfolio AS (
        SELECT 
          u.id as user_id,
          u.username as username,
          s.symbol,
          s.quantity,
          s.purchase_price,
          s.purchase_date
        FROM users u
        LEFT JOIN user_stocks s ON u.id = s.user_id
      )
      SELECT 
        up.user_id,
        up.username,
        SUM(up.quantity * up.purchase_price) as total_invested,
        json_agg(
          json_build_object(
            'symbol', up.symbol,
            'quantity', up.quantity,
            'purchasePrice', up.purchase_price,
            'purchaseDate', up.purchase_date
          )
        ) FILTER (WHERE up.symbol IS NOT NULL) as stocks
      FROM user_portfolio up
      GROUP BY up.user_id, up.username
      LIMIT 10
    `;
    console.log('User totals (first 10):', userTotals);
    
    console.log('\nFull leaderboard query...');
    const result = await sql`
      WITH user_portfolio AS (
        SELECT 
          u.id as user_id,
          u.username as username,
          s.symbol,
          s.quantity,
          s.purchase_price,
          s.purchase_date
        FROM users u
        LEFT JOIN user_stocks s ON u.id = s.user_id
      ),
      user_totals AS (
        SELECT 
          up.user_id,
          up.username,
          SUM(up.quantity * up.purchase_price) as total_invested,
          json_agg(
            json_build_object(
              'symbol', up.symbol,
              'quantity', up.quantity,
              'purchasePrice', up.purchase_price,
              'purchaseDate', up.purchase_date
            )
          ) FILTER (WHERE up.symbol IS NOT NULL) as stocks
        FROM user_portfolio up
        GROUP BY up.user_id, up.username
      )
      SELECT 
        ut.user_id as id,
        ut.username as name,
        COALESCE(ut.total_invested, 0) as total_invested,
        ut.stocks
      FROM user_totals ut
      ORDER BY total_invested DESC
    `;
    
    console.log('Leaderboard query result:');
    console.log(JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('Error checking database:', error);
  }
}

checkDatabase(); 