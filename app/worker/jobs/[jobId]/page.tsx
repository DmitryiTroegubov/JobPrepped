"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/sections/header";
import { Button } from "@/components/ui/button";
import { getUserProfile } from "@/lib/auth";
import { toAuthErrorMessage } from "@/lib/firebase-error";
import { getFirebaseAuth, hasFirebaseConfig } from "@/lib/firebase";
import {
  favoriteEmployer,
  formatTimestamp,
  getJobById,
  handleOneClickApply,
  listFavoriteEmployers,
  unfavoriteEmployer
} from "@/lib/marketplace";
import type { JobDoc, UserDoc } from "@/lib/types";

export default function WorkerJobDetailPage() {
  const router = useRouter();
  const params = useParams<{ jobId: string }>();

  const [profile, setProfile] = useState<UserDoc | null>(null);
  const [job, setJob] = useState<JobDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [isApplying, setIsApplying] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [error, setError] = useState("");
  const [isFavorite, setIsFavorite] = useState(false);

  const canApply = useMemo(() => {
    return Boolean(job && job.status === "open" && profile && profile.uid !== job.employerId);
  }, [job, profile]);

  useEffect(() => {
    if (!hasFirebaseConfig()) {
      router.replace("/login");
      return;
    }

    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      try {
        const userProfile = await getUserProfile(user.uid);
        if (!userProfile) {
          router.replace("/complete-profile");
          return;
        }

        if (userProfile.role !== "worker") {
          router.replace("/employer");
          return;
        }

        const [jobData, favorites] = await Promise.all([
          getJobById(params.jobId),
          listFavoriteEmployers(userProfile.uid, 500)
        ]);

        setProfile(userProfile);
        setJob(jobData);

        if (jobData) {
          setIsFavorite(favorites.some((item) => item.employerId === jobData.employerId));
        }
      } catch (e) {
        setError(toAuthErrorMessage(e));
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, [router, params.jobId]);

  const onApply = async () => {
    if (!profile || !job) return;

    setIsApplying(true);
    setError("");

    try {
      const applicationId = await handleOneClickApply(job, profile.uid);
      router.push(`/applications/${applicationId}/chat`);
    } catch (e) {
      setError(toAuthErrorMessage(e));
    } finally {
      setIsApplying(false);
    }
  };

  const onToggleFavorite = async () => {
    if (!profile || !job) return;

    setFavoriteBusy(true);
    setError("");

    try {
      if (isFavorite) {
        await unfavoriteEmployer({
          workerId: profile.uid,
          employerId: job.employerId
        });
        setIsFavorite(false);
      } else {
        await favoriteEmployer({
          workerId: profile.uid,
          employerId: job.employerId,
          employerName: job.employerName
        });
        setIsFavorite(true);
      }
    } catch (e) {
      setError(toAuthErrorMessage(e));
    } finally {
      setFavoriteBusy(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0D0D0D] text-white">
        <Header />
        <div className="mx-auto flex min-h-[60vh] w-full max-w-6xl items-center justify-center px-4 pb-10 pt-28 md:px-8">
          <div className="rounded-3xl bg-[#1A1A1A] px-8 py-6 text-sm text-white/70">Loading job...</div>
        </div>
      </main>
    );
  }

  if (!job) {
    return (
      <main className="min-h-screen bg-[#0D0D0D] text-white">
        <Header />
        <div className="mx-auto w-full max-w-6xl px-4 pb-10 pt-24 md:px-8 md:pt-28">
          <section className="rounded-3xl bg-[#1A1A1A] p-10">
            <h1 className="text-3xl font-black tracking-tight md:text-4xl">Job not found</h1>
            <p className="mt-3 text-sm text-white/60 md:text-base">
              This task may have been removed or closed.
            </p>
            <div className="mt-8">
              <Link href="/marketplace" className="inline-flex rounded-full bg-white px-6 py-3 text-sm font-semibold text-black">
                Back to marketplace
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0D0D0D] text-white">
      <Header />
      <div className="mx-auto w-full max-w-6xl px-4 pb-12 pt-24 md:px-8 md:pt-28">
        <section className="rounded-3xl bg-[#1A1A1A] p-8 md:p-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/55">Live Marketplace Job</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight md:text-5xl">{job.title}</h1>
              <p className="mt-3 text-sm text-white/65 md:text-base">
                Employer: {job.employerName} | {job.category} | {job.level} | {job.locationType}
                {job.city ? ` | ${job.city}` : ""}
              </p>
            </div>
            <span className="rounded-full bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/75">
              {job.status}
            </span>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/marketplace" className="inline-flex rounded-full bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15">
              Back to projects
            </Link>
            <Link href="/marketplace?tab=applications" className="inline-flex rounded-full bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15">
              My applications
            </Link>
            <Link href="/marketplace?tab=favorites" className="inline-flex rounded-full bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15">
              Favorites
            </Link>
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_1fr]">
          <article className="rounded-3xl bg-[#1A1A1A] p-8">
            <p className="text-sm text-white/70">Reward: {job.rewardJP} JP</p>
            <p className="mt-1 text-sm text-white/70">Posted: {formatTimestamp(job.createdAt)}</p>
            <p className="mt-1 text-sm text-white/70">Deadline: {formatTimestamp(job.deadlineAt)}</p>

            <div className="mt-5">
              <Button variant={isFavorite ? "outline" : "primary"} onClick={onToggleFavorite} disabled={favoriteBusy}>
                {favoriteBusy ? "Saving..." : isFavorite ? "Unfollow employer" : "Follow employer"}
              </Button>
            </div>

            <p className="mt-6 whitespace-pre-wrap text-sm leading-relaxed text-white/80">{job.description}</p>

            <div className="mt-6 flex flex-wrap gap-2">
              {job.requiredSkills.map((skill) => (
                <span key={skill} className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/75">
                  {skill}
                </span>
              ))}
            </div>
          </article>

          <article className="rounded-3xl bg-[#1A1A1A] p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/55">One-click apply</p>
            <h2 className="mt-4 text-3xl font-black tracking-tight md:text-4xl">Ready to start?</h2>
            <p className="mt-3 text-sm leading-relaxed text-white/65 md:text-base">
              Apply instantly and open a direct contract chat with the employer. If you already applied, you will be
              taken back to your existing conversation.
            </p>

            {error ? (
              <div className="mt-6 rounded-2xl bg-rose-500/12 px-4 py-3 text-sm text-rose-200">{error}</div>
            ) : null}

            <div className="mt-8">
              <Button onClick={onApply} disabled={!canApply || isApplying} className="px-8 py-4 text-base font-semibold">
                {isApplying ? "Applying..." : "Apply & Start Chat"}
              </Button>
              {!canApply ? (
                <p className="mt-3 text-sm text-white/55">Applications are unavailable for this job.</p>
              ) : null}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
