"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        
        // In development, use mock data even if API fails
        if (process.env.NODE_ENV !== 'production') {
          console.log("Using mock transaction data for development");
          setTransactions(mockTransactions);
          setError(null);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, []);

  // Format date to "Jun 30" style
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
      </div>
    );
  }

  // Mock data for development until API is implemented
  const mockTransactions: Transaction[] = [
    {
      id: 1,
      userId: 5,
      userName: "Nancy Pelosi",
      symbol: "AAPL",
      quantity: 2,
      price: 178.25,
      type: "buy",
      date: "2024-06-30T12:00:00Z"
    },
    {
      id: 2,
      userId: 8,
      userName: "Josh Gottheimer",
      symbol: "TSLA",
      quantity: 1,
      price: 220.15,
      type: "sell",
      date: "2024-06-27T14:30:00Z"
    },
    {
      id: 3,
      userId: 4,
      userName: "Daniel Meuser",
      symbol: "NVDA",
      quantity: 1,
      price: 118.75,
      type: "buy",
      date: "2024-06-24T09:15:00Z"
    },
    {
      id: 4,
      userId: 7,
      userName: "Thomas R. Carper",
      symbol: "MSFT",
      quantity: 2,
      price: 405.30,
      type: "buy",
      date: "2024-06-19T11:45:00Z"
    }
  ];

  // Use mock data for now
  const displayTransactions = transactions.length > 0 ? transactions : mockTransactions;

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-bold mb-4">Recent Transactions</h2>
      
      {displayTransactions.map((transaction) => (
        <Card 
          key={transaction.id}
          className="overflow-hidden"
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
                    {transaction.userName} • {transaction.quantity} {transaction.quantity > 1 ? "shares" : "share"} at ${transaction.price.toFixed(2)}
                  </p>
                </div>
              </div>
              
              {/* Transaction Amount and Date */}
              <div className="text-right">
                <div className="font-bold text-base">
                  ${(transaction.quantity * transaction.price).toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDate(transaction.date)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
} 