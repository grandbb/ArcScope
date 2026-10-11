import { GarcLeaderboard } from "@/components/garc/GarcLeaderboard";

export default function GarcLeaderboardPage({ searchParams }: { searchParams: { wallet?: string } }) {
  return <GarcLeaderboard initialWallet={searchParams.wallet ?? ""} />;
}
