import { NextResponse } from "next/server";
import { createSqlClient } from "@/lib/db";

// Define the request body type
type AddStockRequest = {
  userId: number;
  symbol: string;
  companyName: string;
  quantity: number;
  purchasePrice: number;
  purchaseDate?: string;
};

export async function POST(request: Request) {
  try {
    // Parse the request body
    const body: AddStockRequest = await request.json();
    
    // Validate required fields
    if (!body.userId || !body.symbol || !body.companyName || !body.quantity || !body.purchasePrice) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Set default purchase date to today if not provided
    const purchaseDate = body.purchaseDate || new Date().toISOString().split('T')[0];
    
    const sql = createSqlClient();
    
    // Insert the stock into the database
    const result = await sql`
      INSERT INTO user_stocks (
        user_id, 
        symbol, 
        company_name, 
        quantity, 
        purchase_price, 
        purchase_date
      )
      VALUES (
        ${body.userId}, 
        ${body.symbol}, 
        ${body.companyName}, 
        ${body.quantity}, 
        ${body.purchasePrice}, 
        ${purchaseDate}
      )
      RETURNING id, symbol, company_name as "companyName", quantity, purchase_price as "purchasePrice", purchase_date as "purchaseDate"
    `;
    
    if (result.length === 0) {
      throw new Error('Failed to add stock');
    }
    
    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error adding stock to portfolio:', error);
    return NextResponse.json(
      { error: 'Failed to add stock to portfolio' },
      { status: 500 }
    );
  }
} 