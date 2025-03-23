"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PlusCircle, RefreshCw, Trash2, TrendingUp, TrendingDown, ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddStockDialog } from "./add-stock-dialog";
import { EditStockDialog } from "./edit-stock-dialog";
import { toast } from "@/components/ui/use-toast";
import { AddCryptoDialog } from "./add-crypto-dialog";

// Types for stock data
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

interface MobilePortfolioProps {
  onViewProfile: () => void;
}

export function MobilePortfolio({ onViewProfile }: MobilePortfolioProps) {
  const { user } = useAuth();
  const [portfolio, setPortfolio] = useState<Stock[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddStockOpen, setIsAddStockOpen] = useState(false);
  const [isEditStockOpen, setIsEditStockOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [deletingStockId, setDeletingStockId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [isCryptoDialogOpen, setIsCryptoDialogOpen] = useState(false);

  const fetchPortfolio = async (forceRefresh = false) => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);
      if (forceRefresh) setRefreshing(true);
      
      const refreshParam = forceRefresh ? '&refresh=true' : '';
      const response = await fetch(`/api/portfolio?userId=${user.id}${refreshParam}`);
      
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
      setRefreshing(false);
    }
  };

  // Handler for the retry button
  const handleRetry = () => {
    fetchPortfolio();
  };

  useEffect(() => {
    if (user) {
      fetchPortfolio();
    } else {
      setPortfolio([]);
      setSummary(null);
    }
  }, [user]);

  // This function refreshes the leaderboard cache to show updated data
  const refreshLeaderboard = async () => {
    try {
      await fetch('/api/leaderboard?refresh=true');
    } catch (error) {
      console.error('Failed to refresh leaderboard:', error);
    }
  };

  const handleStockAdded = async () => {
    await fetchPortfolio(true);
    await refreshLeaderboard();
    toast({
      title: "Stock added successfully",
      description: "Your portfolio has been updated.",
    });
  };

  const deleteStock = async (stockId: number) => {
    if (!user) return;
    
    try {
      setDeletingStockId(stockId);
      
      const response = await fetch(`/api/portfolio/stock?id=${stockId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete stock');
      }
      
      // Refresh the portfolio data
      await fetchPortfolio(true);
      await refreshLeaderboard();
      
      toast({
        title: "Stock deleted",
        description: "The stock has been removed from your portfolio.",
      });
    } catch (err) {
      console.error("Failed to delete stock:", err);
      toast({
        title: "Error",
        description: "Failed to delete stock. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeletingStockId(null);
    }
  };

  const handleEditStock = (stock: Stock) => {
    setSelectedStock(stock);
    setIsEditStockOpen(true);
  };

  const handleStockEdited = async () => {
    await fetchPortfolio(true);
    await refreshLeaderboard();
    toast({
      title: "Stock updated",
      description: "Your portfolio has been updated.",
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPercentage = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '0.00%';
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  // Move the filtered and sorted stocks outside of render
  const getFilteredAndSortedStocks = useCallback(() => {
    const filtered = portfolio.filter(stock => {
      if (activeTab === "gainers") {
        return stock.gainPercentage > 0;
      } else if (activeTab === "losers") {
        return stock.gainPercentage < 0;
      }
      return true; // "all" tab
    });

    return [...filtered].sort((a, b) => {
      if (activeTab === "losers") {
        return a.gainPercentage - b.gainPercentage;
      }
      return b.gainPercentage - a.gainPercentage;
    });
  }, [portfolio, activeTab]);

  const filteredStocks = useMemo(() => getFilteredAndSortedStocks(), [getFilteredAndSortedStocks]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-4 space-y-4">
        <div className="text-destructive">{error}</div>
        <Button onClick={handleRetry}>Retry</Button>
      </div>
    );
  }

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Portfolio</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            Please log in to view your portfolio
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Portfolio Summary Card */}
      {loading ? (
        <Card>
          <CardContent className="p-4 space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-8 w-1/2" />
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="p-4 bg-card">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-lg font-bold">Portfolio Summary</h2>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => fetchPortfolio(true)}
                    disabled={refreshing}
                  >
                    <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                  </Button>
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => setIsAddStockOpen(true)}
                      size="sm"
                      variant="outline"
                    >
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Stock
                    </Button>
                    <Button 
                      onClick={() => setIsCryptoDialogOpen(true)}
                      size="sm"
                    >
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Crypto
                    </Button>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm text-muted-foreground">Current Value</span>
                    <span className="text-2xl font-bold">{summary ? formatCurrency(summary.totalCurrentValue) : '$0.00'}</span>
                  </div>
                  
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-sm text-muted-foreground">Initial Investment</span>
                    <span>{summary ? formatCurrency(summary.totalPurchaseValue) : '$0.00'}</span>
                  </div>
                  
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-sm text-muted-foreground">Total Gain/Loss</span>
                    <div className="flex items-center">
                      {summary && summary.totalGain !== 0 && (
                        summary.totalGain > 0 ? 
                          <TrendingUp className="h-4 w-4 text-green-500 mr-1" /> : 
                          <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
                      )}
                      <span className={summary && summary.totalGain > 0 ? 'text-green-500' : summary && summary.totalGain < 0 ? 'text-red-500' : ''}>
                        {summary ? formatCurrency(summary.totalGain) : '$0.00'} 
                        ({summary ? formatPercentage(summary.totalGainPercentage) : '0.00'}%)
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mr-2"
                    onClick={onViewProfile}
                  >
                    View Performance
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stocks List */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold">Your Stocks</h2>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
            <TabsList className="grid grid-cols-3 h-8">
              <TabsTrigger value="all" className="text-xs px-2">All</TabsTrigger>
              <TabsTrigger value="gainers" className="text-xs px-2">Gainers</TabsTrigger>
              <TabsTrigger value="losers" className="text-xs px-2">Losers</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex justify-between">
                    <Skeleton className="h-6 w-1/3" />
                    <Skeleton className="h-6 w-1/4" />
                  </div>
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-4 w-1/5" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : portfolio.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground mb-4">You don't have any stocks in your portfolio yet.</p>
              <Button onClick={() => setIsAddStockOpen(true)}>
                <PlusCircle className="h-4 w-4 mr-2" />
                Add Your First Stock
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredStocks.map((stock) => (
              <Card 
                key={stock.id} 
                className="overflow-hidden cursor-pointer hover:bg-accent/10"
                onClick={() => handleEditStock(stock)}
              >
                <CardContent className="p-0">
                  <div className="p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center">
                          <h3 className="font-bold">{stock.symbol}</h3>
                          <Badge variant="outline" className="ml-2 text-xs">
                            {stock.quantity} {stock.quantity === 1 ? 'share' : 'shares'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground truncate max-w-[200px]">{stock.companyName}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatCurrency(stock.currentValue)}</p>
                        <div className={`text-sm ${stock.gain > 0 ? 'text-green-500' : stock.gain < 0 ? 'text-red-500' : ''}`}>
                          {stock.gain > 0 ? '+' : ''}{formatCurrency(stock.gain)} ({stock.gainPercentage > 0 ? '+' : ''}{formatPercentage(stock.gainPercentage)}%)
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-2 flex justify-between items-center">
                      <div className="text-xs text-muted-foreground">
                        Bought: {new Date(stock.purchaseDate).toLocaleDateString()} at {formatCurrency(stock.purchasePrice)}
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6" 
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteStock(stock.id);
                        }}
                        disabled={deletingStockId === stock.id}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    
                    {/* Progress bar showing current price vs purchase price */}
                    <div className="mt-2">
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${stock.gainPercentage > 0 ? 'bg-green-500' : 'bg-red-500'}`}
                          style={{ 
                            width: `${Math.min(Math.abs(stock.gainPercentage) * 2, 100)}%`,
                            marginLeft: stock.gainPercentage < 0 ? `${100 - Math.min(Math.abs(stock.gainPercentage) * 2, 100)}%` : '0'
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-xs mt-1">
                        <span>{formatCurrency(stock.purchasePrice)}</span>
                        <span>{formatCurrency(stock.currentPrice)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add Stock Dialog */}
      <AddStockDialog
        open={isAddStockOpen}
        onOpenChange={setIsAddStockOpen}
        onStockAdded={handleStockAdded}
      />

      <AddCryptoDialog
        open={isCryptoDialogOpen}
        onOpenChange={setIsCryptoDialogOpen}
        onCryptoAdded={handleStockAdded}
      />

      {/* Edit Stock Dialog */}
      {selectedStock && (
        <EditStockDialog
          open={isEditStockOpen}
          onOpenChange={setIsEditStockOpen}
          stock={selectedStock}
          onStockUpdated={handleStockEdited}
        />
      )}
    </div>
  );
} 