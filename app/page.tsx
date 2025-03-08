"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserLeaderboard } from "@/components/user-leaderboard";
import { UserPortfolio } from "@/components/user-portfolio";
import { MobileNav } from "@/components/mobile-nav";
import { useIsMobile } from "@/lib/hooks";
import { UserProfile } from "@/components/user-profile";

export default function Home() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("leaderboard");
  const { isMobile, isIOS } = useIsMobile();

  // Handle tab change
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  return (
    <main className={`container mx-auto py-6 px-4 md:px-6 ${isMobile ? 'pb-24' : ''}`}>
      {/* Header */}
      <div className="flex flex-col items-center justify-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight">
          {isMobile ? "Explore" : "Welcome to Stoki"}
        </h1>
        {!isMobile && (
          <p className="text-muted-foreground mt-2">
            {user
              ? `Hello, ${user.username}! Track your stocks and compete with others.`
              : "Log in to track your stocks and compete with others."}
          </p>
        )}
      </div>

      {/* Desktop Tabs */}
      {!isMobile && (
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
      )}

      {/* Mobile Content */}
      {isMobile && (
        <>
          {activeTab === "portfolio" && <UserPortfolio />}
          {activeTab === "leaderboard" && <UserLeaderboard />}
          {activeTab === "profile" && user && (
            <UserProfile 
              userId={user.id} 
              userName={user.username} 
              onBack={() => setActiveTab("portfolio")} 
            />
          )}
          <MobileNav activeTab={activeTab} onTabChange={handleTabChange} />
        </>
      )}
    </main>
  );
} 