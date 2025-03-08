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
    const body = await request.json();
    const { userId, symbol, companyName, quantity, purchasePrice, purchaseDate } = body;

    const sql = createSqlClient();

    // First check if the stock already exists for this user
    const existingStock = await sql`
      SELECT id, quantity, purchase_price
      FROM user_stocks
      WHERE user_id = ${userId} AND symbol = ${symbol}
    `;

    if (existingStock.length > 0) {
      // If stock exists, update the quantity and calculate new average purchase price
      const currentStock = existingStock[0];
      const totalCurrentValue = currentStock.quantity * currentStock.purchase_price;
      const newValue = quantity * purchasePrice;
      const totalQuantity = currentStock.quantity + quantity;
      const averagePurchasePrice = (totalCurrentValue + newValue) / totalQuantity;

      await sql`
        UPDATE user_stocks
        SET 
          quantity = ${totalQuantity},
          purchase_price = ${averagePurchasePrice}
        WHERE id = ${currentStock.id}
      `;
    } else {
      // If stock doesn't exist, insert new record
      await sql`
        INSERT INTO user_stocks (
          user_id,
          symbol,
          company_name,
          quantity,
          purchase_price,
          purchase_date
        ) VALUES (
          ${userId},
          ${symbol},
          ${companyName},
          ${quantity},
          ${purchasePrice},
          ${purchaseDate}
        )
      `;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error adding stock to portfolio:", error);
    return NextResponse.json(
      { error: "Failed to add stock to portfolio" },
      { status: 500 }
    );
  }
} 