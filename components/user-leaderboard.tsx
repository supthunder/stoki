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
  chartData?: { date: string; value: number }[];
  stockDistribution?: { name: string, value: number }[];
};

export function UserLeaderboard() {
  const { user } = useAuth();
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState("table"); // "table" or "cards"
  const [sortBy, setSortBy] = useState("currentWorth");
  const [sortOrder, setSortOrder] = useState("desc");
  const [selectedUser, setSelectedUser] = useState<LeaderboardUser | null>(null);

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

  if (error) {
    return (
      <div className="rounded-md border bg-card text-card-foreground">
        <div className="p-4 text-center text-red-500">
          <p>{error}</p>
          <button 
            onClick={() => fetchLeaderboardData()} 
            className="mt-2 text-primary hover:underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (selectedUser) {
    return (
      <UserProfile 
        userId={selectedUser.id} 
        userName={selectedUser.name} 
        onBack={handleBackToLeaderboard} 
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Leaderboard</h2>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => fetchLeaderboardData(true)}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="animate-spin mr-2">⟳</span>
                Refreshing...
              </>
            ) : (
              <>
                <span className="mr-2">⟳</span>
                Refresh
              </>
            )}
          </Button>
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
                <TableHead>Holdings</TableHead>
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
                    <TableCell><Skeleton className="h-10 w-16" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : sortedUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">
                    No users found. Be the first to add stocks to your portfolio!
                  </TableCell>
                </TableRow>
              ) : (
                sortedUsers.map((user, index) => (
                  <TableRow 
                    key={user.id} 
                    className={`${highlightCurrentUser(user.id)} cursor-pointer hover:bg-accent/50`}
                    onClick={() => handleUserClick(user)}
                  >
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell className="font-medium">
                      {user.name}
                      {user.topGainer && (
                        <div className="mt-1">
                          <Badge variant="outline" className="text-xs">
                            Top: {user.topGainer} ({user.topGainerPercentage}%)
                          </Badge>
                        </div>
                      )}
                    </TableCell>
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
                    <TableCell>
                      <StockDistributionChart data={user.stockDistribution} />
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {loading ? (
            // Card loading skeletons
            Array(4).fill(0).map((_, index) => (
              <Card key={`skeleton-card-${index}`} className="mb-4">
                <CardContent className="pt-6">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center">
                      <Skeleton className="w-8 h-8 rounded-full mr-2" />
                      <Skeleton className="h-6 w-24" />
                    </div>
                    <Skeleton className="h-6 w-20" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="space-y-4">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                    <div className="flex flex-col space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-14 w-full" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-14 w-full" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : sortedUsers.length === 0 ? (
            <Card className="col-span-2">
              <CardContent className="py-6 text-center text-muted-foreground">
                No users found. Be the first to add stocks to your portfolio!
              </CardContent>
            </Card>
          ) : (
            sortedUsers.map((user, index) => (
              <Card 
                key={user.id} 
                className={`mb-4 ${highlightCurrentUser(user.id)} cursor-pointer hover:bg-accent/10`}
                onClick={() => handleUserClick(user)}
              >
                <CardContent className="pt-6">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center">
                      <div className="bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center mr-2">
                        {index + 1}
                      </div>
                      <h3 className="font-semibold text-lg">{user.name}</h3>
                    </div>
                    <span className="font-bold">{user.currentWorth}</span>
                  </div>
                  
                  {user.topGainer && (
                    <div className="mb-4">
                      <Badge variant="outline" className="w-full justify-center">
                        Top Performer: {user.topGainer} ({user.topGainerPercentage}%)
                      </Badge>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
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
                    
                    <div className="flex flex-col space-y-2">
                      <div className="text-sm text-muted-foreground text-center">Portfolio Trend</div>
                      <div className="flex justify-center">
                        <MiniChart data={user.chartData} />
                      </div>

                      <div className="text-sm text-muted-foreground text-center mt-2">Stock Holdings</div>
                      <div className="flex justify-center">
                        <StockDistributionChart data={user.stockDistribution} />
                      </div>
                    </div>
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