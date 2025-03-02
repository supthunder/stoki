import { sql } from '@vercel/postgres';

// Initialize the database by creating tables if they don't exist
export async function initializeDb() {
  try {
    // Create users table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create stocks table
    await sql`
      CREATE TABLE IF NOT EXISTS user_stocks (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        symbol VARCHAR(20) NOT NULL,
        company_name VARCHAR(255),
        quantity INTEGER NOT NULL,
        purchase_price DECIMAL(10, 2) NOT NULL,
        purchase_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, symbol)
      )
    `;

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

// User functions
export async function createUser(username: string) {
  try {
    const result = await sql`
      INSERT INTO users (username)
      VALUES (${username})
      ON CONFLICT (username) DO NOTHING
      RETURNING id, username
    `;
    
    if (result.rows.length === 0) {
      // User already exists, fetch the existing user
      const existingUser = await sql`
        SELECT id, username FROM users WHERE username = ${username}
      `;
      return existingUser.rows[0];
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('Failed to create user:', error);
    throw error;
  }
}

export async function getUserByUsername(username: string) {
  try {
    const result = await sql`
      SELECT id, username FROM users WHERE username = ${username}
    `;
    return result.rows[0] || null;
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
    const result = await sql`
      INSERT INTO user_stocks (user_id, symbol, company_name, quantity, purchase_price)
      VALUES (${userId}, ${symbol}, ${companyName}, ${quantity}, ${purchasePrice})
      ON CONFLICT (user_id, symbol) 
      DO UPDATE SET 
        quantity = user_stocks.quantity + ${quantity},
        purchase_price = (user_stocks.purchase_price * user_stocks.quantity + ${purchasePrice} * ${quantity}) / (user_stocks.quantity + ${quantity})
      RETURNING id, symbol, company_name, quantity, purchase_price
    `;
    return result.rows[0];
  } catch (error) {
    console.error('Failed to add stock:', error);
    throw error;
  }
}

export async function getUserStocks(userId: number) {
  try {
    const result = await sql`
      SELECT id, symbol, company_name, quantity, purchase_price, purchase_date
      FROM user_stocks
      WHERE user_id = ${userId}
      ORDER BY symbol
    `;
    return result.rows;
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
      return result.rows[0];
    }
  } catch (error) {
    console.error('Failed to update stock quantity:', error);
    throw error;
  }
} 