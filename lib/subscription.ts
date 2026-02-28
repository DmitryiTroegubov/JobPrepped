import { doc, increment, serverTimestamp, updateDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";

export async function handleSubscribe(userId: string, tierName: string, pointsToAward: number) {
  if (!userId) {
    throw new Error("Missing userId");
  }
  if (!tierName.trim()) {
    throw new Error("Missing tierName");
  }
  if (!Number.isFinite(pointsToAward) || pointsToAward <= 0) {
    throw new Error("pointsToAward must be greater than 0");
  }

  // Hackathon MVP: simulate payment latency before writing to Firestore.
  await new Promise((resolve) => setTimeout(resolve, 900));

  const db = getFirebaseDb();
  const userRef = doc(db, "users", userId);

  await updateDoc(userRef, {
    subscriptionTier: tierName,
    jpBalance: increment(pointsToAward),
    jobPreppedBalance: increment(pointsToAward),
    updatedAt: serverTimestamp()
  });

  return {
    subscriptionTier: tierName,
    pointsAwarded: pointsToAward
  };
}
