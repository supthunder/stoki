import { NextResponse } from "next/server";
import { createSqlClient } from "@/lib/db";

export async function GET() {
  try {
    const sql = createSqlClient();
    
    // Execute query to get users with their portfolio data using tagged template literal
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
    
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching test data:", error);
    return NextResponse.json(
      { error: "Failed to fetch test data" },
      { status: 500 }
    );
  }
} 