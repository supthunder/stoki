import { NextResponse } from "next/server";
import { initializeDb } from "@/lib/db";

export async function GET() {
  try {
    await initializeDb();
    return NextResponse.json({ success: true, message: "Database initialized successfully" });
  } catch (error) {
    console.error("Error initializing database:", error);
    return NextResponse.json(
      { success: false, message: "Failed to initialize database", error: String(error) },
      { status: 500 }
    );
  }
} 