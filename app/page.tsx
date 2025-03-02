"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { UserLeaderboard } from "@/components/user-leaderboard";
import { SetupGuide } from "@/components/setup-guide";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Home() {
  const { user } = useAuth();
  const [dbInitialized, setDbInitialized] = useState<boolean | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  // Initialize the database when the app loads, but only client-side
  useEffect(() => {
    const initializeDb = async () => {
      try {
        setIsInitializing(true);
        const response = await fetch('/api/init-db');
        const data = await response.json();
        setDbInitialized(data.success);
      } catch (error) {
        console.error('Failed to initialize database:', error);
        setDbInitialized(false);
      } finally {
        setIsInitializing(false);
      }
    };

    // Only run in the browser, not during Next.js static generation
    if (typeof window !== 'undefined') {
      initializeDb();
    }
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-12">
      <div className="w-full max-w-5xl flex flex-col gap-8">
        <h1 className="text-4xl font-bold text-center">
          Welcome to Stoki
        </h1>
        <p className="text-center text-xl">
          {user 
            ? `Logged in as ${user.username}` 
            : 'Login to start tracking your stocks'}
        </p>
        
        {dbInitialized === false && !isInitializing && (
          <div className="bg-red-900/20 p-4 rounded-md">
            <p className="text-center text-red-400">
              Failed to initialize database. Please try again or check the Setup tab.
            </p>
          </div>
        )}

        {isInitializing && (
          <div className="bg-amber-900/20 p-4 rounded-md">
            <p className="text-center text-amber-400">
              Initializing database...
            </p>
          </div>
        )}

        <Tabs defaultValue="app" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="app">App</TabsTrigger>
            <TabsTrigger value="setup">Setup & Troubleshooting</TabsTrigger>
          </TabsList>
          <TabsContent value="app">
            <div className="w-full">
              <UserLeaderboard />
            </div>
          </TabsContent>
          <TabsContent value="setup">
            <SetupGuide />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
} 