import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET() {
  try {
    // Get column information for Portfolio
    const tableInfo = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'Portfolio'
      ORDER BY ordinal_position;
    `;

    // Get a sample row to see data structure
    const sampleData = await sql`
      SELECT * FROM "Portfolio" LIMIT 1;
    `;

    return NextResponse.json({
      columns: tableInfo.rows,
      sample: sampleData.rows[0] || null
    });
  } catch (error) {
    console.error('Error fetching Portfolio structure:', error);
    return NextResponse.json({ error: 'Failed to fetch Portfolio structure' }, { status: 500 });
  }
} 