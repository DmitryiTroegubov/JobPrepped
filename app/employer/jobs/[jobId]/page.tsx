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
  closeJob,
  formatTimestamp,
  getJobById,
  listApplicationsByEmployer,
  toContractStatus
} from "@/lib/marketplace";
import type { ApplicationDoc, JobDoc, UserDoc } from "@/lib/types";
import { DashboardPanel, DashboardShell, StatCard, StatusPill } from "@/components/dashboard/ui";

export default function EmployerJobDetailPage() {
  const router = useRouter();
  const params = useParams<{ jobId: string }>();
  const routeJobId = Array.isArray(params.jobId) ? params.jobId[0] : params.jobId;

  const [profile, setProfile] = useState<UserDoc | null>(null);
  const [job, setJob] = useState<JobDoc | null>(null);
  const [applications, setApplications] = useState<ApplicationDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadJobContext = async (uid: string) => {
    if (!routeJobId) {
      setJob(null);
      setApplications([]);
      return;
    }

    const jobData = await getJobById(routeJobId);
    if (!jobData) {
      setJob(null);
      setApplications([]);
      return;
    }

    if (String(jobData.employerId).trim() !== String(uid).trim()) {
      throw new Error("Access denied for this job");
    }

    setJob(jobData);

    // Query by employerId (rules-friendly), then narrow to this job.
    const apps = await listApplicationsByEmployer(uid, 200);
    setApplications(apps.filter((item) => String(item.jobId) === String(routeJobId)));
    setError("");
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
        await loadJobContext(user.uid);
      } catch (e) {
        setError(toAuthErrorMessage(e));
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, [router, routeJobId]);

  const onCloseJob = async () => {
    if (!profile || !job) {
      return;
    }

    setError("");
    try {
      await closeJob(job.id, profile.uid);
      await loadJobContext(profile.uid);
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

  if (!job) {
    return (
      <DashboardShell
        badge="Employer Job Detail"
        title="Job not found"
        description="The job no longer exists or is not available for this account."
        actions={
          <Link href="/employer">
            <Button variant="outline">Back to employer home</Button>
          </Link>
        }
      >
        <DashboardPanel>
          <p className="text-sm text-white/70">Open another job from your dashboard list.</p>
          {error ? (
            <p className="mt-3 text-sm text-rose-300">
              Details: {error}
            </p>
          ) : null}
        </DashboardPanel>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      badge="Employer Job Detail"
      title={job.title}
      description="Manage job status and triage incoming applications from a single marketplace-style control panel."
      actions={
        <>
          <Link href="/employer">
            <Button variant="outline">Back to jobs</Button>
          </Link>
          {job.status !== "closed" ? (
            <Button onClick={onCloseJob}>
              Close job
            </Button>
          ) : null}
        </>
      }
      meta={<StatusPill status={job.status} />}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Reward" value={`${job.rewardJP} JP`} />
        <StatCard label="Applicants" value={String(job.applicantsCount)} />
        <StatCard label="Category" value={job.category} />
        <StatCard label="Level" value={job.level} />
      </div>

      <DashboardPanel title="Job Summary" description={`${job.locationType}${job.city ? ` | ${job.city}` : ""}`}>
        <p className="text-sm text-white/75">Created: {formatTimestamp(job.createdAt)}</p>
        <p className="mt-1 text-sm text-white/75">Deadline: {formatTimestamp(job.deadlineAt)}</p>
        <p className="mt-4 whitespace-pre-wrap text-sm text-white/85">{job.description}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {job.requiredSkills.map((skill) => (
            <span key={skill} className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-xs text-white/80">
              {skill}
            </span>
          ))}
        </div>
      </DashboardPanel>

      <section className="flex flex-col gap-6 rounded-3xl bg-[#1A1A1A] p-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black tracking-tight md:text-3xl">Applications</h2>
            <p className="mt-2 text-sm text-white/60 md:text-base">
              Open each contract room to hire, review submissions, and complete payouts.
            </p>
          </div>
          <span className="rounded-full bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/75">
            {applications.length} total
          </span>
        </div>

        {error ? <p className="text-sm text-rose-300">{error}</p> : null}

        <div className="space-y-4">
          {applications.length === 0 ? (
            <p className="rounded-2xl bg-white/5 p-6 text-sm text-white/65">No applications yet.</p>
          ) : null}

          {applications.map((application) => {
            const contractStatus = toContractStatus(application.status);
            const statusMeta: Record<
              "pending" | "hired" | "submitted" | "completed",
              { label: string; className: string }
            > = {
              pending: { label: "Pending", className: "bg-blue-500/20 text-blue-300" },
              hired: { label: "Hired", className: "bg-emerald-500/20 text-emerald-300" },
              submitted: { label: "Submitted", className: "bg-amber-500/20 text-amber-300" },
              completed: { label: "Completed", className: "bg-cyan-500/20 text-cyan-300" }
            };
            const badge = statusMeta[contractStatus];

            return (
              <article
                key={application.id}
                className="flex flex-col justify-between gap-5 rounded-2xl bg-[#2A2A2A] p-6 md:flex-row md:items-center"
              >
                <div className="min-w-0">
                  <h3 className="text-xl font-black tracking-tight text-white">
                    <Link href={`/profile?id=${application.workerId}`} className="hover:underline decoration-white/50 underline-offset-4">{application.workerName || "Worker"}</Link>
                  </h3>
                  <p className="mt-1 text-xs text-white/55">Created: {formatTimestamp(application.createdAt)}</p>
                  <p className="mt-3 text-sm leading-relaxed text-white/75">{application.message}</p>
                </div>

                <div className="flex shrink-0 flex-col items-start gap-3 md:items-end">
                  <span className={`rounded-full px-4 py-1 text-sm font-bold tracking-wide ${badge.className}`}>
                    {badge.label}
                  </span>
                  <Link
                    href={`/applications/${application.id}/chat`}
                    className="rounded-full bg-white px-8 py-3 text-sm font-bold text-black transition-all hover:bg-gray-200"
                  >
                    Open Chat &amp; Manage
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </DashboardShell>
  );
}
