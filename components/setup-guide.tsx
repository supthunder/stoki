"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, Database } from "lucide-react";

type DbStatus = {
  success: boolean;
  message: string;
  environmentCheck?: {
    POSTGRES_URL: string;
    POSTGRES_URL_NON_POOLING: string;
    DATABASE_URL: string;
  };
  error?: string;
};

export function SetupGuide() {
  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [initLoading, setInitLoading] = useState(false);

  const checkDbStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/db-status');
      const data = await response.json();
      setDbStatus(data);
    } catch (error) {
      console.error('Error checking database status:', error);
      setDbStatus({
        success: false,
        message: 'Failed to check database status',
        error: String(error)
      });
    } finally {
      setLoading(false);
    }
  };

  const initializeDatabase = async () => {
    try {
      setInitLoading(true);
      const response = await fetch('/api/init-db');
      const data = await response.json();
      
      if (data.success) {
        setInitialized(true);
      }
      
      // Also update database status
      await checkDbStatus();
    } catch (error) {
      console.error('Error initializing database:', error);
    } finally {
      setInitLoading(false);
    }
  };

  return (
    <div className="p-6 border rounded-lg shadow-sm bg-card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Database className="h-5 w-5" />
          Database Setup
        </h2>
        <Button 
          variant="outline" 
          onClick={checkDbStatus} 
          disabled={loading}
        >
          {loading ? "Checking..." : "Check Connection"}
        </Button>
      </div>

      {dbStatus && (
        <Alert variant={dbStatus.success ? "default" : "destructive"} className="mb-4">
          <div className="flex items-center gap-2">
            {dbStatus.success ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertTitle>{dbStatus.success ? "Success" : "Error"}</AlertTitle>
          </div>
          <AlertDescription className="mt-2">
            {dbStatus.message}
            {dbStatus.error && (
              <pre className="mt-2 p-2 bg-muted rounded-md text-xs overflow-auto">
                {dbStatus.error}
              </pre>
            )}
          </AlertDescription>
        </Alert>
      )}

      {dbStatus?.environmentCheck && (
        <div className="mb-4">
          <h3 className="text-sm font-medium mb-2">Environment Variables:</h3>
          <div className="grid gap-2">
            <div className="flex items-center justify-between py-1 px-2 bg-muted rounded-md">
              <span className="text-sm font-mono">POSTGRES_URL_NON_POOLING</span>
              <Badge variant={dbStatus.environmentCheck.POSTGRES_URL_NON_POOLING.includes("✅") ? "default" : "destructive"}>
                {dbStatus.environmentCheck.POSTGRES_URL_NON_POOLING}
              </Badge>
            </div>
            <div className="flex items-center justify-between py-1 px-2 bg-muted rounded-md">
              <span className="text-sm font-mono">POSTGRES_URL</span>
              <Badge variant={dbStatus.environmentCheck.POSTGRES_URL.includes("✅") ? "default" : "destructive"}>
                {dbStatus.environmentCheck.POSTGRES_URL}
              </Badge>
            </div>
            <div className="flex items-center justify-between py-1 px-2 bg-muted rounded-md">
              <span className="text-sm font-mono">DATABASE_URL</span>
              <Badge variant={dbStatus.environmentCheck.DATABASE_URL.includes("✅") ? "default" : "destructive"}>
                {dbStatus.environmentCheck.DATABASE_URL}
              </Badge>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          {initialized ? (
            <span className="flex items-center gap-1 text-green-500">
              <CheckCircle2 className="h-4 w-4" />
              Database tables initialized
            </span>
          ) : (
            <span>Database tables need to be initialized</span>
          )}
        </div>
        <Button 
          onClick={initializeDatabase} 
          disabled={initLoading || !dbStatus?.success} 
          variant="default"
        >
          {initLoading ? "Initializing..." : "Initialize Database"}
        </Button>
      </div>

      {dbStatus && !dbStatus.success && (
        <div className="mt-6 p-4 border rounded-md bg-muted">
          <h3 className="text-sm font-medium mb-2">Troubleshooting Tips:</h3>
          <ul className="list-disc list-inside text-sm space-y-1">
            <li>Check that you have created a Postgres database in Vercel.</li>
            <li>Verify that your .env.local file contains the correct connection strings.</li>
            <li>Make sure you've copied all environment variables from the Vercel dashboard.</li>
            <li>If using a custom provider, ensure your connection string format is correct.</li>
            <li>For local development, make sure you've run <code className="bg-background px-1 rounded">npm run dev</code> with the updated environment variables.</li>
          </ul>
        </div>
      )}
    </div>
  );
} 