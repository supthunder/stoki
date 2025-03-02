"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

type StockResult = {
  symbol: string;
  name: string;
  price: number;
};

export function StockAddForm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<StockResult[]>([]);
  const [selectedStock, setSelectedStock] = useState<StockResult | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [purchaseDate, setPurchaseDate] = useState<Date>(new Date());
  const [historicalPrice, setHistoricalPrice] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Search for stocks when the user types in the search box
  useEffect(() => {
    const searchStocks = async () => {
      if (!search || search.length < 2) {
        setResults([]);
        return;
      }

      setSearching(true);
      try {
        // Call the API route we'll create next
        const response = await fetch(`/api/stocks/search?q=${encodeURIComponent(search)}`);
        if (!response.ok) throw new Error("Failed to search stocks");
        
        const data = await response.json();
        setResults(data.results);
      } catch (error) {
        console.error("Error searching stocks:", error);
        toast({
          title: "Error",
          description: "Failed to search stocks. Please try again.",
          variant: "destructive",
        });
      } finally {
        setSearching(false);
      }
    };

    const debounce = setTimeout(() => {
      searchStocks();
    }, 500);

    return () => clearTimeout(debounce);
  }, [search, toast]);

  // Fetch historical price when the date changes
  useEffect(() => {
    const getHistoricalPrice = async () => {
      if (!selectedStock) return;

      try {
        const dateStr = format(purchaseDate, "yyyy-MM-dd");
        const response = await fetch(
          `/api/stocks/price?symbol=${selectedStock.symbol}&date=${dateStr}`
        );
        
        if (!response.ok) throw new Error("Failed to get historical price");
        
        const data = await response.json();
        setHistoricalPrice(data.price);
      } catch (error) {
        console.error("Error getting historical price:", error);
        toast({
          title: "Price Lookup Error",
          description: "Could not get historical price for selected date.",
          variant: "destructive",
        });
        // Fallback to current price
        setHistoricalPrice(selectedStock.price);
      }
    };

    getHistoricalPrice();
  }, [selectedStock, purchaseDate, toast]);

  const handleSelectStock = (stock: StockResult) => {
    setSelectedStock(stock);
    setHistoricalPrice(stock.price);
    setSearch("");
    setResults([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !selectedStock || !historicalPrice) return;
    
    setSubmitting(true);
    try {
      const response = await fetch("/api/portfolio/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
          symbol: selectedStock.symbol,
          companyName: selectedStock.name,
          quantity,
          purchasePrice: historicalPrice,
          purchaseDate: format(purchaseDate, "yyyy-MM-dd"),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to add stock");
      }

      toast({
        title: "Stock Added",
        description: `Added ${quantity} shares of ${selectedStock.name} to your portfolio.`,
      });

      // Reset form
      setSelectedStock(null);
      setQuantity(1);
      setPurchaseDate(new Date());
      setHistoricalPrice(null);
    } catch (error) {
      console.error("Error adding stock:", error);
      toast({
        title: "Error",
        description: "Failed to add stock to your portfolio. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-card border rounded-md p-4">
      <h3 className="text-lg font-medium mb-4">Add Stock to Portfolio</h3>
      
      {!selectedStock ? (
        // Stock search section
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="stockSearch">Search for a stock (name or symbol)</Label>
            <Input
              id="stockSearch"
              placeholder="Example: AAPL or Apple"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          {searching && <div className="text-sm text-muted-foreground">Searching...</div>}
          
          {results.length > 0 && (
            <ul className="mt-2 border rounded-md divide-y overflow-hidden">
              {results.map((stock) => (
                <li
                  key={stock.symbol}
                  className="p-2 hover:bg-accent cursor-pointer flex justify-between"
                  onClick={() => handleSelectStock(stock)}
                >
                  <div>
                    <span className="font-medium">{stock.symbol}</span> - {stock.name}
                  </div>
                  <div>${stock.price.toFixed(2)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        // Stock details and form
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="font-medium">{selectedStock.name}</h4>
              <div className="text-sm text-muted-foreground">{selectedStock.symbol}</div>
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSelectedStock(null)}
              className="h-8"
            >
              Change
            </Button>
          </div>
          
          <div className="flex flex-col space-y-2">
            <Label htmlFor="quantity">Number of Shares</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              required
            />
          </div>
          
          <div className="flex flex-col space-y-2">
            <Label>Purchase Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "justify-start text-left font-normal",
                    !purchaseDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {purchaseDate ? format(purchaseDate, "PPP") : "Select a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={purchaseDate}
                  onSelect={(date) => date && setPurchaseDate(date)}
                  initialFocus
                  disabled={(date) => date > new Date()}
                />
              </PopoverContent>
            </Popover>
          </div>
          
          <div className="flex flex-col space-y-2">
            <Label>Purchase Price</Label>
            <div className="text-lg font-medium">
              ${historicalPrice?.toFixed(2) || "Loading..."}
            </div>
            <div className="text-sm text-muted-foreground">
              {historicalPrice !== selectedStock.price && "Historical price based on selected date"}
            </div>
          </div>
          
          <div className="pt-2">
            <Button 
              type="submit" 
              className="w-full" 
              disabled={!historicalPrice || submitting}
            >
              {submitting ? "Adding..." : "Add to Portfolio"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
} 