import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function DELETE(request: Request) {
  try {
    // Get the stock ID from the query parameters
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Stock ID is required" },
        { status: 400 }
      );
    }

    // Delete the stock from user_stocks table
    const result = await sql`
      DELETE FROM user_stocks 
      WHERE id = ${id}
      RETURNING id
    `;
    
    // Check if any rows were affected
    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: "Stock not found" },
        { status: 404 }
      );
    }
    
    // Try to delete from transaction history if it exists
    try {
      await sql`
        DELETE FROM transactions
        WHERE id = ${id}
      `;
    } catch (err) {
      // Ignore errors here, it's optional and we don't want to fail the whole request
      console.warn('Could not delete transaction record:', err);
    }
    
    return NextResponse.json({ 
      success: true,
      message: "Stock deleted successfully",
      deletedId: id
    });
  } catch (error) {
    console.error("Error deleting stock:", error);
    return NextResponse.json(
      { error: "Failed to delete stock" },
      { status: 500 }
    );
  }
} 