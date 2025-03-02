import { NextResponse } from "next/server";
import { createSqlClient } from "@/lib/db";

export async function GET() {
  try {
    const sql = createSqlClient();
    
    // Execute query to get only politician users (containing "(D)" or "(R)")
    const result = await sql`
      SELECT 
        u.id,
        u.username,
        COUNT(s.id) as stock_count
      FROM users u
      LEFT JOIN user_stocks s ON u.id = s.user_id
      WHERE u.username LIKE '%(%)'
      GROUP BY u.id, u.username
      ORDER BY u.username
    `;
    
    // For each politician, get their stocks
    const detailedResults = [];
    
    for (const politician of result) {
      const stocks = await sql`
        SELECT 
          s.symbol,
          s.quantity,
          s.purchase_price,
          s.purchase_date
        FROM user_stocks s
        WHERE s.user_id = ${politician.id}
      `;
      
      detailedResults.push({
        ...politician,
        stocks: stocks
      });
    }
    
    return NextResponse.json({
      politicianCount: result.length,
      politicians: detailedResults
    });
  } catch (error) {
    console.error("Error fetching politician data:", error);
    return NextResponse.json(
      { error: "Failed to fetch politician data" },
      { status: 500 }
    );
  }
} 