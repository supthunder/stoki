import { NextResponse } from "next/server";
import * as db from "@/lib/db";
import * as redis from "@/lib/redis";
import yahooFinance from "yahoo-finance2";

export async function PUT(request: Request) {
  try {
    const { stockId, userId, quantity, purchasePrice, purchaseDate } = await request.json();

    // Validate inputs
    if (!stockId || !userId || !quantity || !purchasePrice || !purchaseDate) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      );
    }

    // Update the stock in the database with all properties
    const updatedStock = await db.updateStock(
      stockId,
      userId,
      quantity,
      purchasePrice,
      purchaseDate
    );

    if (!updatedStock) {
      return NextResponse.json(
        { message: "Stock not found or you don't have permission to edit it" },
        { status: 404 }
      );
    }

    // Clear the user's portfolio cache to ensure fresh data on next fetch
    const redisClient = await redis.getRedisClient();
    if (redisClient) {
      await redisClient.del(`portfolio:${userId}`);
    }

    // Return success response
    return NextResponse.json({
      message: "Stock updated successfully",
      stock: updatedStock,
    });
  } catch (error) {
    console.error("Error updating stock:", error);
    return NextResponse.json(
      { message: "Failed to update stock" },
      { status: 500 }
    );
  }
} 