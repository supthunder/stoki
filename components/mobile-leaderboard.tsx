"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { parseCurrency } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type LeaderboardUser = {
  id: number;
  name: string;
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
          gain: user.dailyGain,
          percentage: user.dailyGainPercentage,
          isPositive: parseCurrency(user.dailyGain) >= 0
        };
      case "weekly":
        return {
          gain: user.weeklyGain,
          percentage: user.weeklyGainPercentage,
          isPositive: parseCurrency(user.weeklyGain) >= 0
        };
      case "total":
      default:
        return {
          gain: user.totalGain,
          percentage: user.totalGainPercentage,
          isPositive: parseCurrency(user.totalGain) >= 0
        };
    }
  };

  // Sort users based on the selected time frame
  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      let aValue, bValue;
      
      // Sort based on the selected time frame
      if (timeFrame === "daily") {
        aValue = parseCurrency(a.dailyGain);
        bValue = parseCurrency(b.dailyGain);
      } else if (timeFrame === "weekly") {
        aValue = parseCurrency(a.weeklyGain);
        bValue = parseCurrency(b.weeklyGain);
      } else {
        aValue = parseCurrency(a.totalGain);
        bValue = parseCurrency(b.totalGain);
      }
      
      // Sort in descending order (highest gain first)
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
          <TabsTrigger value="daily">Today</TabsTrigger>
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
                    {/* Rank */}
                    <div className="flex-shrink-0">
                      {index < 3 ? (
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                          ${index === 0 ? 'bg-yellow-400 text-yellow-950' : 
                            index === 1 ? 'bg-gray-300 text-gray-800' : 
                            'bg-amber-700 text-amber-100'}`}
                        >
                          {index + 1}
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-bold">
                          {index + 1}
                        </div>
                      )}
                    </div>
                    
                    {/* Name */}
                    <div>
                      <h3 className="font-semibold text-base">{user.name}</h3>
                    </div>
                  </div>
                  
                  {/* Portfolio Value and Gain */}
                  <div className="text-right">
                    <div className="font-bold text-base">{user.currentWorth}</div>
                    <div className={`text-xs ${isPositive ? "text-green-600" : "text-red-600"}`}>
                      {isPositive ? "+" : ""}{gain} ({percentage})
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