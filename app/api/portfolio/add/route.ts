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

    // First check if the user exists
    let userExists = false;
    try {
      // Check if the user exists in the users table (lowercase - as shown in the database structure)
      const userCheck = await sql`
        SELECT EXISTS(SELECT 1 FROM users WHERE id = ${userId}) AS exists;
      `;
      userExists = userCheck.rows[0]?.exists === true;
      
      if (!userExists) {
        return NextResponse.json(
          { error: `User with ID ${userId} not found in database` },
          { status: 404 }
        );
      }
    } catch (e: any) {
      console.warn('Error checking user existence:', e);
      // Continue anyway, as the user might exist but there's a query issue
    }

    // Now handle the user_stocks table (using snake_case as in the database)
    try {
      // Check if the asset already exists for this user
      const existingAsset = await sql`
        SELECT * FROM user_stocks 
        WHERE user_id = ${userId} AND symbol = ${formattedSymbol};
      `;

      let result;
      
      if (existingAsset?.rowCount && existingAsset.rowCount > 0) {
        // Update existing asset
        const existing = existingAsset.rows[0];
        const newQuantity = Number(existing.quantity) + qtyNum;
        
        // Calculate new average cost based on total investment
        const totalCost = (Number(existing.quantity) * Number(existing.purchase_price)) + (qtyNum * priceNum);
        const newAvgCost = totalCost / newQuantity;
        
        result = await sql`
          UPDATE user_stocks
          SET 
            quantity = ${newQuantity},
            purchase_price = ${newAvgCost}
          WHERE user_id = ${userId} AND symbol = ${formattedSymbol}
          RETURNING *;
        `;
      } else {
        // Insert new asset with the structure matching your database
        result = await sql`
          INSERT INTO user_stocks (user_id, symbol, company_name, quantity, purchase_price, purchase_date, asset_type)
          VALUES (
            ${userId},
            ${formattedSymbol},
            ${assetType === 'crypto' ? symbol : ''},
            ${qtyNum},
            ${priceNum},
            CURRENT_TIMESTAMP,
            ${assetType}
          )
          RETURNING *;
        `;
      }

      // Add transaction record if that table exists
      try {
        await sql`
          INSERT INTO transactions (user_id, symbol, quantity, price, type, asset_type)
          VALUES (${userId}, ${formattedSymbol}, ${qtyNum}, ${priceNum}, 'buy', ${assetType});
        `;
      } catch (err) {
        console.warn('Could not add transaction record:', err);
        // Don't fail the whole request just because transaction log failed
      }

      return NextResponse.json(result?.rows?.[0] || { success: true });
    } catch (dbError: any) {
      console.error('Database error when adding asset:', dbError);
      return NextResponse.json(
        { error: 'Failed to add asset to portfolio', details: dbError.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error adding asset to portfolio:', error);
    return NextResponse.json(
      { error: 'Failed to add asset to portfolio', details: error.message },
      { status: 500 }
    );
  }
} 