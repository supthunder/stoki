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
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Button } from "@/components/ui/button";
import { UserProfile } from "@/components/user-profile";
import { useIsMobile } from "@/lib/hooks";
import { RefreshCw } from "lucide-react";
import { MobileLeaderboard } from "./mobile-leaderboard";

// Medal component for top 3 rankings
const RankMedal = ({ rank }: { rank: number }) => {
  if (rank === 1) {
    return (
      <div className="bg-yellow-400 text-yellow-950 w-12 h-12 rounded-full flex items-center justify-center" title="Gold Medal">
        <span className="text-2xl">🥇</span>
      </div>
    );
  } else if (rank === 2) {
    return (
      <div className="bg-gray-300 text-gray-800 w-12 h-12 rounded-full flex items-center justify-center" title="Silver Medal">
        <span className="text-2xl">🥈</span>
      </div>
    );
  } else if (rank === 3) {
    return (
      <div className="bg-amber-700 text-amber-100 w-12 h-12 rounded-full flex items-center justify-center" title="Bronze Medal">
        <span className="text-2xl">🥉</span>
      </div>
    );
  }
  return null;
};

// Stock logo component
const StockLogo = ({ symbol }: { symbol: string }) => {
  return (
    <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold">
      {symbol.charAt(0)}
    </div>
  );
};

// Type for leaderboard user data
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

export function UserLeaderboard() {
  const { user } = useAuth();
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState("currentWorth");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [selectedUser, setSelectedUser] = useState<LeaderboardUser | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [timeFrame, setTimeFrame] = useState<"total" | "weekly" | "daily">("total");
  const { isMobile } = useIsMobile();

  // Fetch leaderboard data
  const fetchLeaderboardData = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);
      
      const url = forceRefresh 
        ? "/api/leaderboard?refresh=true" 
        : "/api/leaderboard";
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch leaderboard data: ${response.status}`);
      }
      
      const data = await response.json();
      setLeaderboardData(data);
    } catch (err) {
      console.error("Failed to fetch leaderboard data:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch leaderboard data");
    } finally {
      setLoading(false);
    }
  };

  // Load data on component mount
  useEffect(() => {
    fetchLeaderboardData();
  }, []);

  // Handle sorting
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      // Toggle sort order if clicking the same column
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // Set new column with default descending order
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  // Sort users based on current sort settings and time frame
  const sortedUsers = [...leaderboardData].sort((a, b) => {
    let aValue, bValue;
    
    // Get values based on sortColumn and timeFrame
    switch (sortColumn) {
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
      case "startingAmount":
        aValue = parseCurrency(a.startingAmount);
        bValue = parseCurrency(b.startingAmount);
        break;
      default:
        // Default sort based on the selected time frame
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
    }
    
    // Apply sort order
    return sortDirection === "desc" ? bValue - aValue : aValue - bValue;
  });

  // Helper function to highlight the current user
  const highlightCurrentUser = (userId: number) => {
    return userId === user?.id ? "bg-accent/30" : "";
  };

  // Mini chart component for trends
  const MiniChart = ({ data }: { data?: { date: string; value: number }[] }) => {
    if (!data || data.length === 0) {
      return <div className="h-10 w-16 bg-muted rounded-md"></div>;
    }

    const chartData = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    return (
      <div className="h-10 w-16">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="value"
              stroke="#10b981"
              fillOpacity={1}
              fill="url(#colorValue)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  };

  // Handle clicking on a user
  const handleUserClick = (user: LeaderboardUser) => {
    setSelectedUser(user);
  };

  // Handle going back to leaderboard
  const handleBackToLeaderboard = () => {
    setSelectedUser(null);
  };

  // Handle refresh button click
  const handleRefresh = () => {
    setRefreshing(true);
    fetchLeaderboardData(true).finally(() => {
      setRefreshing(false);
    });
  };

  // Handle tab change
  const handleTimeFrameChange = (value: string) => {
    setTimeFrame(value as "total" | "weekly" | "daily");
    
    // Update sort column based on time frame
    if (value === "daily") {
      setSortColumn("dailyGain");
    } else if (value === "weekly") {
      setSortColumn("weeklyGain");
    } else {
      setSortColumn("totalGain");
    }
  };

  // If a user is selected, show their profile
  if (selectedUser) {
    return (
      <div>
        <Button 
          variant="ghost" 
          onClick={handleBackToLeaderboard} 
          className="mb-4"
        >
          ← Back to Leaderboard
        </Button>
        <UserProfile 
          userId={selectedUser.id} 
          userName={selectedUser.name} 
          onBack={handleBackToLeaderboard} 
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold`}>
          {isMobile ? "Leaderboard" : "Stock Trading Leaderboard"}
        </h2>
        <Button 
          variant="outline" 
          size={isMobile ? "sm" : "default"}
          onClick={handleRefresh} 
          disabled={refreshing}
        >
          {refreshing ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Refreshing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </>
          )}
        </Button>
      </div>

      {error ? (
        <div className="bg-destructive/20 p-4 rounded-md mb-4">
          <p className="text-destructive font-medium">{error}</p>
          <Button 
            variant="outline" 
            className="mt-2" 
            onClick={() => fetchLeaderboardData(true)}
          >
            Try Again
          </Button>
        </div>
      ) : loading ? (
        <div className="space-y-3">
          {Array(5).fill(0).map((_, index) => (
            <Card key={`skeleton-${index}`}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-5 w-28" />
                  </div>
                  <div className="text-right">
                    <Skeleton className="h-5 w-20 ml-auto" />
                    <Skeleton className="h-4 w-16 ml-auto mt-1" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {isMobile ? (
            // Mobile-specific leaderboard
            <MobileLeaderboard 
              users={sortedUsers} 
              onUserClick={handleUserClick} 
              currentUserId={user?.id}
              defaultTimeFrame={timeFrame}
              onTimeFrameChange={handleTimeFrameChange}
            />
          ) : (
            // Desktop leaderboard with tabs
            <Tabs defaultValue="total" value={timeFrame} onValueChange={handleTimeFrameChange} className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="total">Total Gain</TabsTrigger>
                <TabsTrigger value="daily">Today</TabsTrigger>
                <TabsTrigger value="weekly">Weekly</TabsTrigger>
                <TabsTrigger value="worth">Net Worth</TabsTrigger>
              </TabsList>
              
              <TabsContent value="total">
                <div className="rounded-md border bg-card text-card-foreground overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[80px]">Rank</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead className="cursor-pointer whitespace-nowrap" onClick={() => handleSort("dailyGain")}>
                          Daily {sortColumn === "dailyGain" && (sortDirection === "desc" ? "↓" : "↑")}
                        </TableHead>
                        <TableHead className="cursor-pointer whitespace-nowrap" onClick={() => handleSort("weeklyGain")}>
                          7-Day {sortColumn === "weeklyGain" && (sortDirection === "desc" ? "↓" : "↑")}
                        </TableHead>
                        <TableHead className="cursor-pointer whitespace-nowrap" onClick={() => handleSort("totalGain")}>
                          Total Gain {sortColumn === "totalGain" && (sortDirection === "desc" ? "↓" : "↑")}
                        </TableHead>
                        <TableHead className="hidden md:table-cell">Trend</TableHead>
                        <TableHead className="hidden md:table-cell whitespace-nowrap">Latest Purchase</TableHead>
                        <TableHead className="cursor-pointer whitespace-nowrap" onClick={() => handleSort("startingAmount")}>
                          Initial Investment {sortColumn === "startingAmount" && (sortDirection === "desc" ? "↓" : "↑")}
                        </TableHead>
                        <TableHead className="text-right cursor-pointer whitespace-nowrap" onClick={() => handleSort("currentWorth")}>
                          Net Worth {sortColumn === "currentWorth" && (sortDirection === "desc" ? "↓" : "↑")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedUsers.map((user, index) => (
                        <TableRow 
                          key={user.id} 
                          className={`${highlightCurrentUser(user.id)} cursor-pointer hover:bg-accent/50`}
                          onClick={() => handleUserClick(user)}
                        >
                          <TableCell className="font-medium">
                            {index < 3 ? (
                              <RankMedal rank={index + 1} />
                            ) : (
                              index + 1
                            )}
                          </TableCell>
                          <TableCell className="font-medium max-w-[120px] md:max-w-none">
                            <div className="truncate">
                              {user.name}
                              {user.topGainer && (
                                <div className="mt-1">
                                  <Badge variant="outline" className="text-xs">
                                    Top: {user.topGainer} ({user.topGainerPercentage}%)
                                  </Badge>
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col whitespace-nowrap">
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
                            <div className="flex flex-col whitespace-nowrap">
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
                            <div className="flex flex-col whitespace-nowrap">
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
                          <TableCell className="hidden md:table-cell">
                            <MiniChart data={user.chartData} />
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {user.latestPurchase ? (
                              <div className="flex flex-col">
                                <div className="flex items-center space-x-1">
                                  <span className="font-semibold">{user.latestPurchase.symbol}</span>
                                  <StockLogo symbol={user.latestPurchase.symbol} />
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(user.latestPurchase.date).toLocaleDateString()}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">No purchases</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            {user.startingAmount}
                          </TableCell>
                          <TableCell className="text-right font-medium whitespace-nowrap">
                            {user.currentWorth}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </>
      )}
    </div>
  );
} 