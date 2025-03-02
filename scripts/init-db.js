#!/usr/bin/env node

// This script initializes the Stoki database by creating the necessary tables
// Run with: node scripts/init-db.js

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

// Get database URL from environment variables and validate it
function getDatabaseUrl() {
  const url = 
    process.env.DATABASE_URL || 
    process.env.POSTGRES_URL || 
    process.env.POSTGRES_URL_NON_POOLING;

  if (!url) {
    console.error('Error: Database connection string missing');
    console.error('Make sure one of these environment variables is set:');
    console.error('- DATABASE_URL');
    console.error('- POSTGRES_URL');
    console.error('- POSTGRES_URL_NON_POOLING');
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
    console.error('Error: Invalid database URL format');
    console.error('The connection string must be a valid URL');
    return null;
  }
}

async function initializeDb() {
  const databaseUrl = getDatabaseUrl();
  
  if (!databaseUrl) {
    process.exit(1);
  }

  console.log('Connecting to database...');
  try {
    const sql = neon(databaseUrl);

    console.log('Creating users table...');
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    console.log('Creating user_stocks table...');
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

    console.log('✅ Database initialized successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    process.exit(1);
  }
}

// Run the initialization
initializeDb(); 