"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { parseCurrency } from "@/lib/utils";

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
}

export function MobileLeaderboard({ users, onUserClick, currentUserId }: MobileLeaderboardProps) {
  // Helper function to highlight the current user
  const highlightCurrentUser = (userId: number) => {
    return userId === currentUserId ? "border-primary" : "";
  };

  return (
    <div className="space-y-3">
      {users.map((user, index) => (
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
                <div className={`text-xs ${parseCurrency(user.totalGain) >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {parseCurrency(user.totalGain) >= 0 ? "+" : ""}{user.totalGain} ({user.totalGainPercentage})
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
} 