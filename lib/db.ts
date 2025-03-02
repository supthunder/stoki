import { neon } from '@neondatabase/serverless';

// Get database URL from environment variables
const getDatabaseUrl = () => {
  const url = 
    process.env.DATABASE_URL || 
    process.env.POSTGRES_URL || 
    process.env.POSTGRES_URL_NON_POOLING;
  
  if (!url) {
    console.error('Database connection string missing. Please check your environment variables.');
    console.error('Required environment variables: DATABASE_URL, POSTGRES_URL, or POSTGRES_URL_NON_POOLING');
    
    // In development, return null; in production, throw
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Database connection string missing');
    }
    return null;
  }
  
  return url;
};

// Create a SQL function that connects to the database
export const createSqlClient = () => {
  const url = getDatabaseUrl();
  
  if (!url) {
    throw new Error('Database connection string missing');
  }
  
  // Create the SQL client with the Neon serverless driver
  return neon(url);
};

// User functions - only used server-side in API routes
export async function createUser(username: string) {
  try {
    const sql = createSqlClient();
    
    // Try to insert the user
    const insertResult = await sql`
      INSERT INTO users (username)
      VALUES (${username})
      ON CONFLICT (username) DO NOTHING
      RETURNING id, username
    `;
    
    // If no row was inserted, the user already exists
    if (insertResult.length === 0) {
      // Fetch the existing user
      const existingUser = await sql`
        SELECT id, username FROM users WHERE username = ${username}
      `;
      return existingUser[0];
    }
    
    return insertResult[0];
  } catch (error) {
    console.error('Failed to create user:', error);
    throw error;
  }
}

export async function getUserByUsername(username: string) {
  try {
    const sql = createSqlClient();
    const result = await sql`
      SELECT id, username FROM users WHERE username = ${username}
    `;
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('Failed to get user:', error);
    throw error;
  }
}

// Stock functions
export async function addStockToUser(
  userId: number,
  symbol: string,
  companyName: string,
  quantity: number,
  purchasePrice: number,
  purchaseDate: string = new Date().toISOString().split('T')[0]
) {
  try {
    const sql = createSqlClient();
    const result = await sql`
      INSERT INTO user_stocks (user_id, symbol, company_name, quantity, purchase_price, purchase_date)
      VALUES (${userId}, ${symbol}, ${companyName}, ${quantity}, ${purchasePrice}, ${purchaseDate})
      RETURNING id, symbol, company_name, quantity, purchase_price, purchase_date
    `;
    return result[0];
  } catch (error) {
    console.error('Failed to add stock:', error);
    throw error;
  }
}

export async function getUserStocks(userId: number) {
  try {
    const sql = createSqlClient();
    const result = await sql`
      SELECT id, symbol, company_name, quantity, purchase_price, purchase_date
      FROM user_stocks
      WHERE user_id = ${userId}
      ORDER BY symbol
    `;
    return result;
  } catch (error) {
    console.error('Failed to get user stocks:', error);
    throw error;
  }
}

export async function updateStockQuantity(
  stockId: number,
  newQuantity: number
) {
  try {
    const sql = createSqlClient();
    if (newQuantity <= 0) {
      // Delete the stock if quantity is 0 or negative
      await sql`DELETE FROM user_stocks WHERE id = ${stockId}`;
      return null;
    } else {
      const result = await sql`
        UPDATE user_stocks
        SET quantity = ${newQuantity}
        WHERE id = ${stockId}
        RETURNING id, symbol, quantity, purchase_price
      `;
      return result[0];
    }
  } catch (error) {
    console.error('Failed to update stock quantity:', error);
    throw error;
  }
}

// Add this function after the updateStockQuantity function
export async function updateStock(
  stockId: number,
  userId: number,
  quantity: number,
  purchasePrice: number,
  purchaseDate: string
) {
  try {
    const sql = createSqlClient();
    
    // First, check if the stock belongs to the specified user
    const stockCheck = await sql`
      SELECT id FROM user_stocks 
      WHERE id = ${stockId} AND user_id = ${userId}
    `;
    
    if (stockCheck.length === 0) {
      // Stock not found or doesn't belong to user
      return null;
    }
    
    if (quantity <= 0) {
      // Delete the stock if quantity is 0 or negative
      await sql`DELETE FROM user_stocks WHERE id = ${stockId}`;
      return null;
    } else {
      const result = await sql`
        UPDATE user_stocks
        SET 
          quantity = ${quantity}, 
          purchase_price = ${purchasePrice}, 
          purchase_date = ${purchaseDate}
        WHERE id = ${stockId}
        RETURNING id, symbol, company_name, quantity, purchase_price, purchase_date
      `;
      return result[0];
    }
  } catch (error) {
    console.error('Failed to update stock:', error);
    throw error;
  }
}

// Function to get all users with their stocks for the leaderboard
export async function getLeaderboardData() {
  try {
    const sql = createSqlClient();
    
    // Get all users who have at least one stock
    const usersWithStocks = await sql`
      SELECT DISTINCT u.id, u.username 
      FROM users u
      JOIN user_stocks s ON u.id = s.user_id
    `;
    
    if (usersWithStocks.length === 0) {
      return [];
    }
    
    // For each user, get their stocks and calculate totals
    const leaderboardData = await Promise.all(
      usersWithStocks.map(async (user) => {
        const stocks = await sql`
          SELECT symbol, company_name, quantity, purchase_price, purchase_date
          FROM user_stocks
          WHERE user_id = ${user.id}
        `;
        
        // Calculate user's portfolio metrics
        let totalInvestment = 0;
        let topGainer = { symbol: '', gainPercentage: -Infinity };
        
        // Process each stock
        const stocksWithCurrentPrice = await Promise.all(
          stocks.map(async (stock) => {
            // In a real app, we would fetch current prices from an API
            // For this demo, we'll use our local price API
            const response = await fetch(
              `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/stocks/price?symbol=${stock.symbol}`,
              { cache: 'no-store' }
            );
            
            const priceData = await response.json();
            const currentPrice = priceData.price;
            
            // Calculate values
            const totalValue = currentPrice * stock.quantity;
            const invested = stock.purchase_price * stock.quantity;
            const gainLoss = totalValue - invested;
            const gainPercentage = ((currentPrice - stock.purchase_price) / stock.purchase_price) * 100;
            
            totalInvestment += invested;
            
            // Check if this is the top gainer
            if (gainPercentage > topGainer.gainPercentage) {
              topGainer = { 
                symbol: stock.symbol, 
                gainPercentage 
              };
            }
            
            return {
              ...stock,
              currentPrice,
              totalValue,
              gainLoss,
              gainPercentage
            };
          })
        );
        
        // Calculate totals
        const currentWorth = stocksWithCurrentPrice.reduce(
          (sum, stock) => sum + stock.totalValue, 0
        );
        
        const totalGain = currentWorth - totalInvestment;
        const totalGainPercentage = totalInvestment > 0 
          ? (totalGain / totalInvestment) * 100 
          : 0;
        
        return {
          id: user.id,
          name: user.username,
          totalGain,
          totalGainPercentage,
          topGainer: topGainer.symbol,
          topGainerPercentage: topGainer.gainPercentage,
          currentWorth,
          stocks: stocksWithCurrentPrice
        };
      })
    );
    
    // Sort by total gain in descending order
    return leaderboardData.sort((a, b) => b.totalGain - a.totalGain);
  } catch (error) {
    console.error('Failed to get leaderboard data:', error);
    throw error;
  }
} 