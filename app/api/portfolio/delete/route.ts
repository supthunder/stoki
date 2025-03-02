import { NextResponse } from "next/server";
import { createSqlClient } from "@/lib/db";

export async function DELETE(request: Request) {
  try {
    // Get the stockId from the query parameters
    const { searchParams } = new URL(request.url);
    const stockId = searchParams.get("stockId");
    const userId = searchParams.get("userId");

    if (!stockId) {
      return NextResponse.json(
        { error: "Stock ID is required" },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    const sql = createSqlClient();
    
    // Delete the stock and verify it belongs to the user
    const result = await sql`
      DELETE FROM user_stocks 
      WHERE id = ${stockId} AND user_id = ${userId}
      RETURNING id
    `;
    
    // Check if any rows were affected
    if (result.length === 0) {
      return NextResponse.json(
        { error: "Stock not found or not owned by user" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting stock:", error);
    return NextResponse.json(
      { error: "Failed to delete stock" },
      { status: 500 }
    );
  }
} 