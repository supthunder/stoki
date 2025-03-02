import { NextRequest, NextResponse } from "next/server";
import { getUserByUsername } from "@/lib/db";

// Add this to prevent static generation of this API route
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { username } = await request.json();
    
    if (!username || typeof username !== 'string') {
      return NextResponse.json(
        { success: false, message: "Username is required" },
        { status: 400 }
      );
    }

    const user = await getUserByUsername(username);
    
    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ 
      success: true, 
      user: {
        id: user.id,
        username: user.username
      }
    });
  } catch (error) {
    console.error("Error verifying user:", error);
    return NextResponse.json(
      { success: false, message: "Failed to verify user", error: String(error) },
      { status: 500 }
    );
  }
} 