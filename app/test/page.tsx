"use client";

import { useEffect, useState } from "react";

export default function TestPage() {
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const response = await fetch("/api/leaderboard");
        if (!response.ok) {
          throw new Error(`Failed to fetch leaderboard data: ${response.status}`);
        }
        const data = await response.json();
        console.log("Test page leaderboard data:", data);
        setLeaderboardData(data);
      } catch (err) {
        console.error("Failed to fetch leaderboard data:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch leaderboard data");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Leaderboard Test</h1>
      <div className="space-y-4">
        {leaderboardData.map((user) => (
          <div key={user.id} className="border p-4 rounded-lg">
            <div className="font-bold">ID: {user.id}</div>
            <div>Username: {user.username || "No username"}</div>
            <div>Current Worth: {user.currentWorth}</div>
            <div>Total Gain: {user.totalGain}</div>
            <pre className="mt-2 text-xs bg-gray-100 p-2 rounded">
              {JSON.stringify(user, null, 2)}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
} 