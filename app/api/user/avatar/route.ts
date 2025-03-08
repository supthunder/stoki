import { NextRequest, NextResponse } from "next/server";
import { updateUserAvatar, ensureAvatarColumn } from "@/lib/db";

// Add this to prevent static generation of this API route
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { userId, avatarUrl } = await request.json();
    
    if (!userId || !avatarUrl) {
      return NextResponse.json(
        { success: false, message: "User ID and avatar URL are required" },
        { status: 400 }
      );
    }

    // Ensure the avatar column exists
    await ensureAvatarColumn();

    const user = await updateUserAvatar(userId, avatarUrl);
    
    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found or avatar column does not exist" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ 
      success: true, 
      user: {
        id: user.id,
        username: user.username,
        avatar: user.avatar || null
      }
    });
  } catch (error) {
    console.error("Error updating user avatar:", error);
    return NextResponse.json(
      { success: false, message: "Failed to update avatar", error: String(error) },
      { status: 500 }
    );
  }
} 