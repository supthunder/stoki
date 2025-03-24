"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { parseCurrency } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getCachedLeaderboardData } from "@/lib/cache";
import { Skeleton } from "@/components/ui/skeleton";

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
  onTimeFrameChange?: (timeFrame: TimeFrame, refresh: boolean) => void;
  loading?: boolean;
}

type TimeFrame = "total" | "weekly" | "daily";

export function MobileLeaderboard({ 
  users, 
  onUserClick, 
  currentUserId,
  defaultTimeFrame = "total",
  onTimeFrameChange,
  loading = false
}: MobileLeaderboardProps) {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>(defaultTimeFrame);
  const [refreshState, setRefreshState] = useState<'idle' | 'pulling' | 'refreshing'>('idle');
  const [pullDistance, setPullDistance] = useState(0);
  
  // Add debug log
  useEffect(() => {
    console.log("Mobile leaderboard users:", users);
  }, [users]);
  
  // Update local state when defaultTimeFrame changes
  useEffect(() => {
    setTimeFrame(defaultTimeFrame);
  }, [defaultTimeFrame]);

  // Add pull-to-refresh functionality
  useEffect(() => {
    let touchStart = 0;
    let touchDistance = 0;
    const threshold = 100;
    let isRefreshing = false;

    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) {
        touchStart = e.touches[0].clientY;
        setRefreshState('idle');
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (touchStart > 0) {
        touchDistance = e.touches[0].clientY - touchStart;
        if (touchDistance > 0 && !isRefreshing) {
          e.preventDefault();
          setPullDistance(touchDistance);
          setRefreshState('pulling');
        }
      }
    };

    const handleTouchEnd = () => {
      if (touchDistance >= threshold && !isRefreshing) {
        isRefreshing = true;
        setRefreshState('refreshing');
        // Force refresh from Yahoo Finance API by passing both refresh and updateDb as true
        onTimeFrameChange?.(timeFrame, true);
        setTimeout(() => {
          isRefreshing = false;
          setRefreshState('idle');
          setPullDistance(0);
          touchStart = 0;
          touchDistance = 0;
        }, 1000);
      } else {
        setRefreshState('idle');
        setPullDistance(0);
      }
      touchStart = 0;
      touchDistance = 0;
    };

    document.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [timeFrame, onTimeFrameChange]);

  // Handle tab change
  const handleTabChange = (value: string) => {
    const newTimeFrame = value as TimeFrame;
    setTimeFrame(newTimeFrame);
    
    // Check if we have locally cached data first
    const cachedData = getCachedLeaderboardData(newTimeFrame);
    
    if (cachedData) {
      // We already have fresh cached data, no need to refresh
      if (onTimeFrameChange) {
        onTimeFrameChange(newTimeFrame, false);
      }
      return;
    }
    
    // No fresh cache, request new data
    if (onTimeFrameChange) {
      onTimeFrameChange(newTimeFrame, true);
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

  // If in loading state, render loading skeletons
  if (loading) {
    return (
      <div className="space-y-4">
        {/* Skeleton for tabs */}
        <Skeleton className="h-10 w-full mb-4" />
        
        {/* Skeleton cards for leaderboard items */}
        {Array(5).fill(0).map((_, index) => (
          <Card key={`skeleton-${index}`}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div>
                    <Skeleton className="h-5 w-24 mb-1" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
                <div className="text-right">
                  <Skeleton className="h-7 w-16" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div 
      className="space-y-4 relative"
      style={{
        transform: refreshState === 'pulling' ? `translateY(${Math.min(pullDistance, 100)}px)` : 
                  refreshState === 'refreshing' ? 'translateY(60px)' : 'translateY(0)',
        transition: refreshState === 'pulling' ? 'none' : 'transform 0.2s ease-out'
      }}
    >
      {(refreshState === 'pulling' || refreshState === 'refreshing') && (
        <div 
          className="absolute -top-16 left-0 right-0 flex items-center justify-center h-16 pointer-events-none"
          style={{ opacity: Math.min(pullDistance / 100, 1) }}
        >
          <div className="flex items-center gap-2">
            <svg
              className={`w-5 h-5 ${refreshState === 'refreshing' ? 'animate-spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d={refreshState === 'refreshing' ? 
                  "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" :
                  "M12 5l7 7-7 7-7-7 7-7z"
                }
              />
            </svg>
            <span className="text-sm">
              {refreshState === 'pulling' ? 'Pull to refresh...' : 
               refreshState === 'refreshing' ? 'Refreshing...' : ''}
            </span>
          </div>
        </div>
      )}

      <Tabs 
        defaultValue="total" 
        value={timeFrame} 
        onValueChange={handleTabChange}
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