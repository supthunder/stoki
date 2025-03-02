import { NextResponse } from "next/server";
import { neon } from '@neondatabase/serverless';

// Add this to prevent static generation of this API route
export const dynamic = 'force-dynamic';

// Get database URL from environment variables and validate it
function getDatabaseUrl() {
  const url = 
    process.env.DATABASE_URL || 
    process.env.POSTGRES_URL || 
    process.env.POSTGRES_URL_NON_POOLING;

  if (!url) {
    return null;
  }

  // Basic URL validation
  try {
    // Only validate URL if it's a proper URL (not a socket path)
    if (url.startsWith('postgres://') || url.startsWith('postgresql://')) {
      new URL(url);
    }
    return url;
  } catch (error) {
    console.error('Error: Invalid database URL format:', error);
    return null;
  }
}

export async function GET() {
  try {
    // Check environment variables
    const connectionVars = {
      POSTGRES_URL: process.env.POSTGRES_URL ? "✅ Present" : "❌ Missing",
      POSTGRES_URL_NON_POOLING: process.env.POSTGRES_URL_NON_POOLING ? "✅ Present" : "❌ Missing",
      DATABASE_URL: process.env.DATABASE_URL ? "✅ Present" : "❌ Missing",
    };
    
    const databaseUrl = getDatabaseUrl();
    if (!databaseUrl) {
      return NextResponse.json({
        success: false,
        message: "No database connection string found in environment variables or invalid URL",
        environmentCheck: connectionVars
      }, { status: 500 });
    }

    // Create a SQL client with the Neon serverless driver
    const sql = neon(databaseUrl);
    
    // Try to execute a simple query
    const result = await sql`SELECT 1 as connection_test`;
    
    if (result && result.length > 0) {
      return NextResponse.json({
        success: true, 
        message: "Database connection successful", 
        environmentCheck: connectionVars
      });
    } else {
      return NextResponse.json({
        success: false, 
        message: "Database query did not return expected result", 
        environmentCheck: connectionVars
      }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({
      success: false, 
      message: "Failed to connect to database", 
      error: error instanceof Error ? error.message : String(error),
      environmentCheck: {
        POSTGRES_URL: process.env.POSTGRES_URL ? "✅ Present" : "❌ Missing",
        POSTGRES_URL_NON_POOLING: process.env.POSTGRES_URL_NON_POOLING ? "✅ Present" : "❌ Missing",
        DATABASE_URL: process.env.DATABASE_URL ? "✅ Present" : "❌ Missing",
      }
    }, { status: 500 });
  }
} 