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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { parseCurrency } from "@/lib/utils";

// Types for user stock data
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
  currentWorth: string;
  chartData?: { date: string; value: number }[];
};

export function UserLeaderboard() {
  const { user } = useAuth();
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState("table"); // "table" or "cards"
  const [sortBy, setSortBy] = useState("currentWorth");
  const [sortOrder, setSortOrder] = useState("desc");

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

  const handleSort = (column: string) => {
    if (sortBy === column) {
      // Toggle sort order if clicking the same column
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      // Set new column with default descending order
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  const sortedUsers = [...users].sort((a, b) => {
    let aValue, bValue;
    
    // Get values based on sortBy column
    switch (sortBy) {
      case "currentWorth":
        aValue = parseCurrency(a.currentWorth);
        bValue = parseCurrency(b.currentWorth);
        break;
      case "totalGain":
        aValue = parseCurrency(a.totalGain);
        bValue = parseCurrency(b.totalGain);
        break;
      case "dailyGain":
        aValue = parseCurrency(a.dailyGain);
        bValue = parseCurrency(b.dailyGain);
        break;
      case "weeklyGain":
        aValue = parseCurrency(a.weeklyGain);
        bValue = parseCurrency(b.weeklyGain);
        break;
      default:
        aValue = parseCurrency(a.currentWorth);
        bValue = parseCurrency(b.currentWorth);
    }
    
    // Apply sort order
    return sortOrder === "desc" ? bValue - aValue : aValue - bValue;
  });

  // Simple mini chart component
  const MiniChart = ({ data }: { data?: { date: string; value: number }[] }) => {
    if (!data || data.length < 2) return null;
    
    const max = Math.max(...data.map(d => d.value));
    const min = Math.min(...data.map(d => d.value));
    const range = max - min;
    
    // Calculate if overall trend is positive
    const isPositive = data[data.length - 1].value >= data[0].value;
    
    return (
      <div className="h-10 w-16 flex items-end gap-[1px]">
        {data.map((point, i) => {
          const height = range === 0 ? 50 : ((point.value - min) / range) * 100;
          return (
            <div 
              key={i} 
              className={`w-1 ${isPositive ? 'bg-green-500' : 'bg-red-500'}`} 
              style={{ height: `${Math.max(10, height)}%` }}
              title={`${point.date}: ${point.value.toLocaleString('en-US', {
                style: 'currency',
                currency: 'USD'
              })}`}
            />
          );
        })}
      </div>
    );
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
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Leaderboard</h2>
        <div className="flex items-center gap-2">
          <Tabs defaultValue="table" onValueChange={setViewMode}>
            <TabsList>
              <TabsTrigger value="table">Table</TabsTrigger>
              <TabsTrigger value="cards">Cards</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {viewMode === "table" ? (
        <div className="rounded-md border bg-card text-card-foreground overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">Rank</TableHead>
                <TableHead>User</TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort("dailyGain")}>
                  Daily {sortBy === "dailyGain" && (sortOrder === "desc" ? "↓" : "↑")}
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort("weeklyGain")}>
                  7-Day {sortBy === "weeklyGain" && (sortOrder === "desc" ? "↓" : "↑")}
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort("totalGain")}>
                  Total Gain {sortBy === "totalGain" && (sortOrder === "desc" ? "↓" : "↑")}
                </TableHead>
                <TableHead>Trend</TableHead>
                <TableHead className="text-right cursor-pointer" onClick={() => handleSort("currentWorth")}>
                  Net Worth {sortBy === "currentWorth" && (sortOrder === "desc" ? "↓" : "↑")}
                </TableHead>
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
                    <TableCell><Skeleton className="h-8 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-10 w-16" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : sortedUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                    No users found. Be the first to add stocks to your portfolio!
                  </TableCell>
                </TableRow>
              ) : (
                sortedUsers.map((user, index) => (
                  <TableRow key={user.id} className={highlightCurrentUser(user.id)}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell>{user.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span
                          className={
                            parseCurrency(user.dailyGain) >= 0 ? "text-green-600" : "text-red-600"
                          }
                        >
                          {user.dailyGain}
                        </span>
                        <span
                          className={`text-xs ${
                            parseFloat(user.dailyGainPercentage) >= 0
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {parseFloat(user.dailyGainPercentage) >= 0 ? "+" : ""}
                          {user.dailyGainPercentage}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span
                          className={
                            parseCurrency(user.weeklyGain) >= 0 ? "text-green-600" : "text-red-600"
                          }
                        >
                          {user.weeklyGain}
                        </span>
                        <span
                          className={`text-xs ${
                            parseFloat(user.weeklyGainPercentage) >= 0
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {parseFloat(user.weeklyGainPercentage) >= 0 ? "+" : ""}
                          {user.weeklyGainPercentage}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span
                          className={
                            parseCurrency(user.totalGain) >= 0 ? "text-green-600" : "text-red-600"
                          }
                        >
                          {user.totalGain}
                        </span>
                        <span
                          className={`text-xs ${
                            parseFloat(user.totalGainPercentage) >= 0
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {parseFloat(user.totalGainPercentage) >= 0 ? "+" : ""}
                          {user.totalGainPercentage}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <MiniChart data={user.chartData} />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {user.currentWorth}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            // Loading skeletons for cards
            Array(6).fill(0).map((_, index) => (
              <Card key={`skeleton-card-${index}`} className="overflow-hidden">
                <CardContent className="p-4">
                  <Skeleton className="h-6 w-2/3 mb-4" />
                  <div className="flex justify-between mb-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-4 w-1/4" />
                  </div>
                  <div className="flex justify-between mb-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-4 w-1/4" />
                  </div>
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-4 w-1/4" />
                  </div>
                  <Skeleton className="h-10 w-full mt-4" />
                </CardContent>
              </Card>
            ))
          ) : sortedUsers.length === 0 ? (
            <div className="col-span-full text-center py-6 text-muted-foreground">
              No users found. Be the first to add stocks to your portfolio!
            </div>
          ) : (
            sortedUsers.map((user, index) => (
              <Card 
                key={user.id} 
                className={`overflow-hidden ${highlightCurrentUser(user.id)}`}
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg">{index + 1}. {user.name}</h3>
                    <span className="font-medium">{user.currentWorth}</span>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Daily:</span>
                      <div className="flex items-center gap-2">
                        <span 
                          className={parseCurrency(user.dailyGain) >= 0 ? "text-green-600" : "text-red-600"}
                        >
                          {user.dailyGain}
                        </span>
                        <span 
                          className={`text-xs ${parseFloat(user.dailyGainPercentage) >= 0 ? "text-green-600" : "text-red-600"}`}
                        >
                          ({parseFloat(user.dailyGainPercentage) >= 0 ? "+" : ""}{user.dailyGainPercentage}%)
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">7-Day:</span>
                      <div className="flex items-center gap-2">
                        <span 
                          className={parseCurrency(user.weeklyGain) >= 0 ? "text-green-600" : "text-red-600"}
                        >
                          {user.weeklyGain}
                        </span>
                        <span 
                          className={`text-xs ${parseFloat(user.weeklyGainPercentage) >= 0 ? "text-green-600" : "text-red-600"}`}
                        >
                          ({parseFloat(user.weeklyGainPercentage) >= 0 ? "+" : ""}{user.weeklyGainPercentage}%)
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total:</span>
                      <div className="flex items-center gap-2">
                        <span 
                          className={parseCurrency(user.totalGain) >= 0 ? "text-green-600" : "text-red-600"}
                        >
                          {user.totalGain}
                        </span>
                        <span 
                          className={`text-xs ${parseFloat(user.totalGainPercentage) >= 0 ? "text-green-600" : "text-red-600"}`}
                        >
                          ({parseFloat(user.totalGainPercentage) >= 0 ? "+" : ""}{user.totalGainPercentage}%)
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 flex justify-center">
                    <MiniChart data={user.chartData} />
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
} 