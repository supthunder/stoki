// This script seeds the database with politician portfolio data
// Based on congressional trading information from https://www.quiverquant.com/congresstrading/

// Load environment variables
require('dotenv').config({ path: '.env.local' });

// Dynamic import for ESM compatibility
const importDependencies = async () => {
  try {
    // Try ESM style first
    const { neon } = await import('@neondatabase/serverless');
    const bcrypt = await import('bcrypt');
    return { neon, hash: bcrypt.hash };
  } catch (err) {
    // Fall back to CommonJS
    const neon = require('@neondatabase/serverless').neon;
    const { hash } = require('bcrypt');
    return { neon, hash };
  }
};

// Create SQL client directly (similar to lib/db.ts but inline)
const createSqlClient = () => {
  const url = 
    process.env.DATABASE_URL || 
    process.env.POSTGRES_URL || 
    process.env.POSTGRES_URL_NON_POOLING;
  
  if (!url) {
    throw new Error('Database connection string missing. Please check your environment variables.');
  }
  
  // Will be defined in the scope where this is called
  return neon(url);
};

// Function to seed the database with politician data
async function seedCongressData() {
  try {
    // Import dependencies dynamically
    const { neon, hash } = await importDependencies();
    
    // Make neon available to createSqlClient
    global.neon = neon;
    
    const sql = createSqlClient();
    console.log('Connected to database');

    // Create users for the politicians
    const politicianUsers = [
      {
        username: 'Daniel Meuser (R)',
        party: 'Republican',
        chamber: 'House',
      },
      {
        username: 'Nancy Pelosi (D)',
        party: 'Democratic',
        chamber: 'House',
      },
      {
        username: 'Tina Smith (D)',
        party: 'Democratic',
        chamber: 'Senate',
      },
      {
        username: 'Thomas R. Carper (D)',
        party: 'Democratic',
        chamber: 'Senate',
      },
      {
        username: 'Josh Gottheimer (D)',
        party: 'Democratic',
        chamber: 'House',
      },
    ];

    // Add users to the database
    for (const politician of politicianUsers) {
      const existingUser = await sql`
        SELECT id FROM users WHERE username = ${politician.username}
      `;

      if (existingUser.length === 0) {
        await sql`
          INSERT INTO users (username, created_at)
          VALUES (${politician.username}, NOW())
        `;
        console.log(`Added user: ${politician.username}`);
      } else {
        console.log(`User ${politician.username} already exists`);
      }
    }

    // Get user IDs for the politicians
    const usernames = politicianUsers.map(p => p.username);
    console.log('Looking for users with usernames:', usernames);
    
    // Get users one by one to avoid SQL array syntax issues
    const users = [];
    for (const username of usernames) {
      const result = await sql`
        SELECT id, username FROM users
        WHERE username = ${username}
      `;
      if (result.length > 0) {
        users.push(result[0]);
      }
    }
    
    console.log('Users found in database:', users);

    // Create a map of username to user ID
    const userIdMap = {};
    for (const user of users) {
      userIdMap[user.username] = user.id;
    }
    
    console.log('User ID map:', userIdMap);

    // Stock holdings data based on congressional trading
    // This is sample data based on known congressional trading patterns
    const stockHoldings = [
      // Daniel Meuser's portfolio
      {
        username: 'Daniel Meuser (R)',
        stocks: [
          { symbol: 'ACN', companyName: 'Accenture Plc', quantity: 150, purchasePrice: 334.21, purchaseDate: '2024-02-13' },
          { symbol: 'INTC', companyName: 'Intel Corporation', quantity: 500, purchasePrice: 43.27, purchaseDate: '2023-11-15' },
          { symbol: 'MSFT', companyName: 'Microsoft Corporation', quantity: 200, purchasePrice: 315.45, purchaseDate: '2024-01-15' },
          { symbol: 'JNJ', companyName: 'Johnson & Johnson', quantity: 100, purchasePrice: 147.52, purchaseDate: '2023-10-06' },
          { symbol: 'XOM', companyName: 'Exxon Mobil Corporation', quantity: 300, purchasePrice: 112.34, purchaseDate: '2023-12-12' }
        ]
      },
      // Nancy Pelosi's portfolio
      {
        username: 'Nancy Pelosi (D)',
        stocks: [
          { symbol: 'NVDA', companyName: 'NVIDIA Corporation', quantity: 400, purchasePrice: 680.45, purchaseDate: '2023-09-15' },
          { symbol: 'AAPL', companyName: 'Apple Inc.', quantity: 500, purchasePrice: 175.35, purchaseDate: '2023-10-28' },
          { symbol: 'MSFT', companyName: 'Microsoft Corporation', quantity: 300, purchasePrice: 330.50, purchaseDate: '2024-03-01' },
          { symbol: 'GOOGL', companyName: 'Alphabet Inc.', quantity: 200, purchasePrice: 140.32, purchaseDate: '2024-03-01' },
          { symbol: 'AMZN', companyName: 'Amazon.com Inc.', quantity: 150, purchasePrice: 175.54, purchaseDate: '2023-11-20' },
          { symbol: 'TSLA', companyName: 'Tesla, Inc.', quantity: 100, purchasePrice: 175.34, purchaseDate: '2023-12-05' }
        ]
      },
      // Tina Smith's portfolio
      {
        username: 'Tina Smith (D)',
        stocks: [
          { symbol: 'PFE', companyName: 'Pfizer Inc.', quantity: 300, purchasePrice: 28.34, purchaseDate: '2023-10-10' },
          { symbol: 'JNJ', companyName: 'Johnson & Johnson', quantity: 150, purchasePrice: 152.45, purchaseDate: '2023-11-22' },
          { symbol: 'UNH', companyName: 'UnitedHealth Group Inc.', quantity: 100, purchasePrice: 490.32, purchaseDate: '2024-01-05' },
          { symbol: 'MRK', companyName: 'Merck & Co., Inc.', quantity: 200, purchasePrice: 105.67, purchaseDate: '2023-12-15' }
        ]
      },
      // Thomas Carper's portfolio
      {
        username: 'Thomas R. Carper (D)',
        stocks: [
          { symbol: 'XOM', companyName: 'Exxon Mobil Corporation', quantity: 250, purchasePrice: 110.45, purchaseDate: '2023-09-20' },
          { symbol: 'CVX', companyName: 'Chevron Corporation', quantity: 200, purchasePrice: 155.32, purchaseDate: '2023-10-15' },
          { symbol: 'COP', companyName: 'ConocoPhillips', quantity: 300, purchasePrice: 115.67, purchaseDate: '2023-11-10' },
          { symbol: 'PSX', companyName: 'Phillips 66', quantity: 150, purchasePrice: 135.45, purchaseDate: '2024-02-05' }
        ]
      },
      // Josh Gottheimer's portfolio
      {
        username: 'Josh Gottheimer (D)',
        stocks: [
          { symbol: 'GS', companyName: 'Goldman Sachs Group Inc.', quantity: 100, purchasePrice: 380.45, purchaseDate: '2023-10-05' },
          { symbol: 'JPM', companyName: 'JPMorgan Chase & Co.', quantity: 200, purchasePrice: 175.32, purchaseDate: '2023-11-15' },
          { symbol: 'MS', companyName: 'Morgan Stanley', quantity: 300, purchasePrice: 85.67, purchaseDate: '2023-12-20' },
          { symbol: 'BAC', companyName: 'Bank of America Corporation', quantity: 400, purchasePrice: 35.45, purchaseDate: '2024-01-10' }
        ]
      }
    ];

    // Add stocks to the database
    for (const portfolio of stockHoldings) {
      const userId = userIdMap[portfolio.username];
      console.log(`Looking for user ID for ${portfolio.username}. Found: ${userId}`);
      
      if (!userId) {
        console.warn(`Could not find user ID for portfolio: ${portfolio.username}`);
        continue;
      }

      for (const stock of portfolio.stocks) {
        // Check if this stock already exists for this user
        const existingStock = await sql`
          SELECT id FROM user_stocks 
          WHERE user_id = ${userId} AND symbol = ${stock.symbol}
        `;

        if (existingStock.length === 0) {
          await sql`
            INSERT INTO user_stocks (
              user_id, symbol, company_name, quantity, 
              purchase_price, purchase_date
            ) VALUES (
              ${userId}, ${stock.symbol}, ${stock.companyName}, ${stock.quantity}, 
              ${stock.purchasePrice}, ${stock.purchaseDate}
            )
          `;
          console.log(`Added stock ${stock.symbol} for user ID ${userId}`);
        } else {
          console.log(`Stock ${stock.symbol} already exists for user ID ${userId}`);
        }
      }
    }

    console.log('Database seeded successfully with congressional trading data');
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  }
}

// Execute the seed function
seedCongressData().then(() => {
  console.log('Seed script completed');
  process.exit(0);
}).catch(error => {
  console.error('Seed script failed:', error);
  process.exit(1);
}); 