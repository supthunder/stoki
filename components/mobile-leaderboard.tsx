"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { parseCurrency } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type LeaderboardUser = {
  id: number;
  username: string;
  avatar?: string;
  totalGain: string;
  totalGainPercentage: string;
  dailyGain: string;
  dailyGainPercentage: string;
  weeklyGain: string;
  weeklyGainPercentage: string;
  topGainer: string | null;
  topGainerPercentage?: string;
  currentWorth: string;
  startingAmount: string;
  latestPurchase?: {
    symbol: string;
    date: string;
    price: number;
  }
  chartData?: { date: string; value: number }[];
  stockDistribution?: { name: string, value: number }[];
};

interface MobileLeaderboardProps {
  users: LeaderboardUser[];
  onUserClick: (user: LeaderboardUser) => void;
  currentUserId?: number;
  defaultTimeFrame?: TimeFrame;
  onTimeFrameChange?: (timeFrame: TimeFrame) => void;
}

type TimeFrame = "total" | "weekly" | "daily";

export function MobileLeaderboard({ 
  users, 
  onUserClick, 
  currentUserId,
  defaultTimeFrame = "total",
  onTimeFrameChange
}: MobileLeaderboardProps) {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>(defaultTimeFrame);
  
  // Add debug log
  useEffect(() => {
    console.log("Mobile leaderboard users:", users);
  }, [users]);
  
  // Update local state when defaultTimeFrame changes
  useEffect(() => {
    setTimeFrame(defaultTimeFrame);
  }, [defaultTimeFrame]);

  // Handle time frame change
  const handleTimeFrameChange = (value: string) => {
    const newTimeFrame = value as TimeFrame;
    setTimeFrame(newTimeFrame);
    
    // Notify parent component if callback is provided
    if (onTimeFrameChange) {
      console.log(`Mobile leaderboard changing time frame to: ${newTimeFrame}`);
      onTimeFrameChange(newTimeFrame);
    }
  };

  // Helper function to highlight the current user
  const highlightCurrentUser = (userId: number) => {
    return userId === currentUserId ? "border-primary" : "";
  };

  // Get gain and percentage based on selected time frame
  const getGainData = (user: LeaderboardUser) => {
    switch (timeFrame) {
      case "daily":
        return {
          gain: user.dailyGain || "$0.00",
          percentage: user.dailyGainPercentage || "0",
          isPositive: user.dailyGain ? parseCurrency(user.dailyGain) >= 0 : true
        };
      case "weekly":
        return {
          gain: user.weeklyGain || "$0.00",
          percentage: user.weeklyGainPercentage || "0",
          isPositive: user.weeklyGain ? parseCurrency(user.weeklyGain) >= 0 : true
        };
      case "total":
      default:
        return {
          gain: user.totalGain || "$0.00",
          percentage: user.totalGainPercentage || "0",
          isPositive: user.totalGain ? parseCurrency(user.totalGain) >= 0 : true
        };
    }
  };

  // Sort users based on the selected time frame
  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      let aValue, bValue;
      
      // Sort based on the selected time frame
      if (timeFrame === "daily") {
        aValue = a.dailyGainPercentage ? parseFloat(a.dailyGainPercentage) : 0;
        bValue = b.dailyGainPercentage ? parseFloat(b.dailyGainPercentage) : 0;
      } else if (timeFrame === "weekly") {
        aValue = a.weeklyGainPercentage ? parseFloat(a.weeklyGainPercentage) : 0;
        bValue = b.weeklyGainPercentage ? parseFloat(b.weeklyGainPercentage) : 0;
      } else {
        aValue = a.totalGainPercentage ? parseFloat(a.totalGainPercentage) : 0;
        bValue = b.totalGainPercentage ? parseFloat(b.totalGainPercentage) : 0;
      }
      
      // Sort in descending order (highest percentage first)
      return bValue - aValue;
    });
  }, [users, timeFrame]);

  return (
    <div className="space-y-4">
      <Tabs 
        defaultValue="total" 
        value={timeFrame} 
        onValueChange={handleTimeFrameChange}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="total">All Time</TabsTrigger>
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="daily">Daily</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-3">
        {sortedUsers.map((user, index) => {
          const { gain, percentage, isPositive } = getGainData(user);
          
          return (
            <Card 
              key={user.id}
              className={`overflow-hidden cursor-pointer hover:bg-accent/10 ${highlightCurrentUser(user.id)}`}
              onClick={() => onUserClick(user)}
            >
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Avatar with Rank */}
                    <div className="relative">
                      <Avatar className="h-10 w-10 bg-muted">
                        {user.avatar ? (
                          <AvatarImage 
                            src={user.avatar.startsWith('data:') ? user.avatar : 
                                 user.avatar.startsWith('/') ? user.avatar : 
                                 `/${user.avatar}`} 
                            alt={user.username} 
                          />
                        ) : null}
                        <AvatarFallback>{user.username.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold
                        ${index === 0 ? 'bg-yellow-400 text-yellow-950' : 
                          index === 1 ? 'bg-gray-300 text-gray-800' : 
                          index === 2 ? 'bg-amber-700 text-amber-100' :
                          'bg-muted text-muted-foreground'}`}
                      >
                        {index + 1}
                      </div>
                    </div>
                    
                    {/* Name and Net Worth */}
                    <div>
                      <h3 className="font-semibold text-base">{user.username}</h3>
                      <div className="text-xs text-muted-foreground">
                        {user.currentWorth}
                      </div>
                    </div>
                  </div>
                  
                  {/* Gain Percentage */}
                  <div className="text-right">
                    <div className={`text-xl font-bold ${isPositive ? "text-green-600" : "text-red-600"}`}>
                      {isPositive ? "+" : ""}{percentage}%
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
} 