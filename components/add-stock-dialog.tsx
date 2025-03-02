"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

// Form schema
const stockFormSchema = z.object({
  symbol: z.string().min(1, "Symbol is required").max(10),
  companyName: z.string().min(1, "Company name is required"),
  quantity: z.coerce
    .number()
    .min(0.01, "Quantity must be greater than 0")
    .max(1000000, "Quantity too large"),
  purchasePrice: z.coerce
    .number()
    .min(0.01, "Price must be greater than 0")
    .max(1000000, "Price too large"),
  purchaseDate: z.string().optional(),
});

type StockFormValues = z.infer<typeof stockFormSchema>;

type AddStockDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStockAdded: () => void;
};

export function AddStockDialog({
  open,
  onOpenChange,
  onStockAdded,
}: AddStockDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form
  const form = useForm<StockFormValues>({
    resolver: zodResolver(stockFormSchema),
    defaultValues: {
      symbol: "",
      companyName: "",
      quantity: 1,
      purchasePrice: 0,
      purchaseDate: new Date().toISOString().split("T")[0],
    },
  });

  // Search for stock by symbol
  const searchStock = async (symbol: string) => {
    if (!symbol) return;

    try {
      setIsSearching(true);
      const response = await fetch(`/api/stocks/search?query=${symbol}`);
      
      if (!response.ok) {
        throw new Error("Failed to search for stock");
      }
      
      const data = await response.json();
      
      if (data.length > 0) {
        // Use the first result
        const stock = data[0];
        form.setValue("symbol", stock.symbol);
        form.setValue("companyName", stock.name);
        
        // Get current price
        const priceResponse = await fetch(`/api/stocks/price?symbol=${stock.symbol}`);
        if (priceResponse.ok) {
          const priceData = await priceResponse.json();
          form.setValue("purchasePrice", priceData.price);
        }
      } else {
        toast({
          title: "Stock not found",
          description: "No matching stocks found. Please check the symbol.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error searching for stock:", error);
      toast({
        title: "Search failed",
        description: "Failed to search for stock. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  // Handle form submission
  const onSubmit = async (values: StockFormValues) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to add stocks to your portfolio.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      
      const response = await fetch("/api/portfolio/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
          ...values,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to add stock");
      }

      toast({
        title: "Stock added",
        description: `${values.symbol} has been added to your portfolio.`,
      });
      
      // Reset form and close dialog
      form.reset();
      onOpenChange(false);
      
      // Refresh portfolio data
      onStockAdded();
    } catch (error) {
      console.error("Error adding stock:", error);
      toast({
        title: "Failed to add stock",
        description: "An error occurred while adding the stock. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Stock to Portfolio</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="flex gap-2">
              <FormField
                control={form.control}
                name="symbol"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Symbol</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="AAPL"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          // Convert to uppercase
                          e.target.value = e.target.value.toUpperCase();
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="button"
                variant="outline"
                className="mt-8"
                onClick={() => searchStock(form.getValues("symbol"))}
                disabled={isSearching || !form.getValues("symbol")}
              >
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Search"
                )}
              </Button>
            </div>

            <FormField
              control={form.control}
              name="companyName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Apple Inc." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder="1"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="purchasePrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purchase Price ($)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="purchaseDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Purchase Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Add Stock"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
} 