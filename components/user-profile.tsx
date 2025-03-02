"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { Combobox } from "@/components/ui/combobox";

// Types for stock data matching what we have in user-portfolio.tsx
type Stock = {
  id: number;
  symbol: string;
  companyName: string;
  quantity: number;
  purchasePrice: number;
  purchaseDate: string;
  currentPrice: number;
  currentValue: number;
  historicalPrice: number;
  gain: number;
  gainPercentage: number;
};

type PortfolioSummary = {
  totalCurrentValue: number;
  totalPurchaseValue: number;
  totalGain: number;
  totalGainPercentage: number;
};

// New type for performance data
type PerformanceData = {
  date: string;
  value: number;
};

// New type for comparison data
type ComparisonOption = {
  id: string;
  name: string;
  type: 'index' | 'user';
  performance?: PerformanceData[];
};

type ProfileProps = {
  userId: number;
  userName: string;
  onBack: () => void;
};

export function UserProfile({ userId, userName, onBack }: ProfileProps) {
  const { user } = useAuth();
  const [portfolio, setPortfolio] = useState<Stock[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Performance data states
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [performanceLoading, setPerformanceLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("stocks");
  
  // New states for comparison feature
  const [comparisonOptions, setComparisonOptions] = useState<ComparisonOption[]>([
    { id: 'sp500', name: 'S&P 500', type: 'index' },
    { id: 'nasdaq', name: 'Nasdaq', type: 'index' },
  ]);
  const [selectedComparisons, setSelectedComparisons] = useState<string[]>([]);
  const [comparisonData, setComparisonData] = useState<Record<string, PerformanceData[]>>({});
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [usersList, setUsersList] = useState<{id: number, name: string}[]>([]);
  const [searchValue, setSearchValue] = useState("");
  
  // State for hover tooltip
  const [tooltipData, setTooltipData] = useState<{
    visible: boolean, 
    x: number, 
    y: number, 
    values: {id: string, name: string, value: string, color: string}[],
    date: string
  }>({
    visible: false,
    x: 0,
    y: 0,
    values: [],
    date: ''
  });
  
  // Ref to track if the component is mounted
  const isMounted = React.useRef(true);
  
  // Effect to clear the mounted flag on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  // Function to refresh today's data point only
  const refreshTodayData = async () => {
    if (!userId || !summary) return;
    
    try {
      const days = getOldestPurchaseDate();
      
      // First try a complete refresh with force=true parameter
      const response = await fetch(`/api/portfolio/performance?userId=${userId}&days=${days}&refresh=true&force=true`);
      
      if (!response.ok) return;
      
      const data = await response.json();
      
      if (data.performance && Array.isArray(data.performance) && data.performance.length > 0) {
        // Only update if component is still mounted
        if (isMounted.current) {
          // Replace the entire performance data with the new data
          setPerformanceData(data.performance);
          
          // Log information about the data range
          console.log(`Refreshed performance data with ${data.performance.length} points from ${data.performance[0]?.date} to ${data.performance[data.performance.length-1]?.date}`);
        }
      }
    } catch (error) {
      console.error("Error refreshing performance data:", error);
    }
  };
  
  // Set up auto-refresh for today's data during market hours (9:30 AM - 4:00 PM ET, Mon-Fri)
  useEffect(() => {
    const isMarketHours = () => {
      const now = new Date();
      const day = now.getDay();
      const hour = now.getHours();
      const minute = now.getMinutes();
      
      // Convert to ET (adjust as needed for your timezone)
      // This is a simple approximation - for precise timezone handling, consider a library
      const etHour = (hour + 24 - 5) % 24; // Assuming 5 hours behind for ET
      
      // Market hours: Mon-Fri, 9:30 AM - 4:00 PM ET
      return day >= 1 && day <= 5 && // Monday to Friday
             ((etHour === 9 && minute >= 30) || // 9:30 AM or later
              (etHour > 9 && etHour < 16) ||    // 10 AM to 3:59 PM
              (etHour === 16 && minute === 0));  // 4:00 PM exactly
    };
    
    // Refresh immediately
    if (summary) {
      refreshTodayData();
    }
    
    // Set up interval for auto-refresh (every 5 minutes during market hours)
    const intervalId = setInterval(() => {
      if (summary && isMarketHours()) {
        refreshTodayData();
      }
    }, 5 * 60 * 1000); // 5 minutes
    
    return () => {
      clearInterval(intervalId);
    };
  }, [summary, userId]);
  
  // Find oldest purchase date from portfolio
  const getOldestPurchaseDate = () => {
    if (!portfolio || portfolio.length === 0) return '180'; // default to 180 days
    
    const dates = portfolio.map(stock => new Date(stock.purchaseDate).getTime());
    const oldestDate = new Date(Math.min(...dates));
    const now = new Date();
    
    // Calculate difference in days
    const diffTime = Math.abs(now.getTime() - oldestDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Add a small buffer for better visualization (10% more days)
    return String(Math.ceil(diffDays * 1.1));
  };
  
  // Fetch portfolio data for the user
  useEffect(() => {
    const fetchPortfolio = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/portfolio?userId=${userId}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch portfolio data');
        }
        
        const data = await response.json();
        setPortfolio(data.stocks);
        setSummary(data.summary);
      } catch (err) {
        console.error("Failed to fetch portfolio data:", err);
        setError("Failed to load portfolio data");
      } finally {
        setLoading(false);
      }
    };

    fetchPortfolio();
  }, [userId]);

  // Effect to fetch performance data
  useEffect(() => {
    const fetchPerformanceData = async () => {
      try {
        setPerformanceLoading(true);
        
        // Use oldest purchase date to now
        const days = getOldestPurchaseDate();
        
        // Always use force=true to ensure complete data
        const response = await fetch(`/api/portfolio/performance?userId=${userId}&days=${days}&refresh=true&force=true`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch performance data');
        }
        
        const data = await response.json();
        
        if (data.performance && Array.isArray(data.performance) && data.performance.length > 0) {
          // Log the date range of the data to help with debugging
          console.log(`Fetched ${data.performance.length} performance data points from ${data.performance[0]?.date} to ${data.performance[data.performance.length-1]?.date}`);
          
          // Sort performance data by date to ensure chronological display
          const sortedData = [...data.performance].sort((a, b) => 
            new Date(a.date).getTime() - new Date(b.date).getTime()
          );

          // Ensure we have data for each day - fill in any gaps
          const firstDate = new Date(sortedData[0].date);
          const lastDate = new Date(sortedData[sortedData.length - 1].date);
          const fullDateRange: PerformanceData[] = [];
          
          // Create a continuous date range
          const currentDate = new Date(firstDate);
          let prevValue = sortedData[0].value;
          
          while (currentDate <= lastDate) {
            const dateStr = currentDate.toISOString().split('T')[0];
            const existingPoint = sortedData.find(p => p.date === dateStr);
            
            if (existingPoint) {
              fullDateRange.push(existingPoint);
              prevValue = existingPoint.value;
            } else {
              // If no data for this date, use previous value (flat line)
              fullDateRange.push({
                date: dateStr,
                value: prevValue
              });
            }
            
            // Move to next day
            currentDate.setDate(currentDate.getDate() + 1);
          }
          
          setPerformanceData(fullDateRange);
        } else {
          // If no performance data or invalid format, generate mock data
          if (summary) {
            // Generate some mock data for the chart
            const today = new Date();
            const mockData: PerformanceData[] = [];
            
            // Generate data from oldest purchase date to now
            for (let i = parseInt(days); i >= 0; i--) {
              const date = new Date(today);
              date.setDate(date.getDate() - i);
              
              // Random fluctuation between -3% and +3% day to day
              const randomFactor = 0.97 + Math.random() * 0.06;
              
              // If first day, use the actual current value as base
              const prevValue = i === parseInt(days) ? summary.totalCurrentValue * 0.9 : mockData[mockData.length - 1].value;
              const value = i === 0 ? summary.totalCurrentValue : prevValue * randomFactor;
              
              mockData.push({
                date: date.toISOString().split('T')[0],
                value: value
              });
            }
            
            setPerformanceData(mockData);
          }
        }
      } catch (error) {
        console.error("Failed to fetch performance data:", error);
        
        // Fall back to mock data
        if (summary) {
          const today = new Date();
          const mockData: PerformanceData[] = [];
          
          const days = getOldestPurchaseDate();
          for (let i = parseInt(days); i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            
            const randomFactor = 0.97 + Math.random() * 0.06;
            const prevValue = i === parseInt(days) ? summary.totalCurrentValue * 0.9 : mockData[mockData.length - 1].value;
            const value = i === 0 ? summary.totalCurrentValue : prevValue * randomFactor;
            
            mockData.push({
              date: date.toISOString().split('T')[0],
              value: value
            });
          }
          
          setPerformanceData(mockData);
        }
      } finally {
        setPerformanceLoading(false);
      }
    };
    
    if (summary) {
      fetchPerformanceData();
    }
  }, [summary, userId, portfolio]);

  // Effect to fetch users for comparison
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch('/api/leaderboard');
        if (!response.ok) {
          throw new Error('Failed to fetch users');
        }
        
        const data = await response.json();
        if (data.leaderboard && Array.isArray(data.leaderboard)) {
          // Filter out the current user being viewed
          const otherUsers = data.leaderboard
            .filter((u: any) => u.id !== userId)
            .map((u: any) => ({
              id: u.id,
              name: u.name
            }));
          
          // Add users to comparison options
          setComparisonOptions(prev => [
            ...prev.filter(o => o.type === 'index'),
            ...otherUsers.map((u: {id: number, name: string}) => ({ 
              id: `user-${u.id}`, 
              name: u.name, 
              type: 'user' as const
            }))
          ]);
          
          setUsersList(otherUsers);
          
          // If viewing someone else's profile, automatically add current user for comparison
          if (user && user.id !== userId) {
            setSelectedComparisons(prev => 
              prev.includes(`user-${user.id}`) ? 
                prev : 
                [...prev, `user-${user.id}`]
            );
          }
        }
      } catch (error) {
        console.error("Failed to fetch users for comparison:", error);
      }
    };
    
    fetchUsers();
  }, [userId, user]);

  // Effect to fetch comparison data
  useEffect(() => {
    // Don't return early if viewing someone else's profile and the current user exists
    const shouldFetchCurrentUserComparison = user && user.id !== userId;
    if ((selectedComparisons.length === 0 && !shouldFetchCurrentUserComparison) || !performanceData.length) return;
    
    const fetchComparisonData = async () => {
      setComparisonLoading(true);
      
      const newComparisonData: Record<string, PerformanceData[]> = {};
      const days = getOldestPurchaseDate();
      
      // If viewing someone else's profile, automatically fetch current user data
      if (shouldFetchCurrentUserComparison) {
        try {
          const currentUserId = `user-${user.id}`;
          // Skip if already in the selected comparisons
          if (!selectedComparisons.includes(currentUserId)) {
            // Use force=true to ensure complete data from beginning to now
            const response = await fetch(`/api/portfolio/performance?userId=${user.id}&days=${days}&force=true`);
            
            if (response.ok) {
              const data = await response.json();
              if (data.performance && Array.isArray(data.performance)) {
                // Sort data chronologically
                const sortedData = [...data.performance].sort((a, b) => 
                  new Date(a.date).getTime() - new Date(b.date).getTime()
                );
                console.log(`Current user comparison data: ${sortedData.length} points from ${sortedData[0]?.date} to ${sortedData[sortedData.length-1]?.date}`);
                
                // Fill gaps in data to ensure continuous timeline
                const filledData = fillDateGaps(sortedData);
                newComparisonData[currentUserId] = filledData;
              }
            }
          }
        } catch (error) {
          console.error(`Failed to fetch current user comparison data:`, error);
        }
      }
      
      // Fetch other selected comparisons
      for (const comparisonId of selectedComparisons) {
        try {
          if (comparisonId === 'sp500' || comparisonId === 'nasdaq') {
            // Fetch index data with force=true
            const response = await fetch(`/api/market-index?index=${comparisonId}&days=${days}&force=true`);
            
            if (response.ok) {
              const data = await response.json();
              if (data.performance && Array.isArray(data.performance)) {
                // Sort data chronologically
                const sortedData = [...data.performance].sort((a, b) => 
                  new Date(a.date).getTime() - new Date(b.date).getTime()
                );
                console.log(`${comparisonId} data: ${sortedData.length} points from ${sortedData[0]?.date} to ${sortedData[sortedData.length-1]?.date}`);
                
                // Fill gaps in data
                const filledData = fillDateGaps(sortedData);
                newComparisonData[comparisonId] = filledData;
              } else {
                // Generate mock data for indices if API not implemented
                newComparisonData[comparisonId] = generateMockIndexData(
                  comparisonId, 
                  performanceData.map(p => p.date)
                );
              }
            } else {
              // Fallback to mock data
              newComparisonData[comparisonId] = generateMockIndexData(
                comparisonId, 
                performanceData.map(p => p.date)
              );
            }
          } else if (comparisonId.startsWith('user-')) {
            // Fetch other user data with force=true
            const otherUserId = comparisonId.split('user-')[1];
            const response = await fetch(`/api/portfolio/performance?userId=${otherUserId}&days=${days}&force=true`);
            
            if (response.ok) {
              const data = await response.json();
              if (data.performance && Array.isArray(data.performance)) {
                // Sort data chronologically
                const sortedData = [...data.performance].sort((a, b) => 
                  new Date(a.date).getTime() - new Date(b.date).getTime()
                );
                console.log(`${comparisonId} data: ${sortedData.length} points from ${sortedData[0]?.date} to ${sortedData[sortedData.length-1]?.date}`);
                
                // Fill gaps in data
                const filledData = fillDateGaps(sortedData);
                newComparisonData[comparisonId] = filledData;
              }
            }
          }
        } catch (error) {
          console.error(`Failed to fetch comparison data for ${comparisonId}:`, error);
        }
      }
      
      setComparisonData(prev => ({...prev, ...newComparisonData}));
      setComparisonLoading(false);
    };
    
    fetchComparisonData();
  }, [selectedComparisons, performanceData, user, userId, portfolio]);

  // Helper function to generate mock index data
  const generateMockIndexData = (index: string, dates: string[]): PerformanceData[] => {
    const mockData: PerformanceData[] = [];
    let baseValue = index === 'sp500' ? 4500 : 14000; // Starting values
    
    // Create a map to make lookup of existing dates easier
    const dateMap = new Set(dates);
    
    // Find the earliest and latest dates
    if (dates.length === 0) return mockData;
    
    const sortedDates = [...dates].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    const firstDate = new Date(sortedDates[0]);
    const lastDate = new Date(sortedDates[sortedDates.length - 1]);
    
    // Generate a continuous series of dates
    const currentDate = new Date(firstDate);
    while (currentDate <= lastDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      
      // Different trends for indices
      const trend = index === 'sp500' ? 1.0007 : 1.0006; // Slightly different growth rates
      const volatility = index === 'sp500' ? 0.008 : 0.01; // Different volatility
      
      // Random daily change but with a slight upward trend
      const dailyChange = trend * (1 - volatility + Math.random() * volatility * 2);
      
      if (mockData.length > 0) {
        baseValue = mockData[mockData.length - 1].value * dailyChange;
      }
      
      mockData.push({
        date: dateStr,
        value: baseValue
      });
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return mockData;
  };
  
  // Helper function to normalize performance data for comparison
  const normalizePerformanceData = (
    data: PerformanceData[], 
    baseValue: number = 100
  ): PerformanceData[] => {
    if (!data || data.length === 0) return [];
    
    // Check if we have data for the entire selected time range
    // For example, if we selected 1 year but only have 30 days of data
    const days = getOldestPurchaseDate();
    const dataSpanDays = data.length > 1 ? 
      Math.round((new Date(data[data.length-1].date).getTime() - new Date(data[0].date).getTime()) / (1000 * 60 * 60 * 24)) 
      : 0;
    
    // If we have less than half the requested data span, return empty array
    // This will cause the chart to show no data for this series
    if (dataSpanDays < parseInt(days) * 0.5) {
      return [];
    }
    
    const firstValue = data[0].value;
    if (firstValue === 0) return data.map(point => ({ ...point, value: baseValue }));
    
    return data.map(point => ({
      date: point.date,
      value: (point.value / firstValue) * baseValue
    }));
  };

  // Handle comparison selection
  const handleComparisonChange = (value: string) => {
    if (!value || value.trim() === "") return;
    
    setSelectedComparisons(prev => {
      // Create a new Set from the previous array to ensure uniqueness
      const uniqueComparisons = new Set(prev);
      
      // Toggle selection
      if (uniqueComparisons.has(value)) {
        uniqueComparisons.delete(value);
      } else {
        // Limit to 3 comparisons
        uniqueComparisons.add(value);
        if (uniqueComparisons.size > 3) {
          // Get the first item and remove it (convert to array first)
          const firstItem = Array.from(uniqueComparisons)[0];
          uniqueComparisons.delete(firstItem);
        }
      }
      
      return Array.from(uniqueComparisons);
    });
    
    // Reset search value
    setSearchValue("");
  };

  // Get color for each data series
  const getSeriesColor = (id: string) => {
    // Check if this is the current user's portfolio
    if (user && id === `user-${user.id}`) {
      return 'bg-green-500';
    }
    
    const colorMap: Record<string, string> = {
      'portfolio': 'bg-blue-500',
      'portfolioArea': 'from-blue-500/50 to-blue-500/5',
      'portfolioLine': 'bg-blue-500',
      'sp500': 'bg-green-500',
      'sp500Area': 'from-green-500/50 to-green-500/5',
      'sp500Line': 'bg-green-500',
      'nasdaq': 'bg-purple-500',
      'nasdaqArea': 'from-purple-500/50 to-purple-500/5',
      'nasdaqLine': 'bg-purple-500',
    };
    
    // For other user comparisons
    if (id.startsWith('user-')) {
      return 'bg-amber-500';
    }
    
    return colorMap[id] || 'bg-gray-500';
  };

  // Get text color for labels
  const getTextColor = (id: string) => {
    // Check if this is the current user's portfolio
    if (user && id === `user-${user.id}`) {
      return 'text-green-500';
    }
    
    const colorMap: Record<string, string> = {
      'portfolio': 'text-blue-500',
      'sp500': 'text-green-500',
      'nasdaq': 'text-purple-500',
    };
    
    // For other user comparisons
    if (id.startsWith('user-')) {
      return 'text-amber-500';
    }
    
    return colorMap[id] || 'text-gray-500';
  };

  // Format currency values
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  // Format percentage values
  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  // Get user initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  // Helper to calculate the overall performance
  const calculatePerformance = () => {
    if (performanceData.length < 2) return 0;
    
    // Check if we have data for the entire selected time range
    const days = getOldestPurchaseDate();
    const dataSpanDays = performanceData.length > 1 ? 
      Math.round((new Date(performanceData[performanceData.length-1].date).getTime() - new Date(performanceData[0].date).getTime()) / (1000 * 60 * 60 * 24)) 
      : 0;
    
    // If we have significantly less data than requested, return 0
    if (dataSpanDays < parseInt(days) * 0.5) {
      return 0;
    }
    
    const firstValue = performanceData[0].value;
    const lastValue = performanceData[performanceData.length - 1].value;
    
    return ((lastValue - firstValue) / firstValue) * 100;
  };

  // Helper to map stock symbols to their sectors
  const getStockSector = (symbol: string): string => {
    // Map of common stock symbols to their sectors
    const sectorMap: Record<string, string> = {
      // Technology
      'AAPL': 'Technology',
      'MSFT': 'Technology',
      'GOOGL': 'Technology',
      'GOOG': 'Technology',
      'META': 'Technology',
      'AMZN': 'Technology',
      'TSLA': 'Technology',
      'NVDA': 'Technology',
      'AMD': 'Technology',
      'INTC': 'Technology',
      'HOOD': 'Technology',
      'PYPL': 'Technology',
      'CRM': 'Technology',
      'ADBE': 'Technology',
      'NFLX': 'Technology',
      
      // Financial
      'JPM': 'Financial',
      'BAC': 'Financial',
      'WFC': 'Financial',
      'GS': 'Financial',
      'MS': 'Financial',
      'V': 'Financial',
      'MA': 'Financial',
      
      // Healthcare
      'JNJ': 'Healthcare',
      'PFE': 'Healthcare',
      'MRK': 'Healthcare',
      'UNH': 'Healthcare',
      'ABBV': 'Healthcare',
      
      // Consumer Cyclical
      'HD': 'Consumer Cyclical',
      'NKE': 'Consumer Cyclical',
      'SBUX': 'Consumer Cyclical',
      'MCD': 'Consumer Cyclical',
      'DIS': 'Consumer Cyclical',
      
      // Consumer Defensive
      'WMT': 'Consumer Defensive',
      'PG': 'Consumer Defensive',
      'KO': 'Consumer Defensive',
      'PEP': 'Consumer Defensive',
      
      // Energy
      'XOM': 'Energy',
      'CVX': 'Energy',
      
      // Communication
      'T': 'Communication',
      'VZ': 'Communication',
      
      // Industrial
      'BA': 'Industrial',
      'CAT': 'Industrial',
      'GE': 'Industrial'
    };
    
    return sectorMap[symbol] || 'Other';
  };
  
  // Calculate sector distribution based on actual portfolio
  const calculateSectorDistribution = () => {
    if (!portfolio.length || !summary) return [];
    
    const sectorValues: Record<string, number> = {};
    
    // Calculate the value of each stock and add it to its sector
    portfolio.forEach(stock => {
      const sector = getStockSector(stock.symbol);
      if (!sectorValues[sector]) {
        sectorValues[sector] = 0;
      }
      sectorValues[sector] += stock.currentValue;
    });
    
    // Convert to array format needed for visualization
    return Object.entries(sectorValues).map(([name, value]) => ({
      name,
      value,
      percentage: (value / summary.totalCurrentValue * 100).toFixed(1)
    }));
  };
  
  // Update the getSectorColor function to use more vibrant colors
  const getSectorColor = (sector: string): string => {
    const colorMap: { [key: string]: string } = {
      Technology: 'rgb(59, 130, 246)', // bright blue
      Healthcare: 'rgb(16, 185, 129)', // bright green
      Financial: 'rgb(245, 158, 11)', // bright amber
      Consumer: 'rgb(236, 72, 153)', // bright pink
      Energy: 'rgb(139, 92, 246)', // bright purple
      Telecom: 'rgb(6, 182, 212)', // bright cyan
      Materials: 'rgb(248, 113, 113)', // bright red
      Industrial: 'rgb(251, 146, 60)', // bright orange
      Utilities: 'rgb(124, 58, 237)', // bright violet
      Real: 'rgb(52, 211, 153)', // bright emerald
      'Consumer Discretionary': 'rgb(244, 114, 182)', // bright pink
      'Consumer Staples': 'rgb(251, 191, 36)', // bright yellow
    };

    return colorMap[sector] || 'rgb(156, 163, 175)'; // default: gray-400
  };
  
  // Calculate the sector distribution once
  const sectorDistribution = calculateSectorDistribution();

  // Get min and max values for the y-axis scale
  const getValueRange = () => {
    let values: number[] = [];
    
    // Convert performanceData to percentage changes
    if (performanceData.length > 0) {
      const firstValue = performanceData[0].value;
      values = performanceData.map(p => ((p.value / firstValue) - 1) * 100);
    }
    
    // Add comparison data to values (also as percentage changes)
    Object.entries(comparisonData).forEach(([compId, dataPoints]) => {
      if (dataPoints && dataPoints.length > 0) {
        const firstCompValue = dataPoints[0].value;
        values = values.concat(dataPoints.map(p => ((p.value / firstCompValue) - 1) * 100));
      }
    });
    
    if (values.length === 0) return { min: -10, max: 10 }; // Default range if no data
    
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    // Add some padding to the range (10%)
    const padding = Math.max(2, (max - min) * 0.1);
    
    return {
      min: min - padding,
      max: max + padding
    };
  };
  
  // Handle mouse movement for tooltips
  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!performanceData.length) return;
    
    const svgRect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - svgRect.left;
    const width = svgRect.width;
    
    // Calculate the index in the data array based on x position
    const xPercentage = x / width;
    const index = Math.min(
      Math.max(0, Math.round(xPercentage * (performanceData.length - 1))),
      performanceData.length - 1
    );
    
    if (index >= 0 && index < performanceData.length) {
      const point = performanceData[index];
      const firstValue = performanceData[0].value;
      // Calculate percentage change from the first value
      const percentChange = ((point.value / firstValue) - 1) * 100;
      
      const values = [{
        id: 'portfolio',
        name: userId === user?.id ? 'Your Portfolio' : `${userName}'s Portfolio`,
        value: `${percentChange.toFixed(2)}%`,
        color: '#3b82f6'
      }];
      
      // Add comparison values if available
      Object.entries(comparisonData).forEach(([compId, data]) => {
        if (data && data.length > 0 && index < data.length) {
          let compPoint = data[index];
          
          // Fallback to closest available data point if exact match doesn't exist
          if (!compPoint && data.length > 0) {
            const dataDate = new Date(point.date).getTime();
            let closestIdx = 0;
            let minDiff = Infinity;
            
            for (let i = 0; i < data.length; i++) {
              const diff = Math.abs(new Date(data[i].date).getTime() - dataDate);
              if (diff < minDiff) {
                minDiff = diff;
                closestIdx = i;
              }
            }
            
            compPoint = data[closestIdx];
          }
          
          if (compPoint) {
            const isCurrentUser = user && compId === `user-${user.id}`;
            const color = isCurrentUser 
              ? '#22c55e' // Green for current user
              : compId === 'sp500' 
              ? '#22c55e' 
              : compId === 'nasdaq' 
              ? '#a855f7' 
              : '#f59e0b';
            
            const option = comparisonOptions.find(o => o.id === compId);
            const name = isCurrentUser 
              ? 'Your Portfolio' 
              : (option?.name || 'Comparison');
            
            // Calculate percentage change for this comparison
            const compFirstValue = data[0].value;
            const compPercentChange = ((compPoint.value / compFirstValue) - 1) * 100;
            
            values.push({
              id: compId,
              name,
              value: `${compPercentChange.toFixed(2)}%`,
              color
            });
          }
        }
      });
      
      setTooltipData({
        visible: true,
        x: x,
        y: svgRect.height / 2, // Position tooltip vertically centered
        values,
        date: point.date
      });
    }
  };
  
  const handleMouseLeave = () => {
    setTooltipData(prev => ({ ...prev, visible: false }));
  };

  // Helper function to get industries for a sector
  const getIndustriesForSector = (sector: string, percentage: number): {name: string, percentage: number}[] => {
    // This is a simplified version - in a real implementation, this would be based on actual data
    switch(sector) {
      case 'Technology':
        return [
          { name: 'Semiconductors', percentage: 40 },
          { name: 'Tech Hardware', percentage: 30 },
          { name: 'Software', percentage: 30 }
        ];
      case 'Financial':
        return [
          { name: 'Banks', percentage: 60 },
          { name: 'Insurance', percentage: 40 }
        ];
      case 'Healthcare':
        return [
          { name: 'Pharma', percentage: 50 },
          { name: 'Medical Devices', percentage: 50 }
        ];
      case 'Consumer Cyclical':
        return [
          { name: 'Retail', percentage: 70 },
          { name: 'Automotive', percentage: 30 }
        ];
      case 'Energy':
        return [
          { name: 'Oil & Gas', percentage: 100 }
        ];
      case 'Communication':
        return [
          { name: 'Telecom', percentage: 50 },
          { name: 'Media', percentage: 50 }
        ];
      default:
        return [
          { name: sector, percentage: 100 }
        ];
    }
  };

  // Helper function to generate a smooth Sankey path
  const generateSankeyPath = (
    sourceX: number, 
    sourceY: number, 
    sourceHeight: number,
    targetX: number, 
    targetY: number, 
    targetHeight: number
  ): string => {
    // Control point distance (for the bezier curve)
    const controlPointDistance = (targetX - sourceX) * 0.5;
    
    // Create a curved path that maintains the flow width
    return `
      M ${sourceX} ${sourceY}
      C ${sourceX + controlPointDistance} ${sourceY}, ${targetX - controlPointDistance} ${targetY}, ${targetX} ${targetY}
      L ${targetX} ${targetY + targetHeight}
      C ${targetX - controlPointDistance} ${targetY + targetHeight}, ${sourceX + controlPointDistance} ${sourceY + sourceHeight}, ${sourceX} ${sourceY + sourceHeight}
      Z
    `;
  };

  // Add this helper function before the useEffect
  const fillDateGaps = (data: PerformanceData[]): PerformanceData[] => {
    if (!data || data.length === 0) return [];
    
    // Sort by date to ensure chronological order
    const sortedData = [...data].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    const firstDate = new Date(sortedData[0].date);
    const lastDate = new Date(sortedData[sortedData.length - 1].date);
    const fullDateRange: PerformanceData[] = [];
    
    // Create a continuous date range
    const currentDate = new Date(firstDate);
    let prevValue = sortedData[0].value;
    
    while (currentDate <= lastDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const existingPoint = sortedData.find(p => p.date === dateStr);
      
      if (existingPoint) {
        fullDateRange.push(existingPoint);
        prevValue = existingPoint.value;
      } else {
        // If no data for this date, use previous value (flat line)
        fullDateRange.push({
          date: dateStr,
          value: prevValue
        });
      }
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return fullDateRange;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center mb-6">
        <Button variant="ghost" onClick={onBack} className="mr-2">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h1 className="text-2xl font-bold">{userName}&apos;s Profile</h1>
      </div>

      {/* Portfolio Performance Card */}
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Performance (% Gain)</CardTitle>
        </CardHeader>
        <CardContent>
          {performanceLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : error ? (
            <p className="text-center text-red-500">{error}</p>
          ) : performanceData.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">
              {userId === user?.id ? 'You don\'t have any performance data yet' : 'This user has no performance data'}
            </p>
          ) : (
            <div>
              {/* Comparison selector */}
              <div className="flex items-center mb-4 gap-2">
                <span className="text-sm">Compare with:</span>
                <Combobox
                  options={comparisonOptions.map(option => ({
                    value: option.id,
                    label: option.name
                  }))}
                  value={searchValue}
                  onSelect={handleComparisonChange}
                  placeholder="Search users or indices..."
                  emptyText="No users found"
                  className="w-[240px]"
                />
              </div>
              
              {/* Selected comparison indicators */}
              <div className="flex flex-wrap gap-2 mb-4">
                <div className="inline-flex items-center px-2 py-1 rounded-full bg-blue-500/20 text-xs">
                  <span className="w-2 h-2 rounded-full bg-blue-500 mr-2"></span>
                  {userId === user?.id ? 'Your Portfolio' : `${userName}'s Portfolio`}
                </div>
                {Array.from(new Set(selectedComparisons)).map(compId => {
                  const option = comparisonOptions.find(o => o.id === compId);
                  // If this is the current user's comparison and we're viewing someone else's profile
                  const isCurrentUser = user && compId === `user-${user.id}`;
                  const color = isCurrentUser 
                    ? 'bg-green-500' 
                    : compId === 'sp500' 
                    ? 'bg-green-500' 
                    : compId === 'nasdaq' 
                    ? 'bg-purple-500' 
                    : 'bg-amber-500';
                  const bgColor = isCurrentUser 
                    ? 'bg-green-500/20' 
                    : compId === 'sp500' 
                    ? 'bg-green-500/20' 
                    : compId === 'nasdaq' 
                    ? 'bg-purple-500/20' 
                    : 'bg-amber-500/20';
                    
                  return (
                    <div key={compId} className={`inline-flex items-center px-2 py-1 rounded-full ${bgColor} text-xs`}>
                      <span className={`w-2 h-2 rounded-full ${color} mr-2`}></span>
                      {isCurrentUser ? 'Your Portfolio' : option?.name || 'Loading...'}
                      <button
                        className="ml-2 text-muted-foreground hover:text-foreground"
                        onClick={() => setSelectedComparisons(prev => prev.filter(id => id !== compId))}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
              
              {/* Chart area */}
              <div className="h-[300px] relative">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart 
                    data={performanceData.map((point, idx) => {
                      const firstValue = performanceData[0].value;
                      const percentChange = ((point.value / firstValue) - 1) * 100;
                      
                      // Create an object with all comparison data for this date point
                      const comparisonValues: {[key: string]: number} = {};
                      
                      Object.entries(comparisonData).forEach(([compId, data]) => {
                        if (data && data.length > idx) {
                          const compFirstValue = data[0].value;
                          const compValue = data[idx]?.value || compFirstValue;
                          const compPercentChange = ((compValue / compFirstValue) - 1) * 100;
                          comparisonValues[compId] = compPercentChange;
                        }
                      });
                      
                      return {
                        date: point.date,
                        portfolio: percentChange,
                        ...comparisonValues
                      };
                    })}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05" />
                      </linearGradient>
                      <linearGradient id="sp500Gradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#22c55e" stopOpacity="0.05" />
                      </linearGradient>
                      <linearGradient id="nasdaqGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a855f7" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#a855f7" stopOpacity="0.05" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 10 }} 
                      tickFormatter={(value) => {
                        // Format date to show only month and day
                        const date = new Date(value);
                        return `${date.getMonth() + 1}/${date.getDate()}`;
                      }}
                      axisLine={{ stroke: '#333' }}
                      tickLine={false}
                      minTickGap={30}
                    />
                    <YAxis 
                      tick={{ fontSize: 10 }}
                      tickFormatter={(value) => `${value.toFixed(1)}%`}
                      axisLine={{ stroke: '#333' }}
                      tickLine={false}
                      domain={[
                        (dataMin: number) => Math.floor(dataMin - 5), 
                        (dataMax: number) => Math.ceil(dataMax + 5)
                      ]}
                    />
                    <Tooltip 
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-black/80 border border-gray-700 p-2 rounded text-white text-xs">
                              <p className="font-bold mb-1">{new Date(label).toLocaleDateString()}</p>
                              {payload.map((item: any, index: number) => {
                                let name = "Portfolio";
                                
                                // Find name for comparison item
                                if (item.dataKey !== 'portfolio') {
                                  const compId = item.dataKey;
                                  const option = comparisonOptions.find(o => o.id === compId);
                                  const isCurrentUser = user && compId === `user-${user.id}`;
                                  name = isCurrentUser ? 'Your Portfolio' : option?.name || compId;
                                } else {
                                  name = userId === user?.id ? 'Your Portfolio' : `${userName}'s Portfolio`;
                                }
                                
                                return (
                                  <div key={index} className="flex items-center gap-2">
                                    <span 
                                      className="w-2 h-2 rounded-full" 
                                      style={{ backgroundColor: item.stroke }}
                                    ></span>
                                    <span>{name}: {item.value.toFixed(2)}%</span>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="portfolio"
                      stroke="#3b82f6"
                      strokeWidth={1.5}
                      fill="url(#portfolioGradient)"
                      activeDot={{ r: 4 }}
                      isAnimationActive={false}
                    />
                    
                    {/* Render comparison lines */}
                    {Array.from(new Set(selectedComparisons)).map(compId => {
                      const isCurrentUser = user && compId === `user-${user.id}`;
                      const color = isCurrentUser 
                        ? '#22c55e' // Green for current user
                        : compId === 'sp500' 
                        ? '#22c55e' 
                        : compId === 'nasdaq' 
                        ? '#a855f7' 
                        : '#f59e0b';
                      
                      const gradientId = compId === 'sp500' 
                        ? 'sp500Gradient' 
                        : compId === 'nasdaq' 
                        ? 'nasdaqGradient' 
                        : '';
                      
                      return (
                        <Area
                          key={compId}
                          type="monotone"
                          dataKey={compId}
                          stroke={color}
                          strokeWidth={1}
                          fill={gradientId ? `url(#${gradientId})` : "transparent"}
                          activeDot={{ r: 4 }}
                          isAnimationActive={false}
                          strokeDasharray={isCurrentUser ? "" : compId.startsWith('user-') ? "3,3" : ""}
                        />
                      );
                    })}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              
              {/* Date labels under chart */}
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>{performanceData[0]?.date}</span>
                {performanceData.length > 2 && (
                  <span>{performanceData[Math.floor(performanceData.length / 2)]?.date}</span>
                )}
                <span>{performanceData[performanceData.length - 1]?.date}</span>
              </div>
              
              {/* Performance comparison metrics */}
              {(selectedComparisons.length > 0 || (user && user.id !== userId)) && performanceData.length > 0 && (
                <div className="mt-4 border-t pt-4">
                  <h4 className="text-sm font-medium mb-2">Performance Comparison (% Gain)</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center py-1 border-b border-muted">
                      <span className="text-xs text-blue-500">
                        {userId === user?.id ? 'Your Portfolio' : `${userName}'s Portfolio`}
                      </span>
                      <span className={`text-xs font-medium flex items-center gap-1 ${calculatePerformance() >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatPercentage(calculatePerformance())}
                        {calculatePerformance() >= 0 ? 
                          <TrendingUp className="h-3 w-3" /> : 
                          <TrendingDown className="h-3 w-3" />
                        }
                      </span>
                    </div>
                    
                    {/* Filter out duplicates in the selectedComparisons array */}
                    {Array.from(new Set(selectedComparisons)).map(compId => {
                      const option = comparisonOptions.find(o => o.id === compId);
                      const compData = comparisonData[compId];
                      let performance = 0;
                      
                      if (compData && compData.length >= 2) {
                        const firstValue = compData[0].value;
                        const lastValue = compData[compData.length - 1].value;
                        performance = ((lastValue - firstValue) / firstValue) * 100;
                      }
                      
                      // If this is the current user's comparison and we're viewing someone else's profile
                      const isCurrentUser = user && compId === `user-${user.id}`;
                      
                      return option || isCurrentUser ? (
                        <div key={compId} className="flex justify-between items-center py-1 border-b border-muted">
                          <span className={`text-xs ${isCurrentUser ? 'text-green-500' : getTextColor(compId)}`}>
                            {isCurrentUser ? 'Your Portfolio' : option?.name || 'Loading...'}
                          </span>
                          <span className={`text-xs font-medium flex items-center gap-1 ${performance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {compData && compData.length >= 2 ? formatPercentage(performance) : '-'}
                            {performance >= 0 ? 
                              <TrendingUp className="h-3 w-3" /> : 
                              <TrendingDown className="h-3 w-3" />
                            }
                          </span>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stock Holdings Card */}
      <Card>
        <CardHeader>
          <CardTitle>Stock Holdings</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : error ? (
            <p className="text-center text-red-500">{error}</p>
          ) : portfolio.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              {userId === user?.id ? 'You don\'t have any stocks yet' : 'This user has no stocks'}
            </p>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Purchase Price</TableHead>
                    <TableHead>Current Price</TableHead>
                    <TableHead>Purchase Date</TableHead>
                    <TableHead className="text-right">Gain/Loss</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {portfolio.map(stock => (
                    <TableRow key={stock.id}>
                      <TableCell className="font-medium">
                        <div>
                          <div>{stock.symbol}</div>
                          <div className="text-xs text-muted-foreground">{stock.companyName}</div>
                        </div>
                      </TableCell>
                      <TableCell>{stock.quantity}</TableCell>
                      <TableCell>{formatCurrency(stock.purchasePrice)}</TableCell>
                      <TableCell>{formatCurrency(stock.currentPrice)}</TableCell>
                      <TableCell>{new Date(stock.purchaseDate).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <span className={stock.gain >= 0 ? "text-green-600" : "text-red-600"}>
                            {stock.gain >= 0 ? "↑ " : "↓ "}{formatCurrency(stock.gain)}
                          </span>
                          <span className={`text-xs ${stock.gainPercentage >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {formatPercentage(stock.gainPercentage)}{stock.gainPercentage >= 0 ? " ↗" : " ↘"}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* NEW: Stock Analysis Card */}
      {portfolio.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Portfolio Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Sector Distribution */}
              <div>
                <h3 className="text-lg font-medium mb-3">Sector Distribution</h3>
                {/* True Sankey Diagram with colored flowing paths */}
                <div className="h-[400px] w-full bg-slate-900/30 rounded-md relative overflow-hidden">
                  <svg 
                    width="100%" 
                    height="100%" 
                    viewBox="0 0 1000 400" 
                    preserveAspectRatio="xMidYMid meet"
                    className="overflow-visible"
                  >
                    <g className="sankey-diagram">
                      {/* Generate flows and nodes based on portfolio data */}
                      {(() => {
                        // Column positions
                        const colPositions = {
                          portfolio: 50,
                          sector: 300,
                          industry: 600,
                          ticker: 900
                        };
                        
                        // Calculate all the node positions first
                        // Start with the portfolio node
                        const nodes: {
                          id: string;
                          x: number;
                          y: number;
                          width: number;
                          height: number;
                          label: string;
                          value: number;
                          percentage: string;
                          color: string;
                          type: 'portfolio' | 'sector' | 'industry' | 'ticker';
                        }[] = [];
                        
                        // Portfolio node
                        nodes.push({
                          id: 'portfolio',
                          x: colPositions.portfolio,
                          y: 50,
                          width: 30,
                          height: 300,
                          label: 'Portfolio',
                          value: summary?.totalCurrentValue || 0,
                          percentage: '100%',
                          color: 'rgb(59, 130, 246)', // bright blue
                          type: 'portfolio'
                        });
                        
                        // Calculate sector nodes with more vibrant colors
                        let sectorY = 50;
                        sectorDistribution.forEach((sector) => {
                          const sectorValue = parseFloat(sector.percentage);
                          const sectorHeight = Math.max(30, (sectorValue / 100) * 300);
                          
                          nodes.push({
                            id: `sector-${sector.name}`,
                            x: colPositions.sector,
                            y: sectorY,
                            width: 30,
                            height: sectorHeight,
                            label: sector.name,
                            value: (summary?.totalCurrentValue || 0) * (sectorValue / 100),
                            percentage: `${sectorValue.toFixed(1)}%`,
                            color: getSectorColor(sector.name), // Use the updated color function
                            type: 'sector'
                          });
                          
                          sectorY += sectorHeight + 10; // Add spacing between nodes
                        });
                        
                        // Calculate industry nodes with related but distinct colors
                        let industryY = 50;
                        sectorDistribution.forEach((sector) => {
                          const sectorValue = parseFloat(sector.percentage);
                          const industries = getIndustriesForSector(sector.name, sectorValue);
                          const baseSectorColor = getSectorColor(sector.name);
                          
                          industries.forEach((industry, index) => {
                            const industryValue = (industry.percentage / 100) * sectorValue;
                            const industryHeight = Math.max(25, (industryValue / 100) * 300);
                            
                            // Create a slight color variation for each industry
                            const industryColor = baseSectorColor;
                            
                            nodes.push({
                              id: `industry-${sector.name}-${industry.name}`,
                              x: colPositions.industry,
                              y: industryY,
                              width: 30,
                              height: industryHeight,
                              label: industry.name,
                              value: (summary?.totalCurrentValue || 0) * (industryValue / 100),
                              percentage: `${industryValue.toFixed(1)}%`,
                              color: industryColor,
                              type: 'industry'
                            });
                            
                            industryY += industryHeight + 5; // Add spacing between nodes
                          });
                          
                          industryY += 5; // Add extra spacing between industry groups
                        });
                        
                        // Calculate ticker nodes with slightly different color variations
                        let tickerY = 50;
                        portfolio.forEach((stock) => {
                          const stockValue = stock.currentValue;
                          const stockPercentage = (stockValue / (summary?.totalCurrentValue || 1)) * 100;
                          const stockHeight = Math.max(20, (stockPercentage / 100) * 300);
                          const sector = getStockSector(stock.symbol);
                          const tickerColor = getSectorColor(sector);
                          
                          nodes.push({
                            id: `ticker-${stock.symbol}`,
                            x: colPositions.ticker,
                            y: tickerY,
                            width: 30,
                            height: stockHeight,
                            label: stock.symbol,
                            value: stockValue,
                            percentage: `${stockPercentage.toFixed(1)}%`,
                            color: tickerColor,
                            type: 'ticker'
                          });
                          
                          tickerY += stockHeight + 5; // Add spacing between nodes
                        });
                        
                        // Now create the links between nodes with vibrant colors
                        const links: {
                          id: string;
                          source: string;
                          target: string;
                          value: number;
                          color: string;
                          sourceSide?: 'right';
                          targetSide?: 'left';
                          path: string;
                        }[] = [];
                        
                        // Links from portfolio to sectors
                        sectorDistribution.forEach((sector) => {
                          const sectorNode = nodes.find(n => n.id === `sector-${sector.name}`);
                          const portfolioNode = nodes.find(n => n.id === 'portfolio');
                          
                          if (sectorNode && portfolioNode) {
                            const sectorValue = parseFloat(sector.percentage);
                            const portfolioHeight = portfolioNode.height;
                            const sectorHeight = sectorNode.height;
                            const sectorPortion = sectorValue / 100;
                            
                            // Calculate source coordinates (right side of portfolio node)
                            const sourceX = portfolioNode.x + portfolioNode.width;
                            const sourceY = portfolioNode.y + (portfolioHeight * 0.5 - (portfolioHeight * sectorPortion * 0.5));
                            const sourceHeight = portfolioHeight * sectorPortion;
                            
                            // Calculate target coordinates (left side of sector node)
                            const targetX = sectorNode.x;
                            const targetY = sectorNode.y;
                            const targetHeight = sectorHeight;
                            
                            // Create bezier curve path
                            const path = generateSankeyPath(
                              sourceX, sourceY, sourceHeight,
                              targetX, targetY, targetHeight
                            );
                            
                            links.push({
                              id: `link-portfolio-${sector.name}`,
                              source: 'portfolio',
                              target: `sector-${sector.name}`,
                              value: (summary?.totalCurrentValue || 0) * (sectorValue / 100),
                              color: sectorNode.color, // Use the sector color for the flow
                              path: path
                            });
                          }
                        });
                        
                        // Links from sectors to industries
                        sectorDistribution.forEach((sector) => {
                          const sectorNode = nodes.find(n => n.id === `sector-${sector.name}`);
                          
                          if (sectorNode) {
                            const industries = getIndustriesForSector(sector.name, parseFloat(sector.percentage));
                            
                            let sectorOffsetY = 0;
                            industries.forEach((industry) => {
                              const industryNode = nodes.find(n => n.id === `industry-${sector.name}-${industry.name}`);
                              
                              if (industryNode) {
                                const industryValue = (industry.percentage / 100) * parseFloat(sector.percentage);
                                const industryPortion = industry.percentage / 100;
                                
                                // Calculate source coordinates (right side of sector node)
                                const sourceX = sectorNode.x + sectorNode.width;
                                const sourceY = sectorNode.y + sectorOffsetY;
                                const sourceHeight = sectorNode.height * industryPortion;
                                
                                // Calculate target coordinates (left side of industry node)
                                const targetX = industryNode.x;
                                const targetY = industryNode.y;
                                const targetHeight = industryNode.height;
                                
                                // Create bezier curve path
                                const path = generateSankeyPath(
                                  sourceX, sourceY, sourceHeight,
                                  targetX, targetY, targetHeight
                                );
                                
                                links.push({
                                  id: `link-${sector.name}-${industry.name}`,
                                  source: `sector-${sector.name}`,
                                  target: `industry-${sector.name}-${industry.name}`,
                                  value: (summary?.totalCurrentValue || 0) * (industryValue / 100),
                                  color: industryNode.color, // Use the industry color for the flow
                                  path: path
                                });
                                
                                sectorOffsetY += sourceHeight;
                              }
                            });
                          }
                        });
                        
                        // Links from industries to tickers
                        portfolio.forEach((stock) => {
                          const tickerNode = nodes.find(n => n.id === `ticker-${stock.symbol}`);
                          const sector = getStockSector(stock.symbol);
                          
                          // Find the industry this ticker belongs to (simplified mapping)
                          const industries = getIndustriesForSector(sector, 100);
                          let targetIndustry = industries[0]?.name || sector;
                          
                          // Map specific tickers to specific industries if needed
                          if (sector === 'Technology') {
                            if (['NVDA', 'AMD', 'INTC'].includes(stock.symbol)) {
                              targetIndustry = 'Semiconductors';
                            } else if (['AAPL', 'MSFT'].includes(stock.symbol)) {
                              targetIndustry = 'Tech Hardware';
                            } else {
                              targetIndustry = 'Software';
                            }
                          } else if (sector === 'Financial') {
                            if (['JPM', 'BAC', 'WFC'].includes(stock.symbol)) {
                              targetIndustry = 'Banks';
                            } else {
                              targetIndustry = 'Insurance';
                            }
                          }
                          
                          const industryNode = nodes.find(n => n.id === `industry-${sector}-${targetIndustry}`);
                          
                          if (tickerNode && industryNode) {
                            const stockValue = stock.currentValue;
                            const stockPercentage = (stockValue / (summary?.totalCurrentValue || 1)) * 100;
                            
                            // Calculate a relative position on the industry node based on the ticker value
                            const sourceX = industryNode.x + industryNode.width;
                            const sourceY = industryNode.y + (industryNode.height * 0.2);
                            const sourceHeight = industryNode.height * 0.6; // Use a portion of the height
                            
                            // Target coordinates
                            const targetX = tickerNode.x;
                            const targetY = tickerNode.y;
                            const targetHeight = tickerNode.height;
                            
                            // Create bezier curve path
                            const path = generateSankeyPath(
                              sourceX, sourceY, sourceHeight,
                              targetX, targetY, targetHeight
                            );
                            
                            links.push({
                              id: `link-${targetIndustry}-${stock.symbol}`,
                              source: `industry-${sector}-${targetIndustry}`,
                              target: `ticker-${stock.symbol}`,
                              value: stockValue,
                              color: tickerNode.color, // Use the ticker color for the flow
                              path: path
                            });
                          }
                        });
                        
                        // Render all the links first (so they're behind the nodes)
                        return (
                          <>
                            {/* Render links (flows) - updated for more vibrant appearance */}
                            <defs>
                              {/* Define gradients for each sector color */}
                              {sectorDistribution.map((sector) => {
                                const baseColor = getSectorColor(sector.name);
                                return (
                                  <linearGradient 
                                    key={`gradient-${sector.name}`} 
                                    id={`gradient-${sector.name}`} 
                                    x1="0%" 
                                    y1="0%" 
                                    x2="100%" 
                                    y2="0%"
                                  >
                                    <stop offset="0%" stopColor={baseColor} stopOpacity="0.9" />
                                    <stop offset="100%" stopColor={baseColor} stopOpacity="0.7" />
                                  </linearGradient>
                                );
                              })}
                            </defs>
                            
                            {links.map((link) => {
                              const sourceSectorName = link.source.startsWith('sector-') 
                                ? link.source.replace('sector-', '') 
                                : link.source === 'portfolio' 
                                  ? 'Technology' // Default for portfolio
                                  : link.source.split('-')[1]; // Get sector name from industry ID
                              
                              return (
                                <path
                                  key={link.id}
                                  d={link.path}
                                  fill={`url(#gradient-${sourceSectorName})`}
                                  stroke="none"
                                  opacity={1.0}
                                />
                              );
                            })}
                            
                            {/* Render nodes with brighter colors */}
                            {nodes.map((node) => (
                              <g key={node.id} transform={`translate(${node.x},${node.y})`}>
                                {/* Node rectangle with shadow effect for depth */}
                                <defs>
                                  <filter id={`shadow-${node.id}`} x="-20%" y="-20%" width="140%" height="140%">
                                    <feDropShadow dx="1" dy="1" stdDeviation="2" floodOpacity="0.3" />
                                  </filter>
                                </defs>
                                
                                <rect
                                  width={node.width}
                                  height={node.height}
                                  fill={node.color}
                                  rx={3}
                                  ry={3}
                                  filter={`url(#shadow-${node.id})`}
                                />
                                
                                {/* Node label with better contrast */}
                                <text
                                  x={node.type === 'portfolio' ? -10 : node.width + 10}
                                  y={node.height / 2}
                                  textAnchor={node.type === 'portfolio' ? 'end' : 'start'}
                                  alignmentBaseline="middle"
                                  fill="white"
                                  fontSize={node.type === 'ticker' ? 10 : 12}
                                  fontWeight={node.type === 'portfolio' || node.type === 'sector' ? 'bold' : 'normal'}
                                  style={{ textShadow: '0px 0px 3px rgba(0,0,0,0.5)' }}
                                >
                                  {node.label} {node.percentage}
                                </text>
                              </g>
                            ))}
                          </>
                        );
                      })()}
                    </g>
                  </svg>
                  
                  {/* Header labels */}
                  <div className="absolute top-0 left-0 right-0 flex text-xs text-muted-foreground p-1">
                    <div className="w-[10%] text-left pl-10">Portfolio</div>
                    <div className="w-[30%] text-center">Sector</div>
                    <div className="w-[30%] text-center">Industry</div>
                    <div className="w-[30%] text-right pr-10">Ticker</div>
                  </div>
                </div>
                
                {/* Legend */}
                <div className="flex flex-wrap gap-2 mt-2">
                  {sectorDistribution.map((sector) => (
                    <div key={sector.name} className="flex items-center text-xs">
                      <div className={`w-3 h-3 ${getSectorColor(sector.name)} mr-1`}></div>
                      <span>{sector.name} ({sector.percentage}%)</span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Portfolio Diversification Analysis */}
              <div>
                <h3 className="text-lg font-medium mb-3">Diversification Analysis</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-muted p-4 rounded-md">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Concentration Score</span>
                      <span className="text-sm font-medium">
                        {sectorDistribution.length === 1 ? "25" : 
                         sectorDistribution.length === 2 ? "50" :
                         sectorDistribution.length === 3 ? "75" : "100"}/100
                      </span>
                    </div>
                    <div className="h-2 bg-slate-300 rounded-full mt-2">
                      <div 
                        className="h-full bg-blue-600 rounded-full" 
                        style={{ 
                          width: sectorDistribution.length === 1 ? "25%" : 
                                 sectorDistribution.length === 2 ? "50%" :
                                 sectorDistribution.length === 3 ? "75%" : "100%" 
                        }}
                      ></div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {sectorDistribution.length === 1 
                        ? "Your portfolio is concentrated in a single sector. Consider diversifying across different sectors."
                        : sectorDistribution.length <= 2
                        ? "Your portfolio has limited diversification. Consider adding stocks from other sectors."
                        : "Your portfolio has good sector diversification."}
                    </p>
                  </div>
                  <div className="bg-muted p-4 rounded-md">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Top Holding</span>
                      <span className="text-sm font-medium">
                        {portfolio.length > 0 ? `${portfolio[0].symbol} (${(portfolio[0].currentValue / (summary?.totalCurrentValue || 1) * 100).toFixed(1)}%)` : 'N/A'}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-300 rounded-full mt-2">
                      <div 
                        className="h-full bg-amber-500 rounded-full" 
                        style={{ 
                          width: portfolio.length > 0 
                            ? `${Math.min(100, (portfolio[0].currentValue / (summary?.totalCurrentValue || 1) * 100))}%` 
                            : '0%' 
                        }}
                      ></div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {portfolio.length > 0 && summary
                        ? (portfolio[0].currentValue / summary.totalCurrentValue * 100) > 25
                          ? `Your largest position (${portfolio[0].symbol}) represents a significant part of your portfolio.`
                          : `Your largest position (${portfolio[0].symbol}) represents a moderate part of your portfolio.`
                        : ''}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Risk Assessment */}
              <div>
                <h3 className="text-lg font-medium mb-3">Risk Assessment</h3>
                <div className="bg-muted p-4 rounded-md">
                  <div className="flex items-center justify-between mb-2">
                    <span>Portfolio Volatility</span>
                    <div className="flex space-x-1">
                      <div className={`w-3 h-6 ${sectorDistribution.length > 2 ? 'bg-green-500/60' : 'bg-amber-500/60'} rounded-sm`}></div>
                      <div className={`w-3 h-8 ${sectorDistribution.length > 2 ? 'bg-green-500/70' : 'bg-amber-500/70'} rounded-sm`}></div>
                      <div className={`w-3 h-10 ${sectorDistribution.length === 1 ? 'bg-red-500/70' : 'bg-amber-500/70'} rounded-sm`}></div>
                      <div className={`w-3 h-8 ${sectorDistribution.length === 1 ? 'bg-red-500/60' : 'bg-green-500/60'} rounded-sm`}></div>
                      <div className={`w-3 h-6 ${sectorDistribution.length === 1 ? 'bg-red-500/60' : 'bg-green-500/60'} rounded-sm`}></div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {sectorDistribution.length === 1 
                      ? `Your portfolio is concentrated in the ${sectorDistribution[0].name} sector, which may lead to higher volatility.`
                      : sectorDistribution.length <= 2
                      ? `Your portfolio has moderate volatility with limited sector diversification.`
                      : `Your portfolio has lower volatility due to good sector diversification.`}
                  </p>
                </div>
              </div>
              
              {/* Stock Recommendations */}
              <div>
                <h3 className="text-lg font-medium mb-3">Stock Insights</h3>
                <div className="space-y-3">
                  {portfolio.slice(0, 3).map(stock => (
                    <div key={`rec-${stock.id}`} className="bg-muted p-3 rounded-md">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{stock.symbol}</span>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          stock.gainPercentage > 5 ? 'bg-green-100 text-green-800' : 
                          stock.gainPercentage > -5 ? 'bg-yellow-100 text-yellow-800' : 
                          'bg-red-100 text-red-800'
                        }`}>
                          {stock.gainPercentage > 5 ? 'Strong' : stock.gainPercentage > -5 ? 'Stable' : 'Weak'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {stock.gainPercentage > 0 
                          ? `${stock.symbol} is up ${stock.gainPercentage.toFixed(1)}% since purchase at ${formatCurrency(stock.purchasePrice)}.` 
                          : `${stock.symbol} is down ${Math.abs(stock.gainPercentage).toFixed(1)}% from purchase at ${formatCurrency(stock.purchasePrice)}.`
                        }
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 