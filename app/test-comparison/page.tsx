"use client";

import { UserComparison } from "@/components/user-comparison";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export default function TestComparisonPage() {
  const [showComparison, setShowComparison] = useState(false);
  
  return (
    <div className="container mx-auto p-4">
      {showComparison ? (
        <UserComparison 
          opponentId={5} // Nancy Pelosi's ID from the logs
          onBack={() => setShowComparison(false)}
        />
      ) : (
        <div className="flex flex-col items-center justify-center h-[80vh]">
          <h1 className="text-2xl font-bold mb-4">Comparison Test Page</h1>
          <Button onClick={() => setShowComparison(true)}>
            Show Comparison
          </Button>
        </div>
      )}
    </div>
  );
} 