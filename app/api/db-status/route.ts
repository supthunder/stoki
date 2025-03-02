import { NextResponse } from "next/server";
import { createClient } from '@vercel/postgres';

export async function GET() {
  try {
    // Check environment variables
    const connectionVars = {
      POSTGRES_URL: process.env.POSTGRES_URL ? "✅ Present" : "❌ Missing",
      POSTGRES_URL_NON_POOLING: process.env.POSTGRES_URL_NON_POOLING ? "✅ Present" : "❌ Missing",
      DATABASE_URL: process.env.DATABASE_URL ? "✅ Present" : "❌ Missing",
    };
    
    // Get the first available connection string
    const connectionString = 
      process.env.POSTGRES_URL_NON_POOLING || 
      process.env.POSTGRES_URL || 
      process.env.DATABASE_URL;
      
    if (!connectionString) {
      return NextResponse.json({
        success: false,
        message: "No database connection string found in environment variables",
        environmentCheck: connectionVars
      }, { status: 500 });
    }

    // Test connection
    const db = createClient({ connectionString });
    
    // Try to execute a simple query
    const result = await db.sql`SELECT 1 as connection_test`;
    
    if (result && result.rows && result.rows.length > 0) {
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
      error: String(error),
      environmentCheck: {
        POSTGRES_URL: process.env.POSTGRES_URL ? "✅ Present" : "❌ Missing",
        POSTGRES_URL_NON_POOLING: process.env.POSTGRES_URL_NON_POOLING ? "✅ Present" : "❌ Missing",
        DATABASE_URL: process.env.DATABASE_URL ? "✅ Present" : "❌ Missing",
      }
    }, { status: 500 });
  }
} 