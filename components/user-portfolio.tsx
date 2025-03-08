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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { Skeleton } from "@/components/ui/skeleton";
import { PlusCircle, RefreshCw, Trash2, Edit, BarChart2 } from "lucide-react";
import { AddStockDialog } from "./add-stock-dialog";
import { EditStockDialog } from "./edit-stock-dialog";
import { toast } from "@/components/ui/use-toast";
import { UserProfile } from "./user-profile";
import { useIsMobile } from "@/lib/hooks";

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

export function UserPortfolio() {
  const { user } = useAuth();
  const [portfolio, setPortfolio] = useState<Stock[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddStockOpen, setIsAddStockOpen] = useState(false);
  const [isEditStockOpen, setIsEditStockOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [deletingStockId, setDeletingStockId] = useState<number | null>(null);
  const [viewingProfile, setViewingProfile] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { isMobile } = useIsMobile();

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
    }
  }, [user]);

  // This function refreshes the leaderboard cache to show updated data
  const refreshLeaderboard = async () => {
    try {
      await fetch('/api/leaderboard?refresh=true');
      console.log('Leaderboard cache refreshed');
    } catch (error) {
      console.error('Failed to refresh leaderboard:', error);
    }
  };

  // Handle successful stock addition
  const handleStockAdded = async () => {
    await fetchPortfolio(true);
    // Also refresh the leaderboard to show the updated data
    await refreshLeaderboard();
  };

  // Handle stock deletion
  const deleteStock = async (stockId: number) => {
    if (!user) return;
    
    try {
      setDeletingStockId(stockId);
      const response = await fetch(`/api/portfolio/delete?stockId=${stockId}&userId=${user.id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete stock');
      }
      
      // Remove the stock from the local state
      setPortfolio(prev => prev.filter(stock => stock.id !== stockId));
      
      // Update the summary
      if (summary) {
        const deletedStock = portfolio.find(stock => stock.id === stockId);
        if (deletedStock) {
          const newTotalCurrentValue = summary.totalCurrentValue - deletedStock.currentValue;
          const newTotalPurchaseValue = summary.totalPurchaseValue - (deletedStock.quantity * deletedStock.historicalPrice);
          const newTotalGain = newTotalCurrentValue - newTotalPurchaseValue;
          const newTotalGainPercentage = newTotalPurchaseValue > 0 ? (newTotalGain / newTotalPurchaseValue) * 100 : 0;
          
          setSummary({
            totalCurrentValue: newTotalCurrentValue,
            totalPurchaseValue: newTotalPurchaseValue,
            totalGain: newTotalGain,
            totalGainPercentage: newTotalGainPercentage
          });
        }
      }
      
      // Also refresh the leaderboard to show the updated data
      await refreshLeaderboard();
      
      toast({
        title: "Stock deleted",
        description: "The stock has been removed from your portfolio",
      });
    } catch (error) {
      console.error("Failed to delete stock:", error);
      toast({
        title: "Error",
        description: "Failed to delete the stock. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeletingStockId(null);
    }
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

  // Handle returning from profile view
  const handleBackFromProfile = () => {
    setViewingProfile(false);
  };

  // If profile view is shown, render the UserProfile component
  if (viewingProfile && user) {
    return (
      <UserProfile 
        userId={user.id} 
        userName={user.username} 
        onBack={handleBackFromProfile} 
      />
    );
  }

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Portfolio</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            Please log in to view your portfolio
          </p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Portfolio</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-red-500 py-4">
            <p>{error}</p>
            <Button 
              onClick={handleRetry} 
              variant="outline" 
              className="mt-2"
            >
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Replace the StockRow component with this new version without swipe
  const StockRow = ({ 
    stock, 
    onDelete, 
    onEdit,
    deletingStockId,
    formatCurrency,
    formatPercentage
  }: { 
    stock: Stock;
    onDelete: (id: number) => void;
    onEdit: (stock: Stock) => void;
    deletingStockId: number | null;
    formatCurrency: (value: number) => string;
    formatPercentage: (value: number) => string;
  }) => {
    const isDeleting = deletingStockId === stock.id;
    
    return (
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
        <TableCell>
          <div className="flex gap-2 justify-end">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => onEdit(stock)}
              className="h-8 w-8"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => onDelete(stock.id)}
              disabled={isDeleting}
              className="h-8 w-8 text-red-500"
            >
              {isDeleting ? (
                <span className="animate-spin">⌛</span>
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  // Add a function to handle editing a stock
  const handleEditStock = (stock: Stock) => {
    setSelectedStock(stock);
    setIsEditStockOpen(true);
  };

  return (
    <div>
      {viewingProfile ? (
        <div>
          <Button 
            variant="ghost" 
            onClick={handleBackFromProfile} 
            className="mb-4"
          >
            ← Back to Portfolio
          </Button>
          <UserProfile 
            userId={user?.id || 0} 
            userName={user?.username || ""} 
            onBack={handleBackFromProfile} 
          />
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center mb-4">
            <h2 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold`}>
              {isMobile ? "Portfolio" : "Your Stock Portfolio"}
            </h2>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size={isMobile ? "sm" : "default"}
                onClick={refreshLeaderboard} 
                disabled={loading}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                {loading ? "Refreshing..." : "Refresh"}
              </Button>
              <Button 
                onClick={() => setIsAddStockOpen(true)}
                size={isMobile ? "sm" : "default"}
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                {isMobile ? "Add" : "Add Stock"}
              </Button>
            </div>
          </div>

          {error ? (
            <div className="bg-destructive/20 p-4 rounded-md mb-4">
              <p className="text-destructive font-medium">{error}</p>
              <Button 
                variant="outline" 
                className="mt-2" 
                onClick={handleRetry}
              >
                Try Again
              </Button>
            </div>
          ) : loading ? (
            <div className="space-y-4">
              <div className="flex justify-between">
                <Skeleton className="h-10 w-[150px]" />
                <Skeleton className="h-10 w-[100px]" />
              </div>
              <Skeleton className="h-[300px] w-full" />
            </div>
          ) : portfolio.length === 0 ? (
            <div className="rounded-md border bg-card text-card-foreground p-8 text-center">
              <h3 className="text-lg font-medium mb-2">No stocks in your portfolio</h3>
              <p className="text-muted-foreground mb-4">
                Add your first stock to start tracking your investments.
              </p>
              <Button onClick={() => setIsAddStockOpen(true)}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Your First Stock
              </Button>
            </div>
          ) : (
            <>
              {/* Portfolio Summary */}
              <div className={`grid ${isMobile ? 'grid-cols-2' : 'grid-cols-4'} gap-4 mb-6`}>
                <Card>
                  <CardHeader className="py-2">
                    <CardTitle className="text-sm text-muted-foreground">Current Value</CardTitle>
                  </CardHeader>
                  <CardContent className="py-2">
                    <div className="text-2xl font-bold">
                      {summary ? formatCurrency(summary.totalCurrentValue) : "$0.00"}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="py-2">
                    <CardTitle className="text-sm text-muted-foreground">Initial Investment</CardTitle>
                  </CardHeader>
                  <CardContent className="py-2">
                    <div className="text-2xl font-bold">
                      {summary ? formatCurrency(summary.totalPurchaseValue) : "$0.00"}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="py-2">
                    <CardTitle className="text-sm text-muted-foreground">Total Gain/Loss</CardTitle>
                  </CardHeader>
                  <CardContent className="py-2">
                    <div className={`text-2xl font-bold ${summary && summary.totalGain >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {summary ? formatCurrency(summary.totalGain) : "$0.00"}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="py-2">
                    <CardTitle className="text-sm text-muted-foreground">Return %</CardTitle>
                  </CardHeader>
                  <CardContent className="py-2">
                    <div className={`text-2xl font-bold ${summary && summary.totalGainPercentage >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {summary ? formatPercentage(summary.totalGainPercentage) : "0.00%"}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Portfolio Table */}
              <div className="rounded-md border bg-card text-card-foreground overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Symbol</TableHead>
                      <TableHead className="hidden md:table-cell">Company</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead className="hidden md:table-cell">Purchase Price</TableHead>
                      <TableHead className="hidden md:table-cell">Purchase Date</TableHead>
                      <TableHead>Current Price</TableHead>
                      <TableHead>Gain/Loss</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {portfolio.map((stock) => (
                      <StockRow
                        key={stock.id}
                        stock={stock}
                        onDelete={deleteStock}
                        onEdit={handleEditStock}
                        deletingStockId={deletingStockId}
                        formatCurrency={formatCurrency}
                        formatPercentage={formatPercentage}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          <AddStockDialog
            open={isAddStockOpen}
            onOpenChange={setIsAddStockOpen}
            onStockAdded={handleStockAdded}
          />

          {selectedStock && (
            <EditStockDialog
              open={isEditStockOpen}
              onOpenChange={setIsEditStockOpen}
              stock={selectedStock}
              onStockUpdated={handleStockAdded}
            />
          )}
        </>
      )}
    </div>
  );
} 