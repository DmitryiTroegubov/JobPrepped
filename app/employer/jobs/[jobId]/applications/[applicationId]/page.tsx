"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getUserProfile } from "@/lib/auth";
import { toAuthErrorMessage } from "@/lib/firebase-error";
import { getFirebaseAuth, hasFirebaseConfig } from "@/lib/firebase";
import {
  completeApplicationAndSettleJP,
  formatTimestamp,
  getApplicationById,
  getJobById,
  updateApplicationStatus
} from "@/lib/marketplace";
import type { ApplicationDoc, JobDoc, UserDoc } from "@/lib/types";
import { DashboardPanel, DashboardShell, StatCard, StatusPill } from "@/components/dashboard/ui";

export default function EmployerApplicationDetailPage() {
  const router = useRouter();
  const params = useParams<{ jobId: string; applicationId: string }>();

  const [profile, setProfile] = useState<UserDoc | null>(null);
  const [job, setJob] = useState<JobDoc | null>(null);
  const [application, setApplication] = useState<ApplicationDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadContext = async (uid: string) => {
    const [jobData, appData] = await Promise.all([getJobById(params.jobId), getApplicationById(params.applicationId)]);

    if (!jobData || !appData) {
      setJob(jobData);
      setApplication(appData);
      return;
    }

    if (jobData.employerId !== uid || appData.employerId !== uid || appData.jobId !== jobData.id) {
      throw new Error("Access denied");
    }

    setJob(jobData);
    setApplication(appData);
  };

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

        if (userProfile.role !== "employer") {
          router.replace("/marketplace");
          return;
        }

        setProfile(userProfile);
        await loadContext(user.uid);
      } catch (e) {
        setError(toAuthErrorMessage(e));
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, [router, params.jobId, params.applicationId]);

  const onSetStatus = async (next: "viewed" | "accepted" | "rejected") => {
    if (!profile || !application) {
      return;
    }

    setError("");
    try {
      await updateApplicationStatus({
        applicationId: application.id,
        actorUid: profile.uid,
        actorRole: "employer",
        nextStatus: next
      });
      await loadContext(profile.uid);
    } catch (e) {
      setError(toAuthErrorMessage(e));
    }
  };

  const onComplete = async () => {
    if (!profile || !application) {
      return;
    }

    setError("");
    try {
      await completeApplicationAndSettleJP({
        applicationId: application.id,
        employerId: profile.uid
      });
      await loadContext(profile.uid);
    } catch (e) {
      setError(toAuthErrorMessage(e));
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="rounded-2xl border border-white/10 bg-surface-1 px-6 py-4 text-sm text-white/70">Loading...</div>
      </main>
    );
  }

  if (!job || !application) {
    return (
      <DashboardShell
        badge="Application Detail"
        title="Application not found"
        description="This record may have been deleted or you do not have access to it."
        actions={
          <Link href="/employer">
            <Button variant="outline">Back to employer home</Button>
          </Link>
        }
      >
        <DashboardPanel>
          <p className="text-sm text-white/70">Return to your jobs list and open another candidate.</p>
        </DashboardPanel>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      badge="Application Detail"
      title={<Link href={`/profile?id=${application.workerId}`} className="hover:underline decoration-white/50 underline-offset-4">{application.workerName}</Link>}
      description={`Review submission details for "${job.title}" and complete payout once work is done.`}
      actions={
        <>
          <Link href={`/employer/jobs/${job.id}`}>
            <Button variant="outline">Back to applications</Button>
          </Link>
          <Link href={`/applications/${application.id}/chat`}>
            <Button variant="ghost">Open chat</Button>
          </Link>
        </>
      }
      meta={<StatusPill status={application.status} />}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Job" value={job.title} />
        <StatCard label="Reward" value={`${job.rewardJP} JP`} />
        <StatCard label="Created" value={formatTimestamp(application.createdAt)} />
        <StatCard label="Delivery ETA" value={formatTimestamp(application.proposedDeliveryAt)} />
      </div>

      <DashboardPanel title="Proposal Message">
        <p className="whitespace-pre-wrap text-sm text-white/85">{application.message}</p>

        {application.links.length > 0 ? (
          <div className="mt-4 space-y-2">
            {application.links.map((link) => (
              <a
                key={link}
                href={link}
                target="_blank"
                rel="noreferrer"
                className="block truncate rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-neon-cyan transition hover:border-neon-cyan/50"
              >
                {link}
              </a>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-white/60">No additional links provided.</p>
        )}
      </DashboardPanel>

      <DashboardPanel title="Review Actions" description="Set candidate status and settle payment when work is completed.">
        {error ? <p className="mb-4 text-sm text-rose-300">{error}</p> : null}

        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => onSetStatus("viewed")}>
            Viewed
          </Button>
          <Button onClick={() => onSetStatus("accepted")}>Accept</Button>
          <button
            onClick={() => onSetStatus("rejected")}
            className="rounded-full border border-rose-300/60 px-4 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-300/10"
          >
            Reject
          </button>

          {application.status === "accepted" || application.status === "submitted" ? (
            <Button className="bg-emerald-300 text-black hover:bg-emerald-200" onClick={onComplete}>
              Complete + settle JP
            </Button>
          ) : null}
        </div>
      </DashboardPanel>
    </DashboardShell>
  );
}
