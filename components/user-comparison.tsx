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
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid } from "recharts";

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
  const [isMobile, setIsMobile] = useState(false);
  const [userTopStocks, setUserTopStocks] = useState<any[]>([]);
  const [opponentTopStocks, setOpponentTopStocks] = useState<any[]>([]);
  const [stocksLoading, setStocksLoading] = useState(true);

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
      
      // Fetch top stocks for both users
      await Promise.all([
        fetchUserTopStocks(user.id, forceRefresh),
        fetchUserTopStocks(opponentId, forceRefresh)
      ]);
      
      // Try to fetch real performance data first
      try {
        const days = 30; // Get 30 days of data for comparison (1 month)
        const forceParam = forceRefresh ? '&force=true' : '';
        
        // Fetch current user's performance data
        const userPerformanceResponse = await fetch(`/api/portfolio/performance?userId=${user.id}&days=${days}${forceParam}`);
        
        // Fetch opponent's performance data
        const opponentPerformanceResponse = await fetch(`/api/portfolio/performance?userId=${opponentId}&days=${days}${forceParam}`);
        
        if (userPerformanceResponse.ok && opponentPerformanceResponse.ok) {
          const userPerformanceData = await userPerformanceResponse.json();
          const opponentPerformanceData = await opponentPerformanceResponse.json();
          
          console.log("User performance data:", userPerformanceData);
          console.log("Opponent performance data:", opponentPerformanceData);
          
          // Check if we have enough data points
          const hasEnoughUserData = userPerformanceData.performance && userPerformanceData.performance.length >= 3;
          const hasEnoughOpponentData = opponentPerformanceData.performance && opponentPerformanceData.performance.length >= 3;
          
          if (hasEnoughUserData && hasEnoughOpponentData) {
            // Calculate percentage change for each user
            const calculatePercentageChange = (data: any[]) => {
              if (!data || data.length === 0) return [];
              
              const firstValue = data[0].value;
              return data.map(item => ({
                date: item.date,
                value: firstValue > 0 ? ((item.value / firstValue) - 1) * 100 : 0
              }));
            };
            
            const userPercentageData = calculatePercentageChange(userPerformanceData.performance);
            const opponentPercentageData = calculatePercentageChange(opponentPerformanceData.performance);
            
            console.log("User percentage data:", userPercentageData);
            console.log("Opponent percentage data:", opponentPercentageData);
            
            // Get all unique dates
            const allDates = new Set([
              ...userPercentageData.map((item: { date: string }) => item.date),
              ...opponentPercentageData.map((item: { date: string }) => item.date)
            ]);
            
            // Sort dates chronologically
            const sortedDates = Array.from(allDates).sort((a, b) => 
              new Date(a).getTime() - new Date(b).getTime()
            );
            
            // Create combined performance data
            const combinedData: PerformanceData[] = [];
            
            sortedDates.forEach(date => {
              const userPoint = userPercentageData.find((d: { date: string }) => d.date === date);
              const opponentPoint = opponentPercentageData.find((d: { date: string }) => d.date === date);
              
              // Ensure we have valid numeric values
              const userValue = userPoint?.value || 0;
              const opponentValue = opponentPoint?.value || 0;
              
              combinedData.push({
                date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                user: Number(userValue.toFixed(2)),
                opponent: Number(opponentValue.toFixed(2))
              });
            });
            
            console.log("Combined performance data:", combinedData);
            
            // If we have data, set it
            if (combinedData.length > 0) {
              setPerformanceData(combinedData);
            } else {
              setError("No performance data available");
            }
          } else {
            setError("Insufficient performance data");
          }
        } else {
          setError("Failed to fetch performance data");
        }
      } catch (error) {
        console.error("Error fetching performance data:", error);
        setError("Error processing performance data");
      }
      
    } catch (err) {
      console.error("Failed to fetch comparison data:", err);
      setError("Failed to load comparison data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch top stocks for a user
  const fetchUserTopStocks = async (userId: number, forceRefresh = false) => {
    try {
      setStocksLoading(true);
      const refreshParam = forceRefresh ? '?refresh=true' : '';
      
      const response = await fetch(`/api/portfolio?userId=${userId}${refreshParam}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch stocks for user ${userId}`);
      }
      
      const data = await response.json();
      
      if (!data.stocks || data.stocks.length === 0) {
        if (userId === user?.id) {
          setUserTopStocks([]);
        } else {
          setOpponentTopStocks([]);
        }
        return;
      }
      
      // Sort stocks by gain percentage (descending)
      const sortedStocks = [...data.stocks].sort((a, b) => b.gainPercentage - a.gainPercentage);
      
      // Get top 3 stocks
      const topStocks = sortedStocks.slice(0, 3);
      
      if (userId === user?.id) {
        setUserTopStocks(topStocks);
      } else {
        setOpponentTopStocks(topStocks);
      }
    } catch (error) {
      console.error(`Error fetching top stocks for user ${userId}:`, error);
    } finally {
      setStocksLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, opponentId]);

  // Detect mobile devices
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    // Check on mount
    checkMobile();
    
    // Add resize listener
    window.addEventListener('resize', checkMobile);
    
    // Clean up
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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

          {/* Top Stocks */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-black/20 border-0">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-sm">Your Top Stocks</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                {stocksLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-6 w-full" />
                  </div>
                ) : userTopStocks.length > 0 ? (
                  <div className="space-y-3">
                    {userTopStocks.map((stock) => (
                      <div key={stock.id} className="flex justify-between items-center">
                        <span className="font-medium text-white">{stock.symbol}</span>
                        <span className={`${stock.gainPercentage >= 0 ? 'text-green-500' : 'text-red-500'} font-medium`}>
                          {stock.gainPercentage >= 0 ? '+' : ''}{stock.gainPercentage.toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No stocks found</p>
                )}
              </CardContent>
            </Card>
            
            <Card className="bg-black/20 border-0">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-sm">Their Top Stocks</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                {stocksLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-6 w-full" />
                  </div>
                ) : opponentTopStocks.length > 0 ? (
                  <div className="space-y-3">
                    {opponentTopStocks.map((stock) => (
                      <div key={stock.id} className="flex justify-between items-center">
                        <span className="font-medium text-white">{stock.symbol}</span>
                        <span className={`${stock.gainPercentage >= 0 ? 'text-green-500' : 'text-red-500'} font-medium`}>
                          {stock.gainPercentage >= 0 ? '+' : ''}{stock.gainPercentage.toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No stocks found</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Performance Chart */}
          <Card className="overflow-hidden">
            <CardHeader className="pb-1 px-4 pt-3">
              <CardTitle className="text-sm flex items-center justify-between">
                <div className="flex items-center">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  30-Day Performance Comparison
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-5 w-5" 
                  onClick={() => fetchData(true)}
                  disabled={refreshing}
                >
                  <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className={`${isMobile ? 'p-2' : 'p-4'}`}>
              <div className={`${isMobile ? 'h-[160px]' : 'h-[200px]'}`}>
                {performanceData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={performanceData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.2} />
                      <XAxis 
                        dataKey="date" 
                        axisLine={false} 
                        tickLine={false}
                        tick={{ fill: '#aaa', fontSize: 9 }}
                        tickCount={isMobile ? 3 : 5}
                        minTickGap={20}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tickFormatter={(value) => `${value.toFixed(0)}%`} 
                        width={30}
                        tick={{ fill: '#aaa', fontSize: 9 }}
                        domain={['dataMin - 5', 'dataMax + 5']}
                        tickCount={3}
                        padding={{ top: 10, bottom: 10 }}
                      />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length >= 2) {
                            return (
                              <div className="bg-black/90 border-0 rounded-md shadow-md p-1.5 text-[10px]">
                                <p className="font-medium">{label}</p>
                                <p style={{ color: '#3b82f6' }}>
                                  You: {payload[0]?.value !== undefined && typeof payload[0].value === 'number' 
                                    ? payload[0].value.toFixed(2) 
                                    : '0'}%
                                </p>
                                <p style={{ color: '#10b981' }}>
                                  {opponentData?.username}: {payload[1]?.value !== undefined && typeof payload[1].value === 'number' 
                                    ? payload[1].value.toFixed(2) 
                                    : '0'}%
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
                      <Line
                        type="monotone"
                        dataKey="user"
                        name="Your Performance"
                        stroke="#3b82f6"
                        strokeWidth={3}
                        dot={{ r: 3, fill: "#3b82f6", strokeWidth: 0 }}
                        activeDot={{ r: 5, fill: "#3b82f6", strokeWidth: 0 }}
                        isAnimationActive={false}
                        connectNulls={true}
                      />
                      <Line
                        type="monotone"
                        dataKey="opponent"
                        name="Opponent Performance"
                        stroke="#10b981"
                        strokeWidth={3}
                        dot={{ r: 3, fill: "#10b981", strokeWidth: 0 }}
                        activeDot={{ r: 5, fill: "#10b981", strokeWidth: 0 }}
                        isAnimationActive={false}
                        connectNulls={true}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-2">
                    <p className="text-muted-foreground text-xs">
                      {error ? error : "Loading data..."}
                    </p>
                    {error && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => fetchData(true)}
                        className="text-xs h-7 px-2"
                      >
                        Retry
                      </Button>
                    )}
                  </div>
                )}
              </div>
              {/* Simplified legend */}
              <div className="flex justify-center gap-3 text-[10px] text-muted-foreground mt-0">
                <div className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-[#3b82f6] mr-1"></div>
                  <span>You</span>
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-[#10b981] mr-1"></div>
                  <span>{opponentData?.username}</span>
                </div>
              </div>
            </CardContent>
          </Card>

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