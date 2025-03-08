"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/ui/use-toast";
import { Search, X, TrendingUp, TrendingDown, DollarSign, Users, Plus, Minus, Flame, Calendar } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";

// Stock type definition
type Stock = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  marketCap?: number;
  communityOwnership?: number;
  sentiment?: "bullish" | "bearish" | "neutral";
};

// Popular stocks (will be fetched from API)
const popularSymbols = ["AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "GOOGL", "META", "AMD"];
// Trending stocks (will be fetched from API)
const trendingSymbols = ["NVDA", "META", "MSFT"];
// Sectors for browsing
const sectors = [
  "Technology",
  "Consumer Cyclical",
  "Communication",
  "Healthcare",
  "Financial",
  "Energy",
  "Utilities",
  "Real Estate",
];

type AddStockDialogProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onStockAdded?: () => void;
};

export function AddStockDialog({
  open,
  onOpenChange,
  onStockAdded,
}: AddStockDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [shares, setShares] = useState(1);
  const [investmentAmount, setInvestmentAmount] = useState(0);
  const [activeTab, setActiveTab] = useState("popular");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [popularStocks, setPopularStocks] = useState<Stock[]>([]);
  const [trendingStocks, setTrendingStocks] = useState<Stock[]>([]);
  const [filteredStocks, setFilteredStocks] = useState<Stock[]>([]);
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split("T")[0]);
  const [portfolioValue, setPortfolioValue] = useState(0);
  const [searchResults, setSearchResults] = useState<Stock[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

  // Fetch portfolio value
  useEffect(() => {
    if (user) {
      fetchPortfolioValue();
    }
  }, [user]);

  // Fetch stock data on component mount
  useEffect(() => {
    fetchPopularStocks();
    fetchTrendingStocks();
  }, []);

  // Filter stocks when search query changes
  useEffect(() => {
    if (searchQuery) {
      const filtered = popularStocks.filter(
        (stock) =>
          stock.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
          stock.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredStocks(filtered);
    } else {
      setFilteredStocks([]);
    }
  }, [searchQuery, popularStocks]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Perform search when debounced query changes
  useEffect(() => {
    if (debouncedSearchQuery) {
      searchStocks(debouncedSearchQuery);
    } else {
      setSearchResults([]);
    }
  }, [debouncedSearchQuery]);

  // Fetch portfolio value
  const fetchPortfolioValue = async () => {
    if (!user) return;
    
    try {
      const response = await fetch(`/api/portfolio?userId=${user.id}`);
      if (response.ok) {
        const data = await response.json();
        setPortfolioValue(data.summary?.totalCurrentValue || 0);
      }
    } catch (error) {
      console.error("Error fetching portfolio value:", error);
    }
  };

  // Fetch popular stocks
  const fetchPopularStocks = async () => {
    setIsLoading(true);
    try {
      const stocks: Stock[] = [];
      
      for (const symbol of popularSymbols) {
        try {
          const response = await fetch(`/api/stocks/price?symbol=${symbol}`);
          if (response.ok) {
            const data = await response.json();
            stocks.push({
              symbol: data.symbol,
              name: data.shortName || data.longName || symbol,
              price: data.price || 0,
              change: data.change || 0,
              changePercent: data.changePercent || 0,
              marketCap: data.marketCap,
              communityOwnership: Math.floor(Math.random() * 40) + 50, // Mock data
              sentiment: data.changePercent > 1 ? "bullish" : data.changePercent < -1 ? "bearish" : "neutral",
            });
          }
        } catch (error) {
          console.error(`Error fetching data for ${symbol}:`, error);
        }
      }
      
      setPopularStocks(stocks);
    } catch (error) {
      console.error("Error fetching popular stocks:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch trending stocks
  const fetchTrendingStocks = async () => {
    try {
      const stocks: Stock[] = [];
      
      for (const symbol of trendingSymbols) {
        try {
          const response = await fetch(`/api/stocks/price?symbol=${symbol}`);
          if (response.ok) {
            const data = await response.json();
            stocks.push({
              symbol: data.symbol,
              name: data.shortName || data.longName || symbol,
              price: data.price || 0,
              change: data.change || 0,
              changePercent: data.changePercent || 0,
              marketCap: data.marketCap,
              communityOwnership: Math.floor(Math.random() * 40) + 50, // Mock data
              sentiment: data.changePercent > 1 ? "bullish" : data.changePercent < -1 ? "bearish" : "neutral",
            });
          }
        } catch (error) {
          console.error(`Error fetching data for ${symbol}:`, error);
        }
      }
      
      setTrendingStocks(stocks);
    } catch (error) {
      console.error("Error fetching trending stocks:", error);
    }
  };

  // Search stocks
  const searchStocks = async (query: string) => {
    if (query.length < 2) return;
    
    setIsSearching(true);
    try {
      const response = await fetch(`/api/stocks/search?query=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        
        // Fetch prices for search results
        const stocksWithPrices = await Promise.all(
          data.map(async (stock: any) => {
            try {
              const priceResponse = await fetch(`/api/stocks/price?symbol=${stock.symbol}`);
              if (priceResponse.ok) {
                const priceData = await priceResponse.json();
                return {
                  symbol: stock.symbol,
                  name: stock.name,
                  price: priceData.price || 0,
                  change: priceData.change || 0,
                  changePercent: priceData.changePercent || 0,
                  marketCap: priceData.marketCap,
                  communityOwnership: Math.floor(Math.random() * 40) + 50, // Mock data
                  sentiment: priceData.changePercent > 1 ? "bullish" : priceData.changePercent < -1 ? "bearish" : "neutral",
                };
              }
            } catch (error) {
              console.error(`Error fetching price for ${stock.symbol}:`, error);
            }
            return null;
          })
        );
        
        setSearchResults(stocksWithPrices.filter(Boolean) as Stock[]);
      }
    } catch (error) {
      console.error("Error searching stocks:", error);
    } finally {
      setIsSearching(false);
    }
  };

  // Update price based on purchase date
  const updatePriceForDate = async (date: string) => {
    if (!selectedStock) return;
    
    try {
      const response = await fetch(`/api/stocks/price?symbol=${selectedStock.symbol}&date=${date}`);
      if (response.ok) {
        const data = await response.json();
        const newPrice = data.price || selectedStock.price;
        setSelectedStock({
          ...selectedStock,
          price: newPrice,
        });
        setInvestmentAmount(newPrice * shares);

        // Show toast if using current price as fallback
        if (data.note) {
          toast({
            title: "Historical Price Not Available",
            description: "Using current market price for this date.",
            variant: "default",
          });
        }
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to fetch historical price.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching historical price:", error);
      toast({
        title: "Error",
        description: "Failed to fetch historical price. Using current price.",
        variant: "destructive",
      });
    }
  };

  // Handle purchase date change
  const handlePurchaseDateChange = (date: string) => {
    setPurchaseDate(date);
    updatePriceForDate(date);
  };

  // Handle stock selection
  const handleSelectStock = (stock: Stock) => {
    setSelectedStock(stock);
    // Calculate initial investment amount based on stock price
    setInvestmentAmount(stock.price * shares);
  };

  // Handle shares change
  const handleSharesChange = (newShares: number) => {
    if (newShares >= 1) {
      setShares(newShares);
      if (selectedStock) {
        setInvestmentAmount(selectedStock.price * newShares);
      }
    }
  };

  // Handle investment amount change
  const handleAmountChange = (amount: string) => {
    const numAmount = Number.parseFloat(amount);
    if (!isNaN(numAmount) && numAmount >= 0) {
      setInvestmentAmount(numAmount);
      if (selectedStock) {
        setShares(Math.max(1, Math.floor(numAmount / selectedStock.price)));
      }
    }
  };

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  // Format market cap
  const formatMarketCap = (value: number | undefined) => {
    if (!value) return "N/A";
    
    if (value >= 1e12) {
      return `$${(value / 1e12).toFixed(2)}T`;
    } else if (value >= 1e9) {
      return `$${(value / 1e9).toFixed(2)}B`;
    } else if (value >= 1e6) {
      return `$${(value / 1e6).toFixed(2)}M`;
    } else {
      return `$${value.toFixed(2)}`;
    }
  };

  // Format percentage
  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  // Add stock to portfolio
  const addStockToPortfolio = async () => {
    if (!user || !selectedStock) return;
    
    try {
      setIsSubmitting(true);
      
      // Add the stock to the portfolio
      const response = await fetch("/api/portfolio/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
          symbol: selectedStock.symbol,
          companyName: selectedStock.name,
          quantity: shares,
          purchasePrice: selectedStock.price,
          purchaseDate: purchaseDate,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to add stock to portfolio");
      }

      toast({
        title: "Success",
        description: `${shares} shares of ${selectedStock.symbol} added to your portfolio.`,
      });

      // Reset form
      setSelectedStock(null);
      setShares(1);
      setInvestmentAmount(0);
      setPurchaseDate(new Date().toISOString().split("T")[0]);
      
      // Refresh portfolio data
      if (onStockAdded) {
        onStockAdded();
      }
      
      // Close dialog
      if (onOpenChange) {
        onOpenChange(false);
      }
    } catch (error) {
      console.error("Error adding stock:", error);
      toast({
        title: "Error",
        description: "Failed to add stock to your portfolio. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="bg-green-500 hover:bg-green-600">Add to Portfolio</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Add Stock to Portfolio</DialogTitle>
          <DialogDescription>Search for stocks to add to your portfolio or explore trending picks.</DialogDescription>
        </DialogHeader>

        {!selectedStock ? (
          <>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by ticker or company name"
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <Tabs defaultValue="popular" onValueChange={setActiveTab}>
              <TabsList className="grid grid-cols-3 mb-4">
                <TabsTrigger value="popular">Popular</TabsTrigger>
                <TabsTrigger value="trending">Trending</TabsTrigger>
                <TabsTrigger value="search">Search Results</TabsTrigger>
              </TabsList>

              <TabsContent value="popular" className="space-y-3 mt-0">
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : popularStocks.length > 0 ? (
                  popularStocks.map((stock) => (
                    <StockCard key={stock.symbol} stock={stock} onSelect={() => handleSelectStock(stock)} />
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No popular stocks available
                  </div>
                )}
              </TabsContent>

              <TabsContent value="trending" className="space-y-3 mt-0">
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : trendingStocks.length > 0 ? (
                  trendingStocks.map((stock) => (
                    <StockCard key={stock.symbol} stock={stock} onSelect={() => handleSelectStock(stock)} trending />
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No trending stocks available
                  </div>
                )}
              </TabsContent>

              <TabsContent value="search" className="space-y-3 mt-0">
                {searchQuery ? (
                  isSearching ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : searchResults.length > 0 ? (
                    searchResults.map((stock) => (
                      <StockCard key={stock.symbol} stock={stock} onSelect={() => handleSelectStock(stock)} />
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No stocks found matching "{searchQuery}"
                    </div>
                  )
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Enter a search term to find stocks
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <div className="mt-4">
              <h3 className="text-sm font-medium mb-2">Browse by Sector</h3>
              <div className="flex flex-wrap gap-2">
                {sectors.map((sector) => (
                  <Badge
                    key={sector}
                    variant="outline"
                    className="cursor-pointer hover:bg-muted"
                    onClick={() => setSearchQuery(sector)}
                  >
                    {sector}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedStock(null)}
                className="flex items-center gap-1"
              >
                <X className="h-4 w-4" />
                Back to search
              </Button>
              <Badge
                className={
                  selectedStock.sentiment === "bullish"
                    ? "bg-green-500/20 text-green-500 hover:bg-green-500/30 hover:text-green-500"
                    : selectedStock.sentiment === "bearish"
                      ? "bg-red-500/20 text-red-500 hover:bg-red-500/30 hover:text-red-500"
                      : "bg-muted text-muted-foreground"
                }
              >
                {selectedStock.sentiment === "bullish" ? (
                  <TrendingUp className="h-3 w-3 mr-1" />
                ) : selectedStock.sentiment === "bearish" ? (
                  <TrendingDown className="h-3 w-3 mr-1" />
                ) : null}
                {selectedStock.sentiment ? selectedStock.sentiment.charAt(0).toUpperCase() + selectedStock.sentiment.slice(1) : "Neutral"}
              </Badge>
            </div>

            <div className="flex items-center gap-4 mb-6">
              <div className="bg-muted h-16 w-16 rounded-md flex items-center justify-center font-bold text-lg">
                {selectedStock.symbol.substring(0, 4)}
              </div>
              <div>
                <h2 className="text-xl font-bold">{selectedStock.name}</h2>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{selectedStock.symbol}</span>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-muted-foreground">{formatMarketCap(selectedStock.marketCap)}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-muted-foreground text-sm">Current Price</p>
                <div className="flex items-end justify-between">
                  <p className="text-xl font-bold">{formatCurrency(selectedStock.price)}</p>
                  <div
                    className={
                      selectedStock.changePercent >= 0
                        ? "flex items-center text-green-500 text-sm"
                        : "flex items-center text-red-500 text-sm"
                    }
                  >
                    {selectedStock.changePercent >= 0 ? (
                      <TrendingUp className="h-4 w-4 mr-1" />
                    ) : (
                      <TrendingDown className="h-4 w-4 mr-1" />
                    )}
                    {formatPercentage(selectedStock.changePercent)}
                  </div>
                </div>
              </div>
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-muted-foreground text-sm">Community Ownership</p>
                <div className="flex flex-col gap-1">
                  <p className="text-xl font-bold">{selectedStock.communityOwnership || 0}%</p>
                  <Progress value={selectedStock.communityOwnership || 0} className="h-1" />
                </div>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <div className="flex justify-between mb-2">
                  <label htmlFor="shares" className="text-sm font-medium">
                    Number of Shares
                  </label>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleSharesChange(shares - 1)}
                      disabled={shares <= 1}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center">{shares}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleSharesChange(shares + 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <Slider
                  id="shares"
                  min={1}
                  max={100}
                  step={1}
                  value={[shares]}
                  onValueChange={(value: number[]) => handleSharesChange(value[0])}
                />
              </div>

              <div>
                <label htmlFor="investment" className="text-sm font-medium block mb-2">
                  Investment Amount
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    id="investment"
                    type="text"
                    className="pl-9"
                    value={investmentAmount.toFixed(2)}
                    onChange={(e) => handleAmountChange(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="purchaseDate" className="text-sm font-medium block mb-2">
                  Purchase Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    id="purchaseDate"
                    type="date"
                    className="pl-9"
                    value={purchaseDate}
                    onChange={(e) => handlePurchaseDateChange(e.target.value)}
                    max={new Date().toISOString().split("T")[0]}
                  />
                </div>
              </div>
            </div>

            <div className="bg-muted p-4 rounded-lg mb-6">
              <h3 className="font-medium mb-2">Portfolio Impact</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Current Portfolio Value</span>
                  <span>{formatCurrency(portfolioValue)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>New Investment</span>
                  <span className="text-green-500">{formatCurrency(investmentAmount)}</span>
                </div>
                <div className="border-t border-border my-2"></div>
                <div className="flex justify-between font-medium">
                  <span>New Portfolio Value</span>
                  <span>{formatCurrency(portfolioValue + investmentAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>New Portfolio Weight</span>
                  <span>{((investmentAmount / (portfolioValue + investmentAmount)) * 100).toFixed(1)}%</span>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedStock(null)}>
                Cancel
              </Button>
              <Button 
                className="bg-green-500 hover:bg-green-600"
                onClick={addStockToPortfolio}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Add to Portfolio"
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface StockCardProps {
  stock: Stock;
  onSelect: () => void;
  trending?: boolean;
  friend?: {
    name: string;
    avatar: string;
  };
}

function StockCard({ stock, onSelect, trending, friend }: StockCardProps) {
  return (
    <Card
      className="bg-card border-border overflow-hidden cursor-pointer hover:border-primary transition-colors"
      onClick={onSelect}
    >
      <CardContent className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-muted h-10 w-10 rounded-md flex items-center justify-center font-bold text-sm">
            {stock.symbol.substring(0, 2)}
          </div>
          <div>
            <div className="flex items-center gap-1">
              <h3 className="font-bold">{stock.name}</h3>
              {trending && (
                <Badge className="ml-1 bg-orange-500/20 text-orange-500 hover:bg-orange-500/30 hover:text-orange-500">
                  <Flame className="h-3 w-3 mr-1" />
                  Trending
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <p className="text-muted-foreground text-sm">{stock.symbol}</p>
              {friend && (
                <div className="flex items-center gap-1 ml-1">
                  <span className="text-muted-foreground text-xs">•</span>
                  <Avatar className="h-4 w-4">
                    <AvatarImage src={friend.avatar} alt={friend.name} />
                    <AvatarFallback>{friend.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-muted-foreground">{friend.name}</span>
                </div>
              )}
              {!friend && !trending && stock.communityOwnership !== undefined && (
                <div className="flex items-center gap-1 ml-1">
                  <span className="text-muted-foreground text-xs">•</span>
                  <Users className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{stock.communityOwnership}%</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="font-bold">{new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          }).format(stock.price)}</p>
          <p className={stock.changePercent >= 0 ? "text-green-500 text-sm" : "text-red-500 text-sm"}>
            {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(1)}%
          </p>
        </div>
      </CardContent>
    </Card>
  );
} 