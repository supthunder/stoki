import { NextResponse } from "next/server";
import { getRedisClient, cacheData, getCachedData } from '@/lib/redis';
import { createSqlClient } from "@/lib/db";

// Cache key for transactions
const CACHE_KEY = "transactions:recent";
const CACHE_EXPIRY = 60 * 5; // 5 minutes in seconds

// Ensure transactions table exists
async function ensureTransactionsTable() {
  const sql = createSqlClient();
  
  try {
    // Check if table exists
    const tableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'transactions'
      );
    `;
    
    if (!tableExists[0]?.exists) {
      console.log("Creating transactions table...");
      
      // Create transactions table
      await sql`
        CREATE TABLE IF NOT EXISTS transactions (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          symbol VARCHAR(10) NOT NULL,
          quantity INTEGER NOT NULL,
          price NUMERIC(10, 2) NOT NULL,
          type VARCHAR(4) NOT NULL CHECK (type IN ('buy', 'sell')),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;
      
      // Seed with some initial data
      await seedTransactionsData();
    }
    
    return true;
  } catch (error) {
    console.error("Error ensuring transactions table:", error);
    return false;
  }
}

// Seed transactions table with initial data
async function seedTransactionsData() {
  const sql = createSqlClient();
  
  try {
    console.log("Seeding transactions table with initial data...");
    
    // Get existing users
    const users = await sql`SELECT id, username FROM users LIMIT 10`;
    
    if (users.length === 0) {
      console.log("No users found to seed transactions");
      return;
    }
    
    // Symbols to use for transactions
    const symbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA", "NVDA", "JPM", "BAC", "GS"];
    
    // Generate 50 random transactions
    const transactions = [];
    
    for (let i = 0; i < 50; i++) {
      const user = users[Math.floor(Math.random() * users.length)];
      const symbol = symbols[Math.floor(Math.random() * symbols.length)];
      const type = Math.random() > 0.5 ? 'buy' : 'sell';
      const quantity = Math.floor(Math.random() * 5) + 1;
      const price = parseFloat((Math.random() * 500 + 50).toFixed(2));
      
      // Generate a random date within the last 30 days
      const date = new Date();
      date.setDate(date.getDate() - Math.floor(Math.random() * 30));
      
      transactions.push({
        user_id: user.id,
        symbol,
        quantity,
        price,
        type,
        created_at: date.toISOString()
      });
    }
    
    // Insert transactions in batches
    for (const transaction of transactions) {
      await sql`
        INSERT INTO transactions (user_id, symbol, quantity, price, type, created_at)
        VALUES (${transaction.user_id}, ${transaction.symbol}, ${transaction.quantity}, ${transaction.price}, ${transaction.type}, ${transaction.created_at})
      `;
    }
    
    console.log(`Seeded ${transactions.length} transactions`);
  } catch (error) {
    console.error("Error seeding transactions data:", error);
  }
}

export async function GET(request: Request) {
  try {
    // Ensure transactions table exists
    await ensureTransactionsTable();
    
    // Check if we have cached data
    const cachedTransactions = await getCachedData<any[]>(CACHE_KEY);
    if (cachedTransactions) {
      return NextResponse.json(cachedTransactions);
    }

    // If no cached data, fetch from database
    const sql = createSqlClient();
    const transactions = await sql`
      SELECT 
        t.id,
        t.user_id as "userId",
        u.username as "userName",
        t.symbol,
        t.quantity,
        t.price,
        t.type,
        t.created_at as "date"
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      ORDER BY t.created_at DESC
      LIMIT 50
    `;

    // Cache the results
    await cacheData(CACHE_KEY, transactions, CACHE_EXPIRY);

    return NextResponse.json(transactions);
  } catch (error) {
    console.error("Error fetching transactions:", error);
    
    // For development, return mock data if database query fails
    if (process.env.NODE_ENV !== 'production') {
      console.log("Returning mock transaction data for development");
      return NextResponse.json(mockTransactions);
    }
    
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}

// For development/testing, here's some mock data
const mockTransactions = [
  {
    id: 1,
    userId: 5,
    userName: "Nancy Pelosi",
    symbol: "AAPL",
    quantity: 2,
    price: 178.25,
    type: "buy",
    date: "2024-06-30T12:00:00Z"
  },
  {
    id: 2,
    userId: 8,
    userName: "Josh Gottheimer",
    symbol: "TSLA",
    quantity: 1,
    price: 220.15,
    type: "sell",
    date: "2024-06-27T14:30:00Z"
  },
  {
    id: 3,
    userId: 4,
    userName: "Daniel Meuser",
    symbol: "NVDA",
    quantity: 1,
    price: 118.75,
    type: "buy",
    date: "2024-06-24T09:15:00Z"
  },
  {
    id: 4,
    userId: 7,
    userName: "Thomas R. Carper",
    symbol: "MSFT",
    quantity: 2,
    price: 405.30,
    type: "buy",
    date: "2024-06-19T11:45:00Z"
  }
]; 