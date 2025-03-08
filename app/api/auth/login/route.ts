import { NextRequest, NextResponse } from "next/server";
import { createUser, ensureAvatarColumn } from "@/lib/db";

// Add this to prevent static generation of this API route
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { username } = await request.json();
    
    if (!username || typeof username !== 'string' || username.trim() === '') {
      return NextResponse.json(
        { success: false, message: "Username is required" },
        { status: 400 }
      );
    }

    // Ensure the avatar column exists
    await ensureAvatarColumn();

    const user = await createUser(username.trim());
    
    return NextResponse.json({ 
      success: true, 
      user: {
        id: user.id,
        username: user.username,
        avatar: user.avatar || null
      }
    });
  } catch (error) {
    console.error("Error during login:", error);
    return NextResponse.json(
      { success: false, message: "Failed to login", error: String(error) },
      { status: 500 }
    );
  }
} 