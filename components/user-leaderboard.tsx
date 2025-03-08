"use client";

import React, { useState, useEffect, MouseEvent } from "react";
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
  
  return (
    <div className="bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center">
      <span className="text-base font-bold">{rank}</span>
    </div>
  );
};

// Stock logo component to handle fallbacks
const StockLogo = ({ symbol }: { symbol: string }) => {
  const [imageError, setImageError] = useState(false);

  // If we've already had an error, use the fallback immediately
  if (imageError) {
    return (
      <div className="w-4 h-4 bg-primary/20 rounded-sm flex items-center justify-center text-[8px] font-bold">
        {symbol.substring(0, 2)}
      </div>
    );
  }

  // Try to load the image first
  return (
    <img 
      src={`https://storage.googleapis.com/iex/api/logos/${symbol}.png`}
      alt={symbol}
      className="w-4 h-4 object-contain rounded-sm"
      onError={() => setImageError(true)}
    />
  );
};

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
  const { isMobile } = useIsMobile();

  const fetchLeaderboardData = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);
      
      const refreshParam = forceRefresh ? '?refresh=true' : '';
      const response = await fetch(`/api/leaderboard${refreshParam}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch leaderboard data');
      }
      
      const data = await response.json();
      setLeaderboardData(data);
    } catch (err) {
      console.error("Failed to fetch leaderboard data:", err);
      setError("Failed to load leaderboard data");
    } finally {
      setLoading(false);
    }
  };

  // Initial data fetch on component mount
  useEffect(() => {
    // Always force refresh on initial load to get the latest data
    fetchLeaderboardData(true);
  }, []);
  
  // Set up auto-refresh interval (every 2 minutes)
  useEffect(() => {
    // Don't set up auto-refresh if user is looking at a profile
    if (selectedUser) return;
    
    const intervalId = setInterval(() => {
      fetchLeaderboardData(true);
    }, 2 * 60 * 1000); // 2 minutes in milliseconds
    
    // Clean up interval on component unmount
    return () => clearInterval(intervalId);
  }, [selectedUser]);

  // Highlight the current user in the leaderboard
  const highlightCurrentUser = (userId: number) => {
    if (user && user.id === userId) {
      return "bg-primary/10";
    }
    return "";
  };

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

  const sortedUsers = [...leaderboardData].sort((a, b) => {
    let aValue, bValue;
    
    // Get values based on sortBy column
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
        aValue = parseCurrency(a.currentWorth);
        bValue = parseCurrency(b.currentWorth);
    }
    
    // Apply sort order
    return sortDirection === "desc" ? bValue - aValue : aValue - bValue;
  });

  // Simple mini chart component - Replacing with Shadcn UI charts
  const MiniChart = ({ data }: { data?: { date: string; value: number }[] }) => {
    if (!data || data.length < 2) return null;
    
    // Calculate if overall trend is positive
    const isPositive = data[data.length - 1].value >= data[0].value;
    
    return (
      <div className="h-14 w-32">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor={isPositive ? "rgb(34, 197, 94)" : "rgb(239, 68, 68)"}
                  stopOpacity={0.3}
                />
                <stop
                  offset="95%"
                  stopColor={isPositive ? "rgb(34, 197, 94)" : "rgb(239, 68, 68)"}
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col">
                          <span className="text-xs font-medium">Date</span>
                          <span className="font-bold">
                            {payload[0]?.payload?.date || ""}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-medium">Value</span>
                          <span className="font-bold">
                            ${payload[0]?.value?.toLocaleString() || "0"}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={isPositive ? "rgb(34, 197, 94)" : "rgb(239, 68, 68)"}
              fillOpacity={1}
              fill="url(#chartGradient)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  };

  // Stock Distribution Pie Chart
  const StockDistributionChart = ({ data }: { data?: { name: string, value: number }[] }) => {
    if (!data || data.length === 0) return null;
    
    // Generate colors for each segment
    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];
    
    return (
      <div className="h-14 w-32">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={15}
              outerRadius={25}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-sm">
                      <div className="flex flex-col">
                        <span className="text-xs font-medium">
                          {payload[0]?.name || ""}
                        </span>
                        <span className="font-bold">
                          ${payload[0]?.value?.toLocaleString() || "0"}
                        </span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const handleUserClick = (user: LeaderboardUser) => {
    setSelectedUser(user);
  };

  const handleBackToLeaderboard = () => {
    setSelectedUser(null);
  };

  // This function ensures the event parameter doesn't get passed to fetchLeaderboardData
  const handleRefresh = () => {
    fetchLeaderboardData(true);
  };

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
              {Array(5).fill(0).map((_, index) => (
                <TableRow key={`skeleton-${index}`}>
                  <TableCell><Skeleton className="h-4 w-6" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-20" /></TableCell>
                  <TableCell className="hidden md:table-cell"><Skeleton className="h-10 w-16" /></TableCell>
                  <TableCell className="hidden md:table-cell"><Skeleton className="h-10 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <Tabs defaultValue="total" className="w-full">
          <TabsList className={`grid w-full ${isMobile ? 'grid-cols-3' : 'grid-cols-4'}`}>
            <TabsTrigger value="total">Total Gain</TabsTrigger>
            <TabsTrigger value="daily">Daily</TabsTrigger>
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
            {!isMobile && <TabsTrigger value="worth">Net Worth</TabsTrigger>}
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

          <TabsContent value="daily">
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

          <TabsContent value="weekly">
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

          <TabsContent value="worth">
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
    </div>
  );
} 