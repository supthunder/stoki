"use client";

import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Trophy,
  TrendingUp,
  TrendingDown,
  Target,
  ChevronUp,
  ChevronDown,
  Share2,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";

// Types for user data
type UserData = {
  id: number;
  username: string;
  avatar?: string;
  totalGain: string;
  totalGainPercentage: string;
  dailyGain: string;
  dailyGainPercentage: string;
  weeklyGain: string;
  weeklyGainPercentage: string;
  currentWorth: string;
  startingAmount: string;
  chartData?: { date: string; value: number }[];
};

// Types for performance data
type PerformanceData = {
  date: string;
  user: number;
  opponent: number;
};

interface UserComparisonProps {
  opponentId: number;
  onBack: () => void;
}

export function UserComparison({ opponentId, onBack }: UserComparisonProps) {
  const { user } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [opponentData, setOpponentData] = useState<UserData | null>(null);
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Fetch user and opponent data
  const fetchData = async (forceRefresh = false) => {
    if (!user) return;
    
    try {
      setLoading(true);
      if (forceRefresh) setRefreshing(true);
      
      const refreshParam = forceRefresh ? '?refresh=true' : '';
      
      // Fetch leaderboard data to get both users
      const response = await fetch(`/api/leaderboard${refreshParam}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch leaderboard data');
      }
      
      const leaderboardData = await response.json();
      
      // Find current user and opponent in leaderboard data
      const currentUserData = leaderboardData.find((u: any) => u.id === user.id);
      const opponentUserData = leaderboardData.find((u: any) => u.id === opponentId);
      
      if (!currentUserData || !opponentUserData) {
        throw new Error('Could not find user data');
      }
      
      setUserData(currentUserData);
      setOpponentData(opponentUserData);
      
      // Generate performance data from chart data
      if (currentUserData.chartData && opponentUserData.chartData) {
        const combinedData: PerformanceData[] = [];
        
        // Get all unique dates
        const allDates = new Set([
          ...currentUserData.chartData.map((item: { date: string }) => item.date),
          ...opponentUserData.chartData.map((item: { date: string }) => item.date)
        ]);
        
        // Sort dates
        const sortedDates = Array.from(allDates).sort((a, b) => 
          new Date(a).getTime() - new Date(b).getTime()
        );
        
        // Take the last 7 dates or fewer if not available
        const recentDates = sortedDates.slice(-7);
        
        // Create combined data
        recentDates.forEach(date => {
          const userPoint = currentUserData.chartData?.find((d: { date: string }) => d.date === date);
          const opponentPoint = opponentUserData.chartData?.find((d: { date: string }) => d.date === date);
          
          combinedData.push({
            date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            user: userPoint?.value || 0,
            opponent: opponentPoint?.value || 0
          });
        });
        
        setPerformanceData(combinedData);
      }
      
    } catch (err) {
      console.error("Failed to fetch comparison data:", err);
      setError("Failed to load comparison data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, opponentId]);

  // Format currency
  const formatCurrency = (value: string) => {
    return value;
  };

  // Parse percentage from string
  const parsePercentage = (value: string) => {
    return parseFloat(value);
  };

  // Calculate who's winning
  const userIsWinning = userData && opponentData 
    ? parsePercentage(userData.totalGainPercentage) > parsePercentage(opponentData.totalGainPercentage)
    : false;
  
  const performanceDiff = userData && opponentData
    ? Math.abs(parsePercentage(userData.totalGainPercentage) - parsePercentage(opponentData.totalGainPercentage)).toFixed(2)
    : "0.00";

  // Stats to compare
  const getStatsToCompare = () => {
    if (!userData || !opponentData) return [];
    
    return [
      { 
        name: "Total Gain", 
        userValue: userData.totalGainPercentage + "%", 
        opponentValue: opponentData.totalGainPercentage + "%", 
        winner: parsePercentage(userData.totalGainPercentage) > parsePercentage(opponentData.totalGainPercentage) ? "user" : "opponent" 
      },
      { 
        name: "Weekly Gain", 
        userValue: userData.weeklyGainPercentage + "%", 
        opponentValue: opponentData.weeklyGainPercentage + "%", 
        winner: parsePercentage(userData.weeklyGainPercentage) > parsePercentage(opponentData.weeklyGainPercentage) ? "user" : "opponent" 
      },
      { 
        name: "Daily Gain", 
        userValue: userData.dailyGainPercentage + "%", 
        opponentValue: opponentData.dailyGainPercentage + "%", 
        winner: parsePercentage(userData.dailyGainPercentage) > parsePercentage(opponentData.dailyGainPercentage) ? "user" : "opponent" 
      },
      { 
        name: "Portfolio Value", 
        userValue: userData.currentWorth, 
        opponentValue: opponentData.currentWorth, 
        winner: parseFloat(userData.currentWorth.replace(/[^0-9.-]+/g, "")) > parseFloat(opponentData.currentWorth.replace(/[^0-9.-]+/g, "")) ? "user" : "opponent" 
      },
    ];
  };

  // Chart config
  const chartConfig = {
    user: {
      label: "Your Portfolio",
      color: "hsl(var(--chart-1))",
    },
    opponent: {
      label: opponentData?.username || "Opponent",
      color: "hsl(var(--chart-2))",
    },
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-background">
        <header className="sticky top-0 z-10 bg-background p-4 flex items-center justify-between border-b border-border">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold">Portfolio Battle</h1>
          <div className="w-9"></div>
        </header>
        
        <div className="flex-1 overflow-auto">
          <div className="p-4 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-20 w-20 rounded-full mx-auto" />
              <Skeleton className="h-20 w-20 rounded-full mx-auto" />
            </div>
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full bg-background">
        <header className="sticky top-0 z-10 bg-background p-4 flex items-center justify-between border-b border-border">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold">Portfolio Battle</h1>
          <div className="w-9"></div>
        </header>
        
        <div className="flex-1 overflow-auto">
          <div className="p-4 flex flex-col items-center justify-center h-full">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={() => fetchData(true)}>Try Again</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="sticky top-0 z-10 bg-background p-4 flex items-center justify-between border-b border-border">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold">Portfolio Battle</h1>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => fetchData(true)}
          disabled={refreshing}
        >
          <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      </header>

      <div className="flex-1 overflow-auto">
        <div className="p-4 space-y-6">
          {/* VS Header */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-background border-4 border-background rounded-full h-12 w-12 flex items-center justify-center text-xl font-bold z-10">
                VS
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col items-center">
                <Avatar className="h-20 w-20 mb-2">
                  <AvatarImage src={userData?.avatar} alt={userData?.username} />
                  <AvatarFallback>{userData?.username?.charAt(0) || 'U'}</AvatarFallback>
                </Avatar>
                <h2 className="font-bold text-center">{userData?.username || "You"}</h2>
                <Badge className="mt-1 bg-green-500 text-white">
                  {userData?.totalGainPercentage}%
                </Badge>
              </div>

              <div className="flex flex-col items-center">
                <Avatar className="h-20 w-20 mb-2">
                  <AvatarImage src={opponentData?.avatar} alt={opponentData?.username} />
                  <AvatarFallback>{opponentData?.username?.charAt(0) || 'O'}</AvatarFallback>
                </Avatar>
                <h2 className="font-bold text-center">{opponentData?.username || "Opponent"}</h2>
                <Badge className="mt-1 bg-blue-500 text-white">
                  {opponentData?.totalGainPercentage}%
                </Badge>
              </div>
            </div>
          </div>

          {/* Winner Card */}
          <Card className={userIsWinning ? "bg-green-500/10 border-green-500/30" : "bg-blue-500/10 border-blue-500/30"}>
            <CardContent className="p-4 flex flex-col items-center">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className={`h-5 w-5 ${userIsWinning ? "text-green-500" : "text-blue-500"}`} />
                <h3 className="font-bold">
                  {userIsWinning ? "You're Ahead!" : `${opponentData?.username || "Opponent"} is Leading`}
                </h3>
              </div>
              <p className="text-center text-sm mb-3">
                {userIsWinning 
                  ? `You're outperforming by ${performanceDiff}%` 
                  : `Trailing by ${performanceDiff}%`
                }
              </p>
              <div className="w-full bg-muted rounded-full h-2.5 mb-1">
                <div
                  className={`h-2.5 rounded-full ${userIsWinning ? "bg-green-500" : "bg-blue-500"}`}
                  style={{
                    width: `${userIsWinning 
                      ? Math.min(50 + parseFloat(performanceDiff) * 2, 90) 
                      : Math.max(10, 50 - parseFloat(performanceDiff) * 2)}%`,
                  }}
                ></div>
              </div>
              <div className="flex justify-between w-full text-xs text-muted-foreground">
                <span>You</span>
                <span>{opponentData?.username || "Opponent"}</span>
              </div>
            </CardContent>
          </Card>

          {/* Portfolio Values */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm text-muted-foreground mb-1">Your Portfolio</h3>
                <p className="text-lg font-bold">{userData?.currentWorth}</p>
                <div className={`text-sm ${parsePercentage(userData?.totalGainPercentage || "0") >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {userData?.totalGain} ({userData?.totalGainPercentage}%)
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm text-muted-foreground mb-1">Their Portfolio</h3>
                <p className="text-lg font-bold">{opponentData?.currentWorth}</p>
                <div className={`text-sm ${parsePercentage(opponentData?.totalGainPercentage || "0") >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {opponentData?.totalGain} ({opponentData?.totalGainPercentage}%)
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Performance Chart */}
          {performanceData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Performance Comparison
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={performanceData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                      <XAxis dataKey="date" axisLine={false} tickLine={false} />
                      <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `$${value}`} width={40} />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-popover border border-border rounded-md shadow-md p-2 text-xs">
                                <p className="font-medium">{label}</p>
                                <p className="text-[hsl(var(--chart-1))]">You: ${payload[0].value}</p>
                                <p className="text-[hsl(var(--chart-2))]">
                                  {opponentData?.username}: ${payload[1].value}
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="user"
                        stroke="hsl(var(--chart-1))"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 6 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="opponent"
                        stroke="hsl(var(--chart-2))"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Stats Comparison */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center">
                <Target className="h-4 w-4 mr-2" />
                Stats Comparison
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {getStatsToCompare().map((stat, index) => (
                <div key={index} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{stat.name}</span>
                    <div className="flex items-center gap-1">
                      {stat.winner === "user" && <ChevronUp className="h-3 w-3 text-green-500" />}
                      {stat.winner === "opponent" && <ChevronDown className="h-3 w-3 text-red-500" />}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className={`text-xs px-2 py-1 rounded-md ${
                        stat.winner === "user" ? "bg-green-500/20 text-green-500" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {stat.userValue}
                    </div>
                    <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${stat.winner === "user" ? "bg-green-500" : "bg-blue-500"}`}
                        style={{ 
                          width: `${stat.winner === "user" ? 70 : 30}%`,
                          marginLeft: stat.winner === "opponent" ? "30%" : "0"
                        }}
                      />
                    </div>
                    <div
                      className={`text-xs px-2 py-1 rounded-md ${
                        stat.winner === "opponent" ? "bg-blue-500/20 text-blue-500" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {stat.opponentValue}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Time Period Comparison */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center">
                <TrendingUp className="h-4 w-4 mr-2" />
                Performance by Period
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <h4 className="text-xs text-muted-foreground mb-1">Daily</h4>
                    <div className="flex flex-col items-center">
                      <div className={`text-sm font-medium ${parsePercentage(userData?.dailyGainPercentage || "0") >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {userData?.dailyGainPercentage}%
                      </div>
                      <div className={`text-sm font-medium ${parsePercentage(opponentData?.dailyGainPercentage || "0") >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {opponentData?.dailyGainPercentage}%
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs text-muted-foreground mb-1">Weekly</h4>
                    <div className="flex flex-col items-center">
                      <div className={`text-sm font-medium ${parsePercentage(userData?.weeklyGainPercentage || "0") >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {userData?.weeklyGainPercentage}%
                      </div>
                      <div className={`text-sm font-medium ${parsePercentage(opponentData?.weeklyGainPercentage || "0") >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {opponentData?.weeklyGainPercentage}%
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs text-muted-foreground mb-1">All Time</h4>
                    <div className="flex flex-col items-center">
                      <div className={`text-sm font-medium ${parsePercentage(userData?.totalGainPercentage || "0") >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {userData?.totalGainPercentage}%
                      </div>
                      <div className={`text-sm font-medium ${parsePercentage(opponentData?.totalGainPercentage || "0") >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {opponentData?.totalGainPercentage}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 gap-4">
            <Button onClick={onBack}>Back to Leaderboard</Button>
          </div>
        </div>
      </div>
    </div>
  );
} 