import { NextResponse } from 'next/server';
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
  const databaseUrl = getDatabaseUrl();
  
  if (!databaseUrl) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Database connection string missing or invalid', 
        environmentCheck: {
          POSTGRES_URL: process.env.POSTGRES_URL ? "✅ Present" : "❌ Missing",
          POSTGRES_URL_NON_POOLING: process.env.POSTGRES_URL_NON_POOLING ? "✅ Present" : "❌ Missing",
          DATABASE_URL: process.env.DATABASE_URL ? "✅ Present" : "❌ Missing",
        }
      },
      { status: 500 }
    );
  }

  try {
    console.log('Connecting to database...');
    const sql = neon(databaseUrl);

    // Create the users table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create the user_stocks table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS user_stocks (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        symbol VARCHAR(20) NOT NULL,
        company_name VARCHAR(255),
        quantity INTEGER NOT NULL,
        purchase_price DECIMAL(10, 2) NOT NULL,
        purchase_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, symbol)
      )
    `;

    return NextResponse.json({ 
      success: true,
      message: "Database initialized successfully",
      environmentCheck: {
        POSTGRES_URL: process.env.POSTGRES_URL ? "✅ Present" : "❌ Missing",
        POSTGRES_URL_NON_POOLING: process.env.POSTGRES_URL_NON_POOLING ? "✅ Present" : "❌ Missing",
        DATABASE_URL: process.env.DATABASE_URL ? "✅ Present" : "❌ Missing",
      }
    });
  } catch (error) {
    console.error('Error initializing database:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        environmentCheck: {
          POSTGRES_URL: process.env.POSTGRES_URL ? "✅ Present" : "❌ Missing",
          POSTGRES_URL_NON_POOLING: process.env.POSTGRES_URL_NON_POOLING ? "✅ Present" : "❌ Missing",
          DATABASE_URL: process.env.DATABASE_URL ? "✅ Present" : "❌ Missing",
        }
      },
      { status: 500 }
    );
  }
} 