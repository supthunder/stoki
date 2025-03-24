"use client";

import { UserComparison } from "@/components/user-comparison";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";

// Add list of admin usernames who can access this page
const ADMIN_USERS = ["test"];

export default function TestComparisonPage() {
  const [showComparison, setShowComparison] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Redirect non-admin users
    if (!user) {
      router.push("/login");
      return;
    }
    
    if (!ADMIN_USERS.includes(user.username)) {
      router.push("/");
      return;
    }
  }, [user, router]);

  if (!user || !ADMIN_USERS.includes(user.username)) {
    return <div>Access denied</div>;
  }
  
  return (
    <div className="container mx-auto p-4">
      {showComparison ? (
        <UserComparison 
          opponentId={5} // Nancy Pelosi's ID from the logs
          onBack={() => setShowComparison(false)}
        />
      ) : (
        <div className="flex flex-col items-center justify-center h-[80vh]">
          <h1 className="text-2xl font-bold mb-4">Comparison Test Page (Admin Only)</h1>
          <Button onClick={() => setShowComparison(true)}>
            Show Comparison
          </Button>
        </div>
      )}
    </div>
  );
} 