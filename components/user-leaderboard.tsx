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

export function UserLeaderboard() {
  const { user } = useAuth();
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/leaderboard');
      
      if (!response.ok) {
        throw new Error('Failed to fetch leaderboard data');
      }
      
      const data = await response.json();
      setUsers(data);
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
          ) : users.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                No users found. Be the first to add stocks to your portfolio!
              </TableCell>
            </TableRow>
          ) : (
            users
              .sort((a, b) => b.currentWorth - a.currentWorth)
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
                        ${user.totalGain.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span
                        className={`text-xs ${
                          user.totalGainPercentage >= 0
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {user.totalGainPercentage >= 0 ? "+" : ""}
                        {user.totalGainPercentage.toFixed(2)}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {user.topGainer ? (
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
                          {user.topGainerPercentage.toFixed(2)}%
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">None</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    ${user.currentWorth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                </TableRow>
              ))
          )}
        </TableBody>
      </Table>
    </div>
  );
} 