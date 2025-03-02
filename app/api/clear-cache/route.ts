import { NextResponse } from "next/server";
import { getRedisClient } from "@/lib/redis";

export async function GET(request: Request) {
  try {
    // Initialize Redis client
    const redis = await getRedisClient();
    
    if (!redis) {
      return NextResponse.json(
        { error: "Redis client not available" },
        { status: 500 }
      );
    }
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (userId) {
      // Clear cache for specific user
      console.log(`Clearing cache for user ${userId}`);
      
      // Get all keys for this user's performance data
      const keys = await redis.keys(`portfolio_performance_${userId}_*`);
      console.log(`Found ${keys.length} cache entries for user ${userId}`);
      
      // Delete each key
      let deletedCount = 0;
      for (const key of keys) {
        await redis.del(key);
        deletedCount++;
      }
      
      // Clear historical value cache for this user's stocks
      const histKeys = await redis.keys(`historical_value_*`);
      const todayStr = new Date().toISOString().split('T')[0];
      
      // Only delete today's historical values to force refresh
      for (const key of histKeys) {
        if (key.includes(todayStr)) {
          await redis.del(key);
          deletedCount++;
        }
      }
      
      return NextResponse.json({ 
        success: true,
        message: `Cleared ${deletedCount} cache entries for user ${userId}` 
      });
    } else {
      // Clear all performance cache
      console.log("Clearing all portfolio performance cache");
      
      // Get all performance keys
      const perfKeys = await redis.keys("portfolio_performance_*");
      console.log(`Found ${perfKeys.length} portfolio performance cache entries`);
      
      // Delete each key
      let deletedCount = 0;
      for (const key of perfKeys) {
        await redis.del(key);
        deletedCount++;
      }
      
      // Clear today's historical value cache
      const histKeys = await redis.keys(`historical_value_*`);
      const todayStr = new Date().toISOString().split('T')[0];
      
      for (const key of histKeys) {
        if (key.includes(todayStr)) {
          await redis.del(key);
          deletedCount++;
        }
      }
      
      return NextResponse.json({
        success: true,
        message: `Cleared ${deletedCount} cache entries`
      });
    }
  } catch (error) {
    console.error("Error clearing cache:", error);
    return NextResponse.json(
      { error: "Failed to clear cache" },
      { status: 500 }
    );
  }
} 