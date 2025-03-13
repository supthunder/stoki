# GitHub Actions Workflow for Portfolio Updates

This repository contains a GitHub Actions workflow that automatically updates portfolio data by calling the API endpoint.

## Setup Instructions

1. **Add Required Secrets to GitHub Repository**:
   - Go to your GitHub repository
   - Navigate to Settings > Secrets and variables > Actions
   - Add the following secrets:
     - `CRON_SECRET`: The same secret used in your Vercel environment
     - `API_URL`: Your application's base URL (e.g., https://yourdomain.com)

2. **Workflow Configuration**:
   - The workflow is configured to run every hour from 9 AM to 4 PM on weekdays (market hours)
   - This matches the previous Vercel cron schedule: "0 9-16 * * 1-5"
   - You can also trigger the workflow manually using the "Run workflow" button in the Actions tab

3. **Verify Setup**:
   - After adding the secrets, go to the Actions tab in your repository
   - You should see the "Update Portfolio Data" workflow
   - You can manually trigger it to test if it works correctly

## How It Works

The workflow sends an HTTP request to your API endpoint with the proper authorization header. The endpoint then:

1. Fetches stock data from Yahoo Finance
2. Updates user portfolio values
3. Caches data in Redis
4. Updates the database with the latest portfolio information

This replaces the Vercel cron job with GitHub Actions, which allows for more frequent updates and better control over the scheduling. 