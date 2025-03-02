// This script seeds the database with politician portfolio data
// Based on congressional trading information from https://www.quiverquant.com/congresstrading/

import { createSqlClient } from '../lib/db';
import { hash } from 'bcrypt';

// Type definitions
type Politician = {
  username: string;
  email: string;
  party: string;
  chamber: string;
  password: string;
};

type Stock = {
  symbol: string;
  companyName: string;
  quantity: number;
  purchasePrice: number;
  purchaseDate: string;
};

type Portfolio = {
  userId: number | undefined;
  stocks: Stock[];
};

type UserMap = {
  [username: string]: number;
};

// Function to seed the database with politician data
async function seedCongressData() {
  try {
    const sql = createSqlClient();
    console.log('Connected to database');

    // Create users for the politicians
    const politicianUsers: Politician[] = [
      {
        username: 'Daniel Meuser',
        email: 'dmeuser@example.gov',
        party: 'Republican',
        chamber: 'House',
        password: 'password123', // In a real app, use proper password handling
      },
      {
        username: 'Nancy Pelosi',
        email: 'npelosi@example.gov',
        party: 'Democratic',
        chamber: 'House',
        password: 'password123',
      },
      {
        username: 'Tina Smith',
        email: 'tsmith@example.gov',
        party: 'Democratic',
        chamber: 'Senate',
        password: 'password123',
      },
      {
        username: 'Thomas R. Carper',
        email: 'tcarper@example.gov',
        party: 'Democratic',
        chamber: 'Senate',
        password: 'password123',
      },
      {
        username: 'Josh Gottheimer',
        email: 'jgottheimer@example.gov',
        party: 'Democratic',
        chamber: 'House',
        password: 'password123',
      },
    ];

    // Add users to the database
    for (const politician of politicianUsers) {
      const passwordHash = await hash(politician.password, 10);
      const existingUser = await sql`
        SELECT id FROM users WHERE email = ${politician.email}
      `;

      if (existingUser.length === 0) {
        await sql`
          INSERT INTO users (username, email, password_hash, created_at)
          VALUES (${politician.username}, ${politician.email}, ${passwordHash}, NOW())
        `;
        console.log(`Added user: ${politician.username}`);
      } else {
        console.log(`User ${politician.username} already exists`);
      }
    }

    // Get user IDs for the politicians
    const users = await sql`
      SELECT id, username FROM users
      WHERE username IN (${politicianUsers.map(p => p.username)})
    `;

    // Create a map of username to user ID
    const userIdMap: UserMap = {};
    for (const user of users) {
      userIdMap[user.username] = user.id;
    }

    // Stock holdings data based on congressional trading
    // This is sample data based on known congressional trading patterns
    const stockHoldings: Portfolio[] = [
      // Daniel Meuser's portfolio
      {
        userId: userIdMap['Daniel Meuser'],
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
        userId: userIdMap['Nancy Pelosi'],
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
        userId: userIdMap['Tina Smith'],
        stocks: [
          { symbol: 'UNH', companyName: 'UnitedHealth Group Inc.', quantity: 75, purchasePrice: 492.21, purchaseDate: '2023-08-10' },
          { symbol: 'JNJ', companyName: 'Johnson & Johnson', quantity: 150, purchasePrice: 147.52, purchaseDate: '2023-09-22' },
          { symbol: 'PG', companyName: 'The Procter & Gamble Company', quantity: 200, purchasePrice: 160.01, purchaseDate: '2023-11-15' },
          { symbol: 'ABBV', companyName: 'AbbVie Inc.', quantity: 125, purchasePrice: 175.00, purchaseDate: '2024-01-12' }
        ]
      },
      // Thomas R. Carper's portfolio
      {
        userId: userIdMap['Thomas R. Carper'],
        stocks: [
          { symbol: 'XOM', companyName: 'Exxon Mobil Corporation', quantity: 400, purchasePrice: 112.34, purchaseDate: '2023-10-18' },
          { symbol: 'CVX', companyName: 'Chevron Corporation', quantity: 300, purchasePrice: 148.50, purchaseDate: '2023-12-07' },
          { symbol: 'DUK', companyName: 'Duke Energy Corporation', quantity: 250, purchasePrice: 95.20, purchaseDate: '2024-02-09' },
          { symbol: 'SO', companyName: 'The Southern Company', quantity: 350, purchasePrice: 70.45, purchaseDate: '2023-11-30' },
          { symbol: 'NEE', companyName: 'NextEra Energy, Inc.', quantity: 200, purchasePrice: 60.15, purchaseDate: '2024-01-22' }
        ]
      },
      // Josh Gottheimer's portfolio
      {
        userId: userIdMap['Josh Gottheimer'],
        stocks: [
          { symbol: 'JPM', companyName: 'JPMorgan Chase & Co.', quantity: 200, purchasePrice: 183.98, purchaseDate: '2023-09-08' },
          { symbol: 'BAC', companyName: 'Bank of America Corporation', quantity: 500, purchasePrice: 37.45, purchaseDate: '2023-10-15' },
          { symbol: 'GS', companyName: 'The Goldman Sachs Group, Inc.', quantity: 50, purchasePrice: 415.00, purchaseDate: '2023-12-18' },
          { symbol: 'MS', companyName: 'Morgan Stanley', quantity: 300, purchasePrice: 95.25, purchaseDate: '2024-01-30' },
          { symbol: 'C', companyName: 'Citigroup Inc.', quantity: 400, purchasePrice: 54.70, purchaseDate: '2024-02-22' }
        ]
      }
    ];

    // Add stocks to the database
    for (const portfolio of stockHoldings) {
      const userId = portfolio.userId;
      if (!userId) {
        console.log(`Could not find user ID for portfolio`);
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
              purchase_price, purchase_date, created_at
            )
            VALUES (
              ${userId}, ${stock.symbol}, ${stock.companyName}, ${stock.quantity},
              ${stock.purchasePrice}, ${stock.purchaseDate}, NOW()
            )
          `;
          console.log(`Added ${stock.symbol} to portfolio for user ID ${userId}`);
        } else {
          console.log(`Stock ${stock.symbol} already exists for user ID ${userId}`);
        }
      }
    }

    console.log('Database seeded successfully with congressional trading data');
  } catch (error) {
    console.error('Error seeding database:', error);
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