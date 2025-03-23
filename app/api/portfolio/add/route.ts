import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function POST(request: Request) {
  try {
    const { userId, symbol, quantity, purchasePrice, assetType = 'stock' } = await request.json();

    if (!userId || !symbol || !quantity || !purchasePrice) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Use the symbol format to distinguish between stocks and crypto
    // For crypto, prepend with @ to make it distinguishable
    const formattedSymbol = assetType === 'crypto' ? `@${symbol.toLowerCase()}` : symbol.toUpperCase();
    
    // Convert values to numbers
    const qtyNum = Number(quantity);
    const priceNum = Number(purchasePrice);
    const totalValue = qtyNum * priceNum;

    // First check if the asset already exists for this user
    const existingAsset = await sql`
      SELECT * FROM "Portfolio" 
      WHERE "userId" = ${userId} AND symbol = ${formattedSymbol};
    `;

    let result;
    
    if (existingAsset.rowCount > 0) {
      // Update existing asset
      const existing = existingAsset.rows[0];
      const newQuantity = existing.quantity + qtyNum;
      
      // Calculate new average cost
      const totalCost = (existing.quantity * existing.avgCost) + (qtyNum * priceNum);
      const newAvgCost = totalCost / newQuantity;
      
      result = await sql`
        UPDATE "Portfolio"
        SET 
          quantity = ${newQuantity},
          "avgCost" = ${newAvgCost},
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE "userId" = ${userId} AND symbol = ${formattedSymbol}
        RETURNING *;
      `;
    } else {
      // Insert new asset
      result = await sql`
        INSERT INTO "Portfolio" (id, symbol, quantity, "avgCost", "userId")
        VALUES (
          gen_random_uuid(),
          ${formattedSymbol},
          ${qtyNum},
          ${priceNum},
          ${userId}
        )
        RETURNING *;
      `;
    }

    // Add transaction record
    try {
      await sql`
        INSERT INTO transactions (user_id, symbol, quantity, price, type, asset_type)
        VALUES (${userId}, ${formattedSymbol}, ${qtyNum}, ${priceNum}, 'buy', ${assetType});
      `;
    } catch (err) {
      console.warn('Could not add asset_type to transactions, trying without it:', err);
      await sql`
        INSERT INTO transactions (user_id, symbol, quantity, price, type)
        VALUES (${userId}, ${formattedSymbol}, ${qtyNum}, ${priceNum}, 'buy');
      `;
    }

    // Update portfolio summary
    try {
      // Check if summary exists
      const existingSummary = await sql`
        SELECT * FROM portfolio_summaries WHERE user_id = ${userId};
      `;

      if (existingSummary.rowCount > 0) {
        // Update existing summary
        if (assetType === 'crypto') {
          await sql`
            UPDATE portfolio_summaries
            SET 
              total_crypto_value = COALESCE(total_crypto_value, 0) + ${totalValue},
              total_current_value = COALESCE(total_current_value, 0) + ${totalValue},
              total_purchase_value = COALESCE(total_purchase_value, 0) + ${totalValue},
              last_updated = CURRENT_TIMESTAMP
            WHERE user_id = ${userId};
          `;
        } else {
          await sql`
            UPDATE portfolio_summaries
            SET 
              total_stock_value = COALESCE(total_stock_value, 0) + ${totalValue},
              total_current_value = COALESCE(total_current_value, 0) + ${totalValue},
              total_purchase_value = COALESCE(total_purchase_value, 0) + ${totalValue},
              last_updated = CURRENT_TIMESTAMP
            WHERE user_id = ${userId};
          `;
        }
      } else {
        // Create new summary
        if (assetType === 'crypto') {
          await sql`
            INSERT INTO portfolio_summaries (
              user_id, total_crypto_value, total_current_value, total_purchase_value, last_updated
            ) VALUES (
              ${userId}, ${totalValue}, ${totalValue}, ${totalValue}, CURRENT_TIMESTAMP
            );
          `;
        } else {
          await sql`
            INSERT INTO portfolio_summaries (
              user_id, total_stock_value, total_current_value, total_purchase_value, last_updated
            ) VALUES (
              ${userId}, ${totalValue}, ${totalValue}, ${totalValue}, CURRENT_TIMESTAMP
            );
          `;
        }
      }
    } catch (err) {
      console.error('Error updating portfolio summary:', err);
      // Continue even if summary update fails
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error adding asset to portfolio:', error);
    return NextResponse.json(
      { error: 'Failed to add asset to portfolio' },
      { status: 500 }
    );
  }
} 