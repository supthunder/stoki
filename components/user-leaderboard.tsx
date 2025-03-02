"use client";

import React, { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { Skeleton } from "@/components/ui/skeleton";

// Types for user stock data
type LeaderboardUser = {
  id: number;
  name: string;
  totalGain: number;
  totalGainPercentage: number;
  topGainer: string;
  topGainerPercentage: number;
  currentWorth: number;
};

// Mock data for demo purposes
const mockUsers: LeaderboardUser[] = [
  {
    id: 1,
    name: "Alice Johnson",
    totalGain: 12450.75,
    totalGainPercentage: 24.5,
    topGainer: "AAPL",
    topGainerPercentage: 12.3,
    currentWorth: 65450.25,
  },
  {
    id: 2,
    name: "Bob Smith",
    totalGain: 8923.50,
    totalGainPercentage: 18.2,
    topGainer: "MSFT",
    topGainerPercentage: 9.7,
    currentWorth: 58200.75,
  },
  {
    id: 3,
    name: "Carol Williams",
    totalGain: 15678.30,
    totalGainPercentage: 32.1,
    topGainer: "TSLA",
    topGainerPercentage: 28.5,
    currentWorth: 72300.45,
  },
  {
    id: 4,
    name: "David Brown",
    totalGain: -2350.25,
    totalGainPercentage: -5.8,
    topGainer: "NVDA",
    topGainerPercentage: 6.2,
    currentWorth: 38750.50,
  },
  {
    id: 5,
    name: "Eva Martinez",
    totalGain: 6740.80,
    totalGainPercentage: 14.2,
    topGainer: "AMZN",
    topGainerPercentage: 8.9,
    currentWorth: 51230.35,
  },
];

export function UserLeaderboard() {
  const { user } = useAuth();
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // In a real implementation, this would fetch from your API
  const fetchLeaderboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      // For now, use mock data
      // In production, you would fetch from your database
      // const response = await fetch('/api/leaderboard');
      // const data = await response.json();
      // setUsers(data);
      
      setUsers(mockUsers);
    } catch (err) {
      console.error("Failed to fetch leaderboard data:", err);
      setError("Failed to load leaderboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboardData();
  }, []);

  // Highlight the current user in the leaderboard
  const highlightCurrentUser = (userId: number) => {
    if (user && user.id === userId) {
      return "bg-primary/10";
    }
    return "";
  };

  if (error) {
    return (
      <div className="rounded-md border bg-card text-card-foreground">
        <div className="p-4 text-center text-red-500">
          <p>{error}</p>
          <button 
            onClick={fetchLeaderboardData} 
            className="mt-2 text-primary hover:underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-card text-card-foreground">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Rank</TableHead>
            <TableHead>User</TableHead>
            <TableHead>Total Gain</TableHead>
            <TableHead>Top Gainer</TableHead>
            <TableHead className="text-right">Current Worth</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            // Loading skeletons
            Array(5).fill(0).map((_, index) => (
              <TableRow key={`skeleton-${index}`}>
                <TableCell><Skeleton className="h-4 w-6" /></TableCell>
                <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                <TableCell><Skeleton className="h-8 w-20" /></TableCell>
                <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
              </TableRow>
            ))
          ) : (
            users
              .sort((a, b) => b.totalGain - a.totalGain)
              .map((user, index) => (
                <TableRow key={user.id} className={highlightCurrentUser(user.id)}>
                  <TableCell className="font-medium">{index + 1}</TableCell>
                  <TableCell>{user.name}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span
                        className={
                          user.totalGain >= 0 ? "text-green-600" : "text-red-600"
                        }
                      >
                        ${user.totalGain.toLocaleString()}
                      </span>
                      <span
                        className={`text-xs ${
                          user.totalGainPercentage >= 0
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {user.totalGainPercentage >= 0 ? "+" : ""}
                        {user.totalGainPercentage}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{user.topGainer}</Badge>
                      <span
                        className={`text-xs ${
                          user.topGainerPercentage >= 0
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {user.topGainerPercentage >= 0 ? "+" : ""}
                        {user.topGainerPercentage}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    ${user.currentWorth.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))
          )}
        </TableBody>
      </Table>
    </div>
  );
} 