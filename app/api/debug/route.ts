import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    // Fetch leaderboard data
    const leaderboardResponse = await fetch(`${new URL(request.url).origin}/api/leaderboard`);
    
    if (!leaderboardResponse.ok) {
      throw new Error(`Failed to fetch leaderboard data: ${leaderboardResponse.status}`);
    }
    
    const leaderboardData = await leaderboardResponse.json();
    
    // Return the raw data
    return NextResponse.json(leaderboardData);
  } catch (error) {
    console.error("Debug API error:", error);
    return NextResponse.json({ error: "Failed to fetch debug data" }, { status: 500 });
  }
} 