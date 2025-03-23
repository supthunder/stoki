"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import { toast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";

type CryptoDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCryptoAdded: () => void;
};

type CryptoDetails = {
  id: string;
  symbol: string;
  name: string;
  thumb: string;
  currentPrice?: number;
};

export function AddCryptoDialog({ open, onOpenChange, onCryptoAdded }: CryptoDialogProps) {
  const { user } = useAuth();
  const [symbol, setSymbol] = useState("");
  const [quantity, setQuantity] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<CryptoDetails[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedCrypto, setSelectedCrypto] = useState<CryptoDetails | null>(null);
  const [fetchingPrice, setFetchingPrice] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const searchCrypto = async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    setApiError(null);
    try {
      const response = await fetch(`/api/crypto/search?query=${encodeURIComponent(query)}`);
      
      if (response.status === 429) {
        setApiError("CoinGecko API rate limit reached. Please try again later.");
        setSearchResults([]);
        return;
      }
      
      if (!response.ok) {
        throw new Error('Failed to search crypto');
      }
      
      const data = await response.json();
      
      if (data.error) {
        setApiError(data.error);
        setSearchResults([]);
        return;
      }
      
      setSearchResults(data.coins?.slice(0, 5) || []);
    } catch (error) {
      console.error('Error searching crypto:', error);
      setApiError("Failed to connect to CoinGecko API. Please try again later.");
    } finally {
      setSearching(false);
    }
  };

  const fetchCryptoPrice = async (cryptoId: string) => {
    if (!cryptoId) return;
    
    setFetchingPrice(true);
    try {
      const response = await fetch(`/api/crypto/price?id=${cryptoId}`);
      if (!response.ok) throw new Error('Failed to fetch crypto price');
      const data = await response.json();
      
      if (data.price && selectedCrypto) {
        setSelectedCrypto({
          ...selectedCrypto,
          currentPrice: data.price
        });
        // Pre-fill purchase price with current price
        setPurchasePrice(data.price.toString());
      }
    } catch (error) {
      console.error('Error fetching crypto price:', error);
    } finally {
      setFetchingPrice(false);
    }
  };

  // When a crypto is selected, fetch its current price
  useEffect(() => {
    if (selectedCrypto?.id) {
      fetchCryptoPrice(selectedCrypto.id);
    }
  }, [selectedCrypto?.id]);

  const handleSelectCrypto = (crypto: CryptoDetails) => {
    setSelectedCrypto(crypto);
    setSymbol(crypto.symbol.toLowerCase());
    setSearchResults([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedCrypto) return;

    try {
      setLoading(true);
      const response = await fetch('/api/portfolio/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          symbol: selectedCrypto.symbol,
          quantity: parseFloat(quantity),
          purchasePrice: parseFloat(purchasePrice),
          assetType: 'crypto'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add crypto');
      }

      toast({
        title: "Success",
        description: `${selectedCrypto.name} added to your portfolio`,
      });

      // Reset form and close dialog
      setSymbol("");
      setQuantity("");
      setPurchasePrice("");
      setSelectedCrypto(null);
      onCryptoAdded();
      onOpenChange(false);
    } catch (error) {
      console.error('Error adding crypto:', error);
      toast({
        title: "Error",
        description: "Failed to add cryptocurrency to portfolio",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 6, // More decimals for crypto
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Cryptocurrency</DialogTitle>
          <DialogDescription>
            Search for cryptocurrencies and add them to your portfolio
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cryptoSearch">Search Cryptocurrency</Label>
            <Input
              id="cryptoSearch"
              value={symbol}
              onChange={(e) => {
                setSymbol(e.target.value);
                setSelectedCrypto(null);
                searchCrypto(e.target.value);
              }}
              placeholder="Enter crypto name or symbol (e.g. Bitcoin, BTC)"
            />
            {searching && <div className="text-sm text-muted-foreground">Searching...</div>}
            {apiError && (
              <div className="text-sm text-red-500 p-2 bg-red-100 rounded-md">
                {apiError}
              </div>
            )}
            {searchResults.length > 0 && (
              <div className="max-h-40 overflow-y-auto border rounded-md">
                {searchResults.map((coin) => (
                  <button
                    key={coin.id}
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-accent flex items-center gap-2"
                    onClick={() => handleSelectCrypto(coin)}
                  >
                    <img src={coin.thumb} alt={coin.name} className="w-5 h-5" />
                    <div>
                      <span>{coin.name}</span>
                      <span className="text-muted-foreground ml-1">({coin.symbol.toUpperCase()})</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedCrypto && (
            <div className="border rounded-md p-3 space-y-2 bg-accent/10">
              <div className="flex items-center gap-2">
                <img src={selectedCrypto.thumb} alt={selectedCrypto.name} className="w-6 h-6" />
                <div className="font-medium">{selectedCrypto.name} ({selectedCrypto.symbol.toUpperCase()})</div>
              </div>
              {fetchingPrice ? (
                <div className="text-sm flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Fetching current price...</span>
                </div>
              ) : selectedCrypto.currentPrice ? (
                <div className="text-sm">
                  Current price: <span className="font-medium">{formatCurrency(selectedCrypto.currentPrice)}</span>
                </div>
              ) : null}
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Enter quantity"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="purchasePrice">Purchase Price (USD)</Label>
            <Input
              id="purchasePrice"
              type="number"
              step="any"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
              placeholder="Enter purchase price"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !selectedCrypto || !quantity || !purchasePrice}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Cryptocurrency"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
} 