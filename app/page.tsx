"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserLeaderboard } from "@/components/user-leaderboard";
import { UserPortfolio } from "@/components/user-portfolio";

export default function Home() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("leaderboard");

  return (
    <main className="container mx-auto py-6 px-4 md:px-6">
      <div className="flex flex-col items-center justify-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Welcome to Stoki</h1>
        <p className="text-muted-foreground mt-2">
          {user
            ? `Hello, ${user.username}! Track your stocks and compete with others.`
            : "Log in to track your stocks and compete with others."}
        </p>
      </div>

      <Tabs defaultValue="leaderboard" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="portfolio">Your Portfolio</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
        </TabsList>
        <TabsContent value="portfolio" className="pt-4">
          <UserPortfolio />
        </TabsContent>
        <TabsContent value="leaderboard" className="pt-4">
          <UserLeaderboard />
        </TabsContent>
      </Tabs>
    </main>
  );
} 