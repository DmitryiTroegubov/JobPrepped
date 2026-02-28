"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { signOutUser } from "@/lib/auth";
import { getFirebaseAuth, getFirebaseDb, hasFirebaseConfig } from "@/lib/firebase";
import type { UserRole } from "@/lib/types";


export function Header() {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [role, setRole] = useState<UserRole | null>(null);
  const [jpBalance, setJpBalance] = useState(0);
  const [ready, setReady] = useState(false);
  const companyAccount = role === "employer";

  useEffect(() => {
    if (!hasFirebaseConfig()) {
      setReady(true);
      return;
    }

    const auth = getFirebaseAuth();
    const db = getFirebaseDb();
    let unsubProfile: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }

      if (!user) {
        setUserName("");
        setRole(null);
        setJpBalance(0);
        setReady(true);
        return;
      }

      setReady(false);
      const userRef = doc(db, "users", user.uid);
      unsubProfile = onSnapshot(
        userRef,
        (snap) => {
          const data = snap.data();
          setUserName((data?.name as string | undefined) || user.displayName || user.email || "Account");
          setRole((data?.role as UserRole | undefined) ?? null);
          setJpBalance(Number(data?.jpBalance ?? data?.jobPreppedBalance ?? 0));
          setReady(true);
        },
        () => setReady(true)
      );
    });

    return () => {
      unsubAuth();
      if (unsubProfile) {
        unsubProfile();
      }
    };
  }, []);

  const onSignOut = async () => {
    await signOutUser();
    router.push("/login");
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-bg/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-5 py-4 md:px-8 md:py-5">
        <Link href="/marketplace" className="shrink-0 text-2xl font-black tracking-tight md:text-[1.7rem]">
          JobPrepped
        </Link>

        <div className="flex-1" />

        <div className="flex shrink-0 items-center gap-2 md:gap-4">
          {!ready ? (
            <span className="rounded-full bg-surface-1 px-3 py-2 text-xs text-white/50">...</span>
          ) : userName ? (
            <>
              <Link href="/profile" className="hidden md:inline-flex">
                <Button variant="outline">Profile</Button>
              </Link>
              <span className="hidden rounded-full bg-surface-1 px-3 py-2 text-xs font-semibold text-white/80 md:inline-flex">
                {userName} {role ? `(${role})` : ""}
              </span>
              {companyAccount ? (
                <div className="flex items-center gap-2 md:gap-4">
                  <span className="hidden rounded-full bg-[#1A1A1A] px-3 py-2 text-xs font-semibold text-white/85 ring-1 ring-white/10 sm:inline-flex">
                    &#9889; {jpBalance} JP
                  </span>
                  <Link href="/pricing" className="inline-flex">
                    <Button className="px-5 py-2.5">Get Points</Button>
                  </Link>
                </div>
              ) : null}
              <Button variant="ghost" onClick={onSignOut}>Sign out</Button>
            </>
          ) : (
            <>
              <Link href="/login" className="hidden md:inline-flex">
                <Button variant="ghost">Log in</Button>
              </Link>
              <Link href="/register">
                <Button>Sign up</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
