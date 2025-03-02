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

Stoki uses Vercel Postgres for data storage. Follow these steps to set up your database:

1. Create a new Postgres database in your Vercel dashboard:
   - Go to your Vercel dashboard
   - Select your project
   - Go to the 'Storage' tab
   - Click 'Create' and select Postgres
   - Follow the instructions to create your database

2. Configure your local environment with the database connection strings:
   - In your Vercel project, go to the 'Storage' tab and select your database
   - In the 'Quickstart' tab, find the '.env.local' section
   - Copy all values from there to your local `.env.local` file
   - Make sure to replace all placeholder values in the file

3. Initialize the database tables:
   - When you run the application for the first time, it will attempt to create the necessary tables
   - If you see the error "Failed to initialize database", check your database connection strings
   - You can also manually initialize the database by visiting `/api/init-db` in your browser

Note: The database initialization error is shown when the app can't connect to or initialize your Postgres database. Make sure your environment variables are set up correctly.

## License

[MIT](LICENSE) 