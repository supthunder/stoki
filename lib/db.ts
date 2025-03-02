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
const createSqlClient = () => {
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
  purchasePrice: number
) {
  try {
    const sql = createSqlClient();
    const result = await sql`
      INSERT INTO user_stocks (user_id, symbol, company_name, quantity, purchase_price)
      VALUES (${userId}, ${symbol}, ${companyName}, ${quantity}, ${purchasePrice})
      ON CONFLICT (user_id, symbol) 
      DO UPDATE SET 
        quantity = user_stocks.quantity + ${quantity},
        purchase_price = (user_stocks.purchase_price * user_stocks.quantity + ${purchasePrice} * ${quantity}) / (user_stocks.quantity + ${quantity})
      RETURNING id, symbol, company_name, quantity, purchase_price
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