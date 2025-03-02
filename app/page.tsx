"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { UserLeaderboard } from "@/components/user-leaderboard";

export default function Home() {
  const { user } = useAuth();
  const [dbInitialized, setDbInitialized] = useState<boolean | null>(null);

  // Initialize the database when the app loads
  useEffect(() => {
    const initializeDb = async () => {
      try {
        const response = await fetch('/api/init-db');
        const data = await response.json();
        setDbInitialized(data.success);
      } catch (error) {
        console.error('Failed to initialize database:', error);
        setDbInitialized(false);
      }
    };

    initializeDb();
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
        
        {dbInitialized === false && (
          <div className="bg-red-900/20 p-4 rounded-md">
            <p className="text-center text-red-400">
              Failed to initialize database. Please try again.
            </p>
          </div>
        )}

        {/* Single leaderboard layout */}
        <div className="w-full">
          <UserLeaderboard />
        </div>
      </div>
    </main>
  );
} 