"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { Header } from "@/components/sections/header";
import { Button } from "@/components/ui/button";
import { getUserProfile } from "@/lib/auth";
import { toAuthErrorMessage } from "@/lib/firebase-error";
import { getFirebaseAuth, hasFirebaseConfig } from "@/lib/firebase";
import { handleSubscribe } from "@/lib/subscription";
import type { UserDoc } from "@/lib/types";

type Tier = {
  name: string;
  label: string;
  price: string;
  points: number;
  description: string;
  cta: string;
  featured?: boolean;
};

const tiers: Tier[] = [
  {
    name: "Starter",
    label: "Free",
    price: "$0/mo",
    points: 500,
    description: "Great for testing the waters.",
    cta: "Get Started"
  },
  {
    name: "Growth",
    label: "Pro",
    price: "$49/mo",
    points: 5000,
    description: "Scale your hiring velocity with premium task rewards.",
    cta: "Upgrade",
    featured: true
  },
  {
    name: "Scale",
    label: "Elite",
    price: "$149/mo",
    points: 20000,
    description: "For serious hiring and rapid, high-volume execution.",
    cta: "Upgrade"
  }
];

export default function PricingPage() {
  const [profile, setProfile] = useState<UserDoc | null>(null);
  const [ready, setReady] = useState(false);
  const [savingTier, setSavingTier] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!hasFirebaseConfig()) {
      setReady(true);
      return;
    }

    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setProfile(null);
        setReady(true);
        return;
      }

      try {
        const userProfile = await getUserProfile(user.uid);
        setProfile(userProfile);
      } catch (e) {
        setError(toAuthErrorMessage(e));
      } finally {
        setReady(true);
      }
    });

    return () => unsub();
  }, []);

  const onSubscribe = async (tier: Tier) => {
    if (!profile) return;

    setSavingTier(tier.name);
    setError("");
    setSuccess("");

    try {
      await handleSubscribe(profile.uid, tier.name, tier.points);
      const nextBalance = Number(profile.jpBalance ?? profile.jobPreppedBalance ?? 0) + tier.points;

      setProfile((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          subscriptionTier: tier.name,
          jpBalance: nextBalance,
          jobPreppedBalance: nextBalance
        };
      });
      setSuccess(`${tier.name} activated. ${tier.points.toLocaleString()} JP added.`);
    } catch (e) {
      setError(toAuthErrorMessage(e));
    } finally {
      setSavingTier("");
    }
  };

  const currentBalance = Number(profile?.jpBalance ?? profile?.jobPreppedBalance ?? 0);
  const currentTier = profile?.subscriptionTier ?? "";

  return (
    <main className="min-h-screen">
      <Header />

      <section className="mx-auto max-w-[1300px] px-5 pb-24 pt-28 md:px-8 md:pb-32 md:pt-36">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/50">Pricing</p>
            <h1 className="mt-4 text-4xl font-black leading-[0.95] tracking-tight md:text-7xl">
              Fuel your growth. Reward top talent.
            </h1>
            <p className="mt-5 max-w-2xl text-sm text-white/65 md:text-lg">
              JP Points power task rewards across the marketplace. Bigger rewards attract stronger applicants and help
              your opportunities rise faster.
            </p>
          </div>

          {profile ? (
            <div className="rounded-3xl bg-[#1A1A1A] px-7 py-5">
              <p className="text-xs uppercase tracking-wide text-white/50">Current balance</p>
              <p className="mt-2 text-3xl font-black tracking-tight">{currentBalance.toLocaleString()} JP</p>
              <p className="mt-1 text-xs text-white/55">Plan: {currentTier || "none"}</p>
            </div>
          ) : null}
        </div>

        {!ready ? <p className="mt-12 text-sm text-white/70">Loading account...</p> : null}

        {ready && !profile ? (
          <div className="mt-12 rounded-3xl bg-[#1A1A1A] p-10">
            <p className="text-sm text-white/70">Sign in with your employer account to activate a JP plan.</p>
            <div className="mt-5 flex gap-3">
              <Link href="/login">
                <Button className="px-7 py-3">Log in</Button>
              </Link>
              <Link href="/register">
                <Button variant="outline" className="px-7 py-3">Create account</Button>
              </Link>
            </div>
          </div>
        ) : null}

        {profile && profile.role !== "employer" ? (
          <div className="mt-12 rounded-3xl bg-[#1A1A1A] p-10">
            <p className="text-sm text-white/70">
              Pricing plans are available for company accounts. Switch to an employer account to purchase JP Points.
            </p>
          </div>
        ) : null}

        {profile?.role === "employer" ? (
          <div className="mt-14 grid gap-8 lg:grid-cols-3">
            {tiers.map((tier) => {
              const isCurrent = currentTier.toLowerCase() === tier.name.toLowerCase();
              const isSaving = savingTier === tier.name;

              return (
                <article
                  key={tier.name}
                  className={
                    tier.featured
                      ? "rounded-3xl bg-[linear-gradient(165deg,rgba(34,34,34,1)_0%,rgba(26,26,26,1)_60%,rgba(154,107,255,0.2)_100%)] p-10 shadow-[0_25px_80px_rgba(154,107,255,0.18)]"
                      : "rounded-3xl bg-[#1A1A1A] p-10"
                  }
                >
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-black tracking-tight">{tier.name}</h2>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/75">
                      {tier.label}
                    </span>
                  </div>

                  <p className="mt-5 text-4xl font-black tracking-tight">{tier.price}</p>
                  <p className="mt-1 text-sm text-white/55">Includes {tier.points.toLocaleString()} JP Points</p>
                  <p className="mt-5 text-sm leading-relaxed text-white/72">{tier.description}</p>

                  <div className="mt-10">
                    {isCurrent ? (
                      <span className="inline-flex rounded-full bg-white/12 px-5 py-3 text-sm font-semibold text-white/85">
                        Current Plan
                      </span>
                    ) : (
                      <Button
                        onClick={() => onSubscribe(tier)}
                        disabled={Boolean(savingTier)}
                        className="px-8 py-3 text-sm font-semibold"
                      >
                        {isSaving ? "Processing..." : tier.cta}
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}

        {error ? <p className="mt-8 text-sm text-rose-300">{error}</p> : null}
        {success ? <p className="mt-8 text-sm text-emerald-300">{success}</p> : null}
      </section>
    </main>
  );
}
