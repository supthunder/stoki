"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

type Transaction = {
  id: number;
  userId: number;
  userName: string;
  symbol: string;
  quantity: number;
  price: number;
  type: "buy" | "sell";
  date: string;
};

export function ActivityFeed() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [visibleTransactions, setVisibleTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/transactions");
        
        if (!response.ok) {
          throw new Error("Failed to fetch transactions");
        }
        
        const data = await response.json();
        setTransactions(data);
      } catch (err) {
        console.error("Error fetching transactions:", err);
        setError("Failed to load recent activity");
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, []);

  // Update visible transactions when transactions or page changes
  useEffect(() => {
    if (transactions.length > 0) {
      setVisibleTransactions(transactions.slice(0, page * ITEMS_PER_PAGE));
      setHasMore(page * ITEMS_PER_PAGE < transactions.length);
    }
  }, [transactions, page]);

  // Set up intersection observer for infinite scrolling
  const lastTransactionRef = useCallback((node: HTMLDivElement | null) => {
    if (loading || loadingMore) return;
    
    if (observerRef.current) observerRef.current.disconnect();
    
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        loadMoreTransactions();
      }
    });
    
    if (node) observerRef.current.observe(node);
  }, [loading, loadingMore, hasMore]);

  // Load more transactions
  const loadMoreTransactions = () => {
    if (!hasMore || loadingMore) return;
    
    setLoadingMore(true);
    // Simulate loading delay
    setTimeout(() => {
      setPage(prevPage => prevPage + 1);
      setLoadingMore(false);
    }, 300);
  };

  // Format date to "Jun 30" style
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Format price to 2 decimal places
  const formatPrice = (price: number | string) => {
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    return numPrice.toFixed(2);
  };

  // Calculate total transaction amount
  const calculateTotal = (quantity: number, price: number | string) => {
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    return (quantity * numPrice).toFixed(2);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array(5).fill(0).map((_, index) => (
          <Card key={`skeleton-${index}`}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div>
                    <Skeleton className="h-5 w-28" />
                    <Skeleton className="h-4 w-20 mt-1" />
                  </div>
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
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <p className="text-destructive">{error}</p>
        <Button 
          variant="outline" 
          className="mt-4"
          onClick={() => window.location.reload()}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (visibleTransactions.length === 0) {
    return (
      <div className="p-4 text-center">
        <h2 className="text-xl font-bold mb-4">Recent Transactions</h2>
        <p className="text-muted-foreground">No transactions found</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-bold mb-4">Recent Transactions</h2>
      
      {visibleTransactions.map((transaction, index) => {
        const isLastItem = index === visibleTransactions.length - 1;
        
        return (
          <Card 
            key={transaction.id}
            className="overflow-hidden"
            ref={isLastItem ? lastTransactionRef : null}
          >
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Transaction Icon */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center 
                    ${transaction.type === "buy" 
                      ? "bg-green-500/20 text-green-500" 
                      : "bg-red-500/20 text-red-500"}`}
                  >
                    {transaction.type === "buy" 
                      ? <ArrowUpRight size={18} /> 
                      : <ArrowDownRight size={18} />}
                  </div>
                  
                  {/* Transaction Details */}
                  <div>
                    <h3 className="font-semibold text-base">
                      {transaction.type === "buy" ? "Bought" : "Sold"} {transaction.symbol}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {transaction.userName} • {transaction.quantity} {transaction.quantity > 1 ? "shares" : "share"} at ${formatPrice(transaction.price)}
                    </p>
                  </div>
                </div>
                
                {/* Transaction Amount and Date */}
                <div className="text-right">
                  <div className="font-bold text-base">
                    ${calculateTotal(transaction.quantity, transaction.price)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(transaction.date)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
      
      {/* Loading indicator for infinite scroll */}
      {loadingMore && (
        <div className="py-2 text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-current border-r-transparent motion-reduce:animate-[spin_1.5s_linear_infinite]" />
        </div>
      )}
      
      {/* Load more button as fallback */}
      {hasMore && !loadingMore && (
        <div ref={loadMoreRef} className="py-2 text-center">
          <Button 
            variant="outline" 
            onClick={loadMoreTransactions}
            className="w-full"
          >
            Load More
          </Button>
        </div>
      )}
      
      {/* End of list message */}
      {!hasMore && visibleTransactions.length > 0 && (
        <div className="py-2 text-center text-sm text-muted-foreground">
          No more transactions to load
        </div>
      )}
    </div>
  );
} 