"use client";

import { UserPortfolio } from "@/components/user-portfolio";

export default function TestPortfolioPage() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Portfolio Test Page</h1>
      <UserPortfolio />
    </div>
  );
} 