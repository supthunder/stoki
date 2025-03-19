# GitHub Actions Portfolio Updates

This repository uses GitHub Actions to automatically update portfolio data during market hours. The workflow runs hourly from 9 AM to 4 PM ET on weekdays (Monday through Friday).

## Setup Instructions

1. **Add Required Secrets to GitHub Repository**:
   - Go to your GitHub repository
   - Navigate to Settings > Secrets and variables > Actions
   - Add the following secrets:
     - `DATABASE_URL`: Your Postgres database connection string from Vercel/Neon
     - `REDIS_URL`: Your Redis connection string from Vercel/Upstash
     - `CRON_SECRET`: The same secret you use in your Vercel environment
     - `VERCEL_URL`: Your Vercel app URL

2. **Workflow Configuration**:
   - The workflow is configured to run hourly during market hours (9 AM - 4 PM ET)
   - This matches the cron expression: `"0 13-20 * * 1-5"`
   - You can also manually trigger the workflow from the Actions tab

3. **Verify Setup**:
   - After adding the secrets and pushing the code to your repository:
     - Go to the Actions tab
     - You should see the "Update Portfolio Data" workflow
     - You can manually trigger it to test that everything works correctly

## How It Works

The workflow script:

1. Fetches stock prices from Yahoo Finance
2. Updates user portfolio values
3. Caches data in Redis
4. Updates the database with portfolio information

This replaces the previous Vercel cron job setup, providing more reliable and frequent updates during market hours. 