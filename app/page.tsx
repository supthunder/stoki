import { UserLeaderboard } from "@/components/user-leaderboard";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center p-6 md:p-24">
      <h1 className="mb-8 text-4xl font-bold">Stoki</h1>
      <p className="mb-12 text-center text-lg text-muted-foreground">
        Track your stock portfolio and compete with others
      </p>
      
      <div className="w-full max-w-4xl">
        <h2 className="mb-6 text-2xl font-semibold">Leaderboard</h2>
        <UserLeaderboard />
      </div>
    </main>
  );
} 