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
import { PlusCircle, RefreshCw, Trash2, Edit } from "lucide-react";
import { AddStockDialog } from "./add-stock-dialog";
import { EditStockDialog } from "./edit-stock-dialog";
import { toast } from "@/components/ui/use-toast";

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
  const [editingStock, setEditingStock] = useState<Stock | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingStockId, setDeletingStockId] = useState<number | null>(null);

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
      
      toast({
        title: "Stock Removed",
        description: "The stock has been removed from your portfolio",
      });
    } catch (err) {
      console.error("Failed to delete stock:", err);
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
    setEditingStock(stock);
    setIsEditStockOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Your Portfolio</CardTitle>
          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => fetchPortfolio(true)}
              disabled={refreshing}
              className="flex items-center gap-1"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh Prices'}
            </Button>
            <Button 
              size="sm" 
              onClick={() => setIsAddStockOpen(true)}
              className="flex items-center gap-1"
            >
              <PlusCircle className="h-4 w-4" />
              Add Stock
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              <div className="flex justify-between">
                <Skeleton className="h-10 w-[150px]" />
                <Skeleton className="h-10 w-[100px]" />
              </div>
              <Skeleton className="h-[300px] w-full" />
            </div>
          ) : portfolio.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                You don't have any stocks in your portfolio yet
              </p>
              <Button onClick={() => setIsAddStockOpen(true)}>
                Add Your First Stock
              </Button>
            </div>
          ) : (
            <>
              {/* Portfolio Summary */}
              {summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-muted p-3 rounded-md">
                    <div className="text-sm text-muted-foreground">Current Value</div>
                    <div className="text-lg font-semibold">
                      {formatCurrency(summary.totalCurrentValue)}
                    </div>
                  </div>
                  <div className="bg-muted p-3 rounded-md">
                    <div className="text-sm text-muted-foreground">Invested</div>
                    <div className="text-lg font-semibold">
                      {formatCurrency(summary.totalPurchaseValue)}
                    </div>
                  </div>
                  <div className="bg-muted p-3 rounded-md">
                    <div className="text-sm text-muted-foreground">Total Gain/Loss</div>
                    <div className={`text-lg font-semibold ${summary.totalGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {summary.totalGain >= 0 ? "↑ " : "↓ "}{formatCurrency(summary.totalGain)}
                    </div>
                  </div>
                  <div className="bg-muted p-3 rounded-md">
                    <div className="text-sm text-muted-foreground">Return</div>
                    <div className={`text-lg font-semibold ${summary.totalGainPercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatPercentage(summary.totalGainPercentage)}{summary.totalGainPercentage >= 0 ? " ↗" : " ↘"}
                    </div>
                  </div>
                </div>
              )}

              {/* Stocks Table */}
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
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {portfolio.map(stock => (
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
        </CardContent>
      </Card>

      <AddStockDialog 
        open={isAddStockOpen} 
        onOpenChange={setIsAddStockOpen}
        onStockAdded={fetchPortfolio}
      />

      {/* We'll need to create an EditStockDialog component next */}
      {editingStock && (
        <EditStockDialog
          open={isEditStockOpen}
          onOpenChange={setIsEditStockOpen}
          stock={editingStock}
          onStockUpdated={fetchPortfolio}
        />
      )}
    </>
  );
} 