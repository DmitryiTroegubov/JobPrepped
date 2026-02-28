import { redirect } from "next/navigation";

export default function WorkerLeaderboardRedirect() {
  redirect("/marketplace?tab=leaderboard");
}
