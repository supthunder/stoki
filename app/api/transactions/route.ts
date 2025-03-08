import { NextResponse } from "next/server";
import { getRedisClient, cacheData, getCachedData } from '@/lib/redis';
import { createSqlClient } from "@/lib/db";

// Cache key for transactions
const CACHE_KEY = "transactions:recent";
const CACHE_EXPIRY = 60 * 5; // 5 minutes in seconds

export async function GET(request: Request) {
  try {
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