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
import { UserComparison } from "./user-comparison";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
  const [viewingComparison, setViewingComparison] = useState(false);
  const [viewingProfile, setViewingProfile] = useState(false);

  // Fetch leaderboard data
  const fetchLeaderboardData = async (forceRefresh = false, updateDb = false) => {
    try {
      setLoading(true);
      setError(null);
      
      let url = "/api/leaderboard";
      const params = new URLSearchParams();
      
      if (forceRefresh) {
        params.append('refresh', 'true');
      }
      
      if (updateDb) {
        params.append('updateDb', 'true');
      }
      
      // Add the current time frame to the request
      params.append('timeFrame', timeFrame);
      
      // Append params to URL if there are any
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch leaderboard data: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Leaderboard data:", data);
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
        aValue = a.currentWorth ? parseCurrency(a.currentWorth) : 0;
        bValue = b.currentWorth ? parseCurrency(b.currentWorth) : 0;
        break;
      case "totalGain":
        aValue = a.totalGain ? parseCurrency(a.totalGain) : 0;
        bValue = b.totalGain ? parseCurrency(b.totalGain) : 0;
        break;
      case "dailyGain":
        aValue = a.dailyGain ? parseCurrency(a.dailyGain) : 0;
        bValue = b.dailyGain ? parseCurrency(b.dailyGain) : 0;
        break;
      case "weeklyGain":
        aValue = a.weeklyGain ? parseCurrency(a.weeklyGain) : 0;
        bValue = b.weeklyGain ? parseCurrency(b.weeklyGain) : 0;
        break;
      case "startingAmount":
        aValue = a.startingAmount ? parseCurrency(a.startingAmount) : 0;
        bValue = b.startingAmount ? parseCurrency(b.startingAmount) : 0;
        break;
      default:
        // Default sort based on the selected time frame
        if (timeFrame === "daily") {
          aValue = a.dailyGain ? parseCurrency(a.dailyGain) : 0;
          bValue = b.dailyGain ? parseCurrency(b.dailyGain) : 0;
        } else if (timeFrame === "weekly") {
          aValue = a.weeklyGain ? parseCurrency(a.weeklyGain) : 0;
          bValue = b.weeklyGain ? parseCurrency(b.weeklyGain) : 0;
        } else {
          aValue = a.totalGain ? parseCurrency(a.totalGain) : 0;
          bValue = b.totalGain ? parseCurrency(b.totalGain) : 0;
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
    if (isMobile) {
      setViewingComparison(true);
    } else {
      setViewingProfile(true);
    }
  };

  // Handle going back to leaderboard
  const handleBackToLeaderboard = () => {
    setSelectedUser(null);
    setViewingProfile(false);
    setViewingComparison(false);
  };

  // Handle refresh with database update
  const handleRefreshWithUpdate = async () => {
    setRefreshing(true);
    await fetchLeaderboardData(true, true);
    setRefreshing(false);
  };

  // Handle refresh without database update
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchLeaderboardData(true, false);
    setRefreshing(false);
  };

  // Handle time frame change
  const handleTimeFrameChange = (value: string) => {
    setTimeFrame(value as "total" | "weekly" | "daily");
    
    // Just fetch data normally without forcing refresh
    fetchLeaderboardData(false, false);
  };

  // If viewing profile, show the profile component
  if (viewingProfile && user && selectedUser) {
    return (
      <UserProfile 
        userId={selectedUser.id} 
        userName={selectedUser.username} 
        onBack={handleBackToLeaderboard} 
      />
    );
  }

  // If viewing comparison, show the comparison component
  if (viewingComparison && user && selectedUser) {
    return (
      <UserComparison
        opponentId={selectedUser.id}
        onBack={handleBackToLeaderboard}
      />
    );
  }

  // If on mobile, use the mobile leaderboard component
  if (isMobile) {
    return (
      <MobileLeaderboard 
        users={sortedUsers} 
        onUserClick={handleUserClick} 
        currentUserId={user?.id}
        defaultTimeFrame={timeFrame}
        onTimeFrameChange={handleTimeFrameChange}
      />
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold`}>
          {isMobile ? "Leaderboard" : "Stock Trading Leaderboard"}
        </h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleRefreshWithUpdate}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Update All
          </Button>
        </div>
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
                        <TableHead className="w-[100px]">Rank</TableHead>
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
                              <div className="relative">
                                <Avatar className="h-12 w-12 bg-muted">
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
                                <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                                  ${index === 0 ? 'bg-yellow-400 text-yellow-950' : 
                                    index === 1 ? 'bg-gray-300 text-gray-800' : 
                                    'bg-amber-700 text-amber-100'}`}
                                >
                                  {index + 1}
                                </div>
                              </div>
                            ) : (
                              <div className="relative">
                                <Avatar className="h-12 w-12 bg-muted">
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
                                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                                  {index + 1}
                                </div>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-medium max-w-[120px] md:max-w-none">
                            <div className="truncate">
                              {user.username}
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
                                  user.dailyGain && parseCurrency(user.dailyGain) >= 0 ? "text-green-600" : "text-red-600"
                                }
                              >
                                {user.dailyGain || "$0.00"}
                              </span>
                              <span
                                className={`text-xs ${
                                  user.dailyGainPercentage && parseFloat(user.dailyGainPercentage) >= 0
                                    ? "text-green-600"
                                    : "text-red-600"
                                }`}
                              >
                                {user.dailyGainPercentage && parseFloat(user.dailyGainPercentage) >= 0 ? "+" : ""}
                                {user.dailyGainPercentage || "0"}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col whitespace-nowrap">
                              <span
                                className={
                                  user.weeklyGain && parseCurrency(user.weeklyGain) >= 0 ? "text-green-600" : "text-red-600"
                                }
                              >
                                {user.weeklyGain || "$0.00"}
                              </span>
                              <span
                                className={`text-xs ${
                                  user.weeklyGainPercentage && parseFloat(user.weeklyGainPercentage) >= 0
                                    ? "text-green-600"
                                    : "text-red-600"
                                }`}
                              >
                                {user.weeklyGainPercentage && parseFloat(user.weeklyGainPercentage) >= 0 ? "+" : ""}
                                {user.weeklyGainPercentage || "0"}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col whitespace-nowrap">
                              <span
                                className={
                                  user.totalGain && parseCurrency(user.totalGain) >= 0 ? "text-green-600" : "text-red-600"
                                }
                              >
                                {user.totalGain || "$0.00"}
                              </span>
                              <span
                                className={`text-xs ${
                                  user.totalGainPercentage && parseFloat(user.totalGainPercentage) >= 0
                                    ? "text-green-600"
                                    : "text-red-600"
                                }`}
                              >
                                {user.totalGainPercentage && parseFloat(user.totalGainPercentage) >= 0 ? "+" : ""}
                                {user.totalGainPercentage || "0"}%
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