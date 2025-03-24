"use client";

import { UserPortfolio } from "@/components/user-portfolio";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Add list of admin usernames who can access this page
const ADMIN_USERS = ["test"];

export default function TestPortfolioPage() {
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
      <h1 className="text-2xl font-bold mb-4">Portfolio Test Page (Admin Only)</h1>
      <UserPortfolio />
    </div>
  );
} 