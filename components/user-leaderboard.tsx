"use client";

import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

// Mock data for demo purposes
const mockUsers = [
  {
    id: 1,
    name: "Alice Johnson",
    totalGain: 12450.75,
    totalGainPercentage: 24.5,
    topGainer: "AAPL",
    topGainerPercentage: 12.3,
    currentWorth: 65450.25,
  },
  {
    id: 2,
    name: "Bob Smith",
    totalGain: 8923.50,
    totalGainPercentage: 18.2,
    topGainer: "MSFT",
    topGainerPercentage: 9.7,
    currentWorth: 58200.75,
  },
  {
    id: 3,
    name: "Carol Williams",
    totalGain: 15678.30,
    totalGainPercentage: 32.1,
    topGainer: "TSLA",
    topGainerPercentage: 28.5,
    currentWorth: 72300.45,
  },
  {
    id: 4,
    name: "David Brown",
    totalGain: -2350.25,
    totalGainPercentage: -5.8,
    topGainer: "NVDA",
    topGainerPercentage: 6.2,
    currentWorth: 38750.50,
  },
  {
    id: 5,
    name: "Eva Martinez",
    totalGain: 6740.80,
    totalGainPercentage: 14.2,
    topGainer: "AMZN",
    topGainerPercentage: 8.9,
    currentWorth: 51230.35,
  },
];

export function UserLeaderboard() {
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Rank</TableHead>
            <TableHead>User</TableHead>
            <TableHead>Total Gain</TableHead>
            <TableHead>Top Gainer</TableHead>
            <TableHead className="text-right">Current Worth</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {mockUsers
            .sort((a, b) => b.totalGain - a.totalGain)
            .map((user, index) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{index + 1}</TableCell>
                <TableCell>{user.name}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span
                      className={
                        user.totalGain >= 0 ? "text-green-600" : "text-red-600"
                      }
                    >
                      ${user.totalGain.toLocaleString()}
                    </span>
                    <span
                      className={`text-xs ${
                        user.totalGainPercentage >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {user.totalGainPercentage >= 0 ? "+" : ""}
                      {user.totalGainPercentage}%
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{user.topGainer}</Badge>
                    <span
                      className={`text-xs ${
                        user.topGainerPercentage >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {user.topGainerPercentage >= 0 ? "+" : ""}
                      {user.topGainerPercentage}%
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  ${user.currentWorth.toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </Card>
  );
} 