# Stoki - Social Stock Trading App

A modern social stock trading application that allows users to track their portfolios and compete with others. Built with Next.js 14, React.js, Shadcn UI, and Tailwind CSS.

## Features

- **User Leaderboard**: See how your portfolio performs compared to others
- **Portfolio Tracking**: Monitor your stock investments in real-time
- **Stock Data**: Powered by Yahoo Finance API for real-time quotes and historical data
- **Social Features**: Share your investment strategies and follow other traders

## Tech Stack

- **Frontend**: Next.js 14, React.js, Tailwind CSS
- **UI Components**: Shadcn UI, Radix UI
- **Data Visualization**: Recharts, Visx
- **State Management**: Zustand
- **Data Source**: Yahoo Finance API

## Getting Started

First, install the dependencies:

```bash
npm install
# or
yarn install
# or
pnpm install
```

Then, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Deployment

This project is designed to be deployed on Vercel.

## Database Setup

1. Create a new Postgres database in the Vercel dashboard:
   - Log in to your Vercel account and go to your project
   - Navigate to the "Storage" tab
   - Select "Create New" and choose "Postgres"
   - Follow the prompts to create a new database

2. Configure your local environment:
   - In your Vercel project, go to the "Storage" tab, select your database
   - Find your connection strings in the "Quickstart" tab
   - Copy these values to your local `.env.local` file

3. Initialize the database:
   - Run the initialization script to create the necessary tables:
   ```bash
   node scripts/init-db.js
   ```
   - The script will create the users and user_stocks tables if they don't exist

4. If you encounter connection issues:
   - Make sure your Vercel Postgres connection strings are correct in your `.env.local` file
   - Check if your IP address is allowed in the Vercel Postgres dashboard
   - Try the API endpoint directly at `/api/init-db` if the script doesn't work

## Environment Variables

Your `.env.local` file should include the following variables:

```
# Vercel Postgres or Neon database URL
DATABASE_URL=your_database_connection_string

# Alternatively, these variables are supported
POSTGRES_URL=your_postgres_connection_string
POSTGRES_URL_NON_POOLING=your_postgres_non_pooling_connection_string
```

## License

[MIT](LICENSE) 