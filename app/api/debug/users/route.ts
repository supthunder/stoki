import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

// Define types for our data
interface ColumnInfo {
  table_name: string;
  column_name: string;
  data_type: string;
}

interface ForeignKeyInfo {
  constraint_name: string;
  table_name: string;
  column_name: string;
  foreign_table_name: string; 
  foreign_column_name: string;
}

export async function GET() {
  try {
    // Try to get User table (capital U)
    let userTable;
    try {
      userTable = await sql`
        SELECT table_name, column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'User'
        ORDER BY ordinal_position;
      `;
    } catch (e) {
      console.error('Error querying User table:', e);
    }

    // Try to get users table (lowercase u)
    let usersTable;
    try {
      usersTable = await sql`
        SELECT table_name, column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'users'
        ORDER BY ordinal_position;
      `;
    } catch (e) {
      console.error('Error querying users table:', e);
    }
    
    // Get sample users from User table if exists
    let userSamples: any[] = [];
    try {
      const result = await sql`SELECT * FROM "User" LIMIT 5;`;
      userSamples = result.rows;
    } catch (e) {
      console.error('Error getting User samples:', e);
    }
    
    // Get sample users from users table if exists
    let usersSamples: any[] = [];
    try {
      const result = await sql`SELECT * FROM users LIMIT 5;`;
      usersSamples = result.rows;
    } catch (e) {
      console.error('Error getting users samples:', e);
    }
    
    // Get Portfolio foreign key details
    let foreignKeys: ForeignKeyInfo[] = [];
    try {
      const result = await sql`
        SELECT
          tc.constraint_name,
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM
          information_schema.table_constraints AS tc
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name='Portfolio';
      `;
      foreignKeys = result.rows;
    } catch (e) {
      console.error('Error getting foreign key info:', e);
    }

    return NextResponse.json({
      userTableStructure: userTable?.rows || [],
      usersTableStructure: usersTable?.rows || [],
      userSamples,
      usersSamples,
      foreignKeys
    });
  } catch (error) {
    console.error('Error fetching User information:', error);
    return NextResponse.json({ error: 'Failed to fetch User information' }, { status: 500 });
  }
} 