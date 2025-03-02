"use client";

import { useAuth } from "@/lib/auth-context";
import { UserLeaderboard } from "@/components/user-leaderboard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Home() {
  const { user } = useAuth();
  
  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold mb-2">Welcome to Stoki</h1>
        <p className="text-xl opacity-80">
          {user ? `Logged in as ${user.username}` : "A social stock trading app"}
        </p>
      </div>

      <Tabs defaultValue="leaderboard" className="mb-8">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          <TabsTrigger value="portfolio">Your Portfolio</TabsTrigger>
        </TabsList>
        
        <TabsContent value="leaderboard" className="p-4">
          <UserLeaderboard />
        </TabsContent>
        
        <TabsContent value="portfolio" className="p-4">
          {user ? (
            <div>
              <h2 className="text-2xl font-bold mb-4">Your Portfolio</h2>
              <p>Coming soon: View your stock portfolio here</p>
            </div>
          ) : (
            <div className="p-4 border rounded-md bg-yellow-50 dark:bg-yellow-950 text-center">
              <p>Please log in to view your portfolio</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </main>
  );
} 