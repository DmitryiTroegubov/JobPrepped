"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { Header } from "@/components/sections/header";
import { Hero } from "@/components/sections/hero";
import { TrendRail } from "@/components/sections/trend-rail";
import { CategoryRail } from "@/components/sections/category-rail";
import { Footer } from "@/components/sections/footer";
import { Button } from "@/components/ui/button";
import { banners, categories, trendingTopics, type Banner } from "@/data/mock";
import { getUserProfile } from "@/lib/auth";
import { toAuthErrorMessage } from "@/lib/firebase-error";
import { getFirebaseAuth, hasFirebaseConfig } from "@/lib/firebase";
import type { FormEvent } from "react";
import { SeedMarketplaceDataButton } from "@/components/dashboard/seed-marketplace-data-button";
import {
  createJob,
  formatTimestamp,
  getJobById,
  getTrendingTopics,
  getUnreadNotificationsCount,
  listApplicationsByWorker,
  listEmployerJobs,
  listFavoriteEmployers,
  listJobs,
  listNotifications,
  listTopWorkersLeaderboard,
  listWeeklyWorkersLeaderboard,
  markAllNotificationsRead,
  markNotificationRead,
  toContractStatus,
  unfavoriteEmployer
} from "@/lib/marketplace";
import type {
  ApplicationDoc,
  CreateJobInput,
  FavoriteEmployerDoc,
  JobDoc,
  LeaderboardWorker,
  LocationType,
  NotificationDoc,
  UserDoc
} from "@/lib/types";

type Tab = "Projects" | "Applications" | "Notifications" | "Favorites" | "Leaderboard" | "Dashboard" | "My Jobs" | "Create Job";
type BoardMode = "global" | "weekly";

const CATEGORIES = [
  "Frontend",
  "Backend",
  "Full-Stack",
  "UI/UX Design",
  "Mobile Dev",
  "Data Science",
  "DevOps",
  "Product Management"
] as const;

const LEVELS = ["Intern", "Junior", "Middle", "Senior", "Lead"] as const;
const DURATIONS = ["< 1 week", "1-2 weeks", "1 month", "2-3 months", "Ongoing"] as const;
const LOCATIONS = ["Remote", "Hybrid", "On-site"] as const;

const POPULAR_SKILLS = [
  "React",
  "Next.js",
  "Vue",
  "Node.js",
  "Python",
  "Firebase",
  "Figma",
  "Tailwind CSS",
  "TypeScript",
  "SQL",
  "AWS",
  "UI/UX"
] as const;

const LEVEL_TO_VALUE: Record<(typeof LEVELS)[number], CreateJobInput["level"]> = {
  Intern: "intern",
  Junior: "junior",
  Middle: "middle",
  Senior: "senior",
  Lead: "lead"
};

const VALUE_TO_LEVEL: Record<CreateJobInput["level"], (typeof LEVELS)[number]> = {
  any: "Intern",
  intern: "Intern",
  junior: "Junior",
  middle: "Middle",
  senior: "Senior",
  lead: "Lead"
};

const LOCATION_TO_VALUE: Record<(typeof LOCATIONS)[number], LocationType> = {
  Remote: "remote",
  Hybrid: "hybrid",
  "On-site": "onsite"
};

const VALUE_TO_LOCATION: Record<LocationType, (typeof LOCATIONS)[number]> = {
  remote: "Remote",
  hybrid: "Hybrid",
  onsite: "On-site"
};

const DEFAULT_FORM: CreateJobInput = {
  title: "",
  description: "",
  category: CATEGORIES[0],
  requiredSkills: [],
  level: "intern",
  rewardJP: 0,
  duration: DURATIONS[0],
  deadlineAt: null,
  locationType: LOCATION_TO_VALUE[LOCATIONS[0]],
  city: null,
  attachments: [],
  searchKeywords: []
};

type NotificationItem = NotificationDoc & { id: string };
type WorkerApplicationRow = ApplicationDoc & {
  jobTitle: string;
  employerName: string;
  contractStatus: "pending" | "hired" | "submitted" | "completed";
};

const workerTabs: Tab[] = ["Projects", "Applications", "Notifications", "Favorites", "Leaderboard"];
const employerTabs: Tab[] = ["Dashboard", "My Jobs", "Create Job", "Leaderboard"];
const statusMeta = {
  pending: { label: "Pending", className: "bg-blue-500/20 text-blue-300" },
  hired: { label: "Hired", className: "bg-green-500/20 text-green-400" },
  submitted: { label: "Submitted", className: "bg-amber-500/20 text-amber-300" },
  completed: { label: "Completed", className: "bg-cyan-500/20 text-cyan-300" }
} as const;

function toProposalSnippet(message: unknown) {
  const text = typeof message === "string" ? message.trim() : "";
  if (!text) return "No proposal note provided yet.";
  if (text.length <= 120) return text;
  return `${text.slice(0, 117)}...`;
}

function tabFromQuery(value: string | null): Tab {
  if (value === "applications") return "Applications";
  if (value === "notifications") return "Notifications";
  if (value === "favorites") return "Favorites";
  if (value === "leaderboard") return "Leaderboard";
  return "Projects";
}

function tabToQuery(tab: Tab) {
  if (tab === "Applications") return "applications";
  if (tab === "Notifications") return "notifications";
  if (tab === "Favorites") return "favorites";
  if (tab === "Leaderboard") return "leaderboard";
  return "projects";
}

function JobCard({ job, isFavorite }: { job: JobDoc; isFavorite: boolean }) {
  const tags = [job.category, job.level, job.locationType];

  return (
    <article className="rounded-3xl bg-surface-1/90 p-6 shadow-glow transition duration-200 hover:bg-surface-2/90">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-2xl font-extrabold leading-tight text-white md:text-[1.8rem]">{job.title}</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-white/75"
              >
                {tag}
              </span>
            ))}
            {isFavorite ? (
              <span className="rounded-full bg-emerald-300/20 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-emerald-200">
                Following employer
              </span>
            ) : null}
          </div>
        </div>
        <span className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/80">
          {job.status}
        </span>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-white/72">{job.description}</p>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-white/58">
          {job.rewardJP} JP | Posted {formatTimestamp(job.createdAt)}
        </p>
        <Link href={`/worker/jobs/${job.id}`}>
          <Button className="px-6 py-3 text-sm font-semibold">Open & Apply</Button>
        </Link>
      </div>
    </article>
  );
}

function PromoCard({ banner }: { banner: Banner }) {
  return (
    <article className={`relative overflow-hidden rounded-3xl p-6 ${banner.gradient}`}>
      <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/20 blur-2xl" />
      <p className="max-w-sm text-2xl font-black leading-tight text-black">{banner.heading}</p>
      <p className="mt-2 text-sm text-black/75">{banner.copy}</p>
      <button className="mt-5 rounded-full bg-black/85 px-4 py-2 text-sm font-semibold text-white">
        {banner.cta}
      </button>
    </article>
  );
}

export default function MarketplacePage() {
  const router = useRouter();

  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<UserDoc | null>(null);

  // Trending state
  const [liveTrendingTopics, setLiveTrendingTopics] = useState(trendingTopics);

  // Tab state - default depends on role after auth
  const [tab, setTab] = useState<Tab>("Projects");

  // Worker State
  const [category, setCategory] = useState("");
  const [skill, setSkill] = useState("");
  const [locationType, setLocationType] = useState<"" | LocationType>("");
  const [jobsLoading, setJobsLoading] = useState(false);
  const [applications, setApplications] = useState<WorkerApplicationRow[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [favorites, setFavorites] = useState<Array<FavoriteEmployerDoc & { id: string }>>([]);

  // Employer State
  const [employerJobs, setEmployerJobs] = useState<JobDoc[]>([]);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);

  // Shared State
  const [jobs, setJobs] = useState<JobDoc[]>([]);
  const [boardMode, setBoardMode] = useState<BoardMode>("global");
  const [leaderboard, setLeaderboard] = useState<LeaderboardWorker[]>([]);

  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [busyNotifId, setBusyNotifId] = useState("");
  const [markingAll, setMarkingAll] = useState(false);
  const [busyEmployerId, setBusyEmployerId] = useState("");
  const [error, setError] = useState("");

  const myRank = useMemo(() => {
    if (!profile) return null;
    const idx = leaderboard.findIndex((x) => x.uid === profile.uid);
    return idx >= 0 ? idx + 1 : null;
  }, [profile, leaderboard]);

  const unreadNotifications = useMemo(
    () => notifications.filter((item) => !item.read).length,
    [notifications]
  );

  const favoriteEmployerIds = useMemo(() => new Set(favorites.map((item) => item.employerId)), [favorites]);

  const applicationsInProgress = useMemo(
    () => applications.filter((item) => item.contractStatus === "hired").length,
    [applications]
  );

  const completedApplications = useMemo(
    () => applications.filter((item) => item.contractStatus === "completed").length,
    [applications]
  );

  const loadLeaderboard = async (mode: BoardMode) => {
    const top = mode === "global" ? await listTopWorkersLeaderboard(100) : await listWeeklyWorkersLeaderboard(100);
    setLeaderboard(top);
  };

  const loadApplications = async (uid: string) => {
    const rawApplications = await listApplicationsByWorker(uid);
    const uniqueJobIds = Array.from(new Set(rawApplications.map((item) => item.jobId).filter(Boolean)));

    const jobsById = new Map(
      await Promise.all(
        uniqueJobIds.map(async (jobId) => {
          try {
            const job = await getJobById(jobId);
            return [jobId, job] as const;
          } catch {
            return [jobId, null] as const;
          }
        })
      )
    );

    const nextApplications: WorkerApplicationRow[] = rawApplications.map((application) => {
      const job = jobsById.get(application.jobId);
      return {
        ...application,
        jobTitle: job?.title?.trim() || "Untitled task",
        employerName: job?.employerName?.trim() || "Employer",
        contractStatus: toContractStatus(application.status)
      };
    });

    setApplications(nextApplications);
  };

  const loadNotifications = async (uid: string) => {
    const items = (await listNotifications(uid, 200)) as NotificationItem[];
    const unreadCount = await getUnreadNotificationsCount(uid);

    // Keep local item state authoritative, use count call as backend sanity signal.
    if (unreadCount !== items.filter((item) => !item.read).length) {
      setNotifications([...items]);
      return;
    }

    setNotifications(items);
  };

  const loadFavorites = async (uid: string) => {
    const items = (await listFavoriteEmployers(uid, 200)) as Array<FavoriteEmployerDoc & { id: string }>;
    setFavorites(items);
  };

  const pushTab = (nextTab: Tab) => {
    setTab(nextTab);

    const params = new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : ""
    );
    const nextQueryValue = tabToQuery(nextTab);

    if (nextQueryValue === "projects") {
      params.delete("tab");
    } else {
      params.set("tab", nextQueryValue);
    }

    const queryString = params.toString();
    router.replace(queryString ? `/marketplace?${queryString}` : "/marketplace");
  };

  const onSwitchBoardMode = async (mode: BoardMode) => {
    setBoardMode(mode);
    setError("");
    try {
      await loadLeaderboard(mode);
    } catch (e) {
      setError(toAuthErrorMessage(e));
    }
  };

  const onMarkNotificationRead = async (notifId: string) => {
    if (!profile) return;

    setBusyNotifId(notifId);
    setError("");

    try {
      await markNotificationRead(profile.uid, notifId);
      setNotifications((prev) => prev.map((item) => (item.id === notifId ? { ...item, read: true } : item)));
    } catch (e) {
      setError(toAuthErrorMessage(e));
    } finally {
      setBusyNotifId("");
    }
  };

  const onMarkAllNotificationsRead = async () => {
    if (!profile || unreadNotifications === 0) return;

    setMarkingAll(true);
    setError("");

    try {
      await markAllNotificationsRead(profile.uid);
      setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
    } catch (e) {
      setError(toAuthErrorMessage(e));
    } finally {
      setMarkingAll(false);
    }
  };

  const onUnfavoriteEmployer = async (employerId: string) => {
    if (!profile) return;

    setBusyEmployerId(employerId);
    setError("");

    try {
      await unfavoriteEmployer({ workerId: profile.uid, employerId });
      setFavorites((prev) => prev.filter((item) => item.employerId !== employerId));
    } catch (e) {
      setError(toAuthErrorMessage(e));
    } finally {
      setBusyEmployerId("");
    }
  };

  // Employer Form Handlers
  const refreshEmployerJobs = async (employerId: string) => {
    const result = await listEmployerJobs(employerId);
    setEmployerJobs(result);
  };

  const requiredFilled = useMemo(() => {
    return (
      form.title.trim().length > 0 &&
      form.description.trim().length > 0 &&
      form.rewardJP > 0 &&
      form.requiredSkills.length > 0
    );
  }, [form.title, form.description, form.rewardJP, form.requiredSkills.length]);

  const toggleSkill = (skill: string) => {
    setForm((prev) => {
      const selected = prev.requiredSkills.includes(skill);
      return {
        ...prev,
        requiredSkills: selected
          ? prev.requiredSkills.filter((item) => item !== skill)
          : [...prev.requiredSkills, skill]
      };
    });
  };

  const onCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setSubmitting(true);
    setError("");

    try {
      const payload: CreateJobInput = {
        ...form,
        category: form.category,
        duration: form.duration,
        requiredSkills: form.requiredSkills,
        city: form.locationType === "remote" ? null : form.city?.trim() || null,
        searchKeywords: [form.title, form.category, ...form.requiredSkills]
      };

      const { jobId } = await createJob({
        employerId: profile.uid,
        employerName: profile.name,
        input: payload
      });

      setForm(DEFAULT_FORM);
      router.push(`/employer/jobs/${jobId}`);
    } catch (e) {
      const message = toAuthErrorMessage(e);
      if (/insufficient jp points/i.test(message)) {
        setError("Insufficient JP Points. Choose a lower reward or add points on Pricing.");
      } else {
        setError(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncTabWithUrl = () => {
      const current = new URLSearchParams(window.location.search).get("tab");
      const resolvedTab = tabFromQuery(current);
      // Wait for profile to load to check validity, otherwise just set it. We handle invalid states in render.
      setTab(resolvedTab);
    };

    syncTabWithUrl();
    window.addEventListener("popstate", syncTabWithUrl);

    return () => window.removeEventListener("popstate", syncTabWithUrl);
  }, []);

  useEffect(() => {
    if (!hasFirebaseConfig()) {
      setAuthReady(true);
      return;
    }

    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAuthReady(true);
        setProfile(null);
        setJobs([]);
        setLeaderboard([]);
        setApplications([]);
        setNotifications([]);
        setFavorites([]);
        return;
      }

      try {
        const userProfile = await getUserProfile(user.uid);
        setProfile(userProfile);

        if (userProfile?.role === "worker") {
          setWorkspaceLoading(true);
          setBoardMode("global");
          await Promise.all([
            loadLeaderboard("global"),
            loadApplications(userProfile.uid),
            loadNotifications(userProfile.uid),
            loadFavorites(userProfile.uid)
          ]);
          setWorkspaceLoading(false);
        } else if (userProfile?.role === "employer") {
          setWorkspaceLoading(true);
          setBoardMode("global");
          await Promise.all([
            loadLeaderboard("global"),
            refreshEmployerJobs(userProfile.uid)
          ]);
          setWorkspaceLoading(false);
        }
      } catch (e) {
        setError(toAuthErrorMessage(e));
        setWorkspaceLoading(false);
      } finally {
        setAuthReady(true);
      }
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    // Fetch aggregated real data for trending topics on mount
    getTrendingTopics().then(setLiveTrendingTopics).catch(console.error);
  }, []);

  useEffect(() => {
    if (!authReady || profile?.role !== "worker") return;

    setJobsLoading(true);
    listJobs({ category: category || undefined, skill: skill || undefined, locationType: locationType || undefined })
      .then(setJobs)
      .catch((e) => setError(toAuthErrorMessage(e)))
      .finally(() => setJobsLoading(false));
  }, [authReady, profile?.role, category, skill, locationType]);

  return (
    <main className="min-h-screen">
      <Header />
      <Hero />
      <TrendRail items={liveTrendingTopics} />
      <CategoryRail categories={categories} />

      <section className="mx-auto max-w-[1200px] px-5 pb-16 pt-10 md:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">Live Marketplace</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight md:text-5xl">Live task marketplace</h2>
        <p className="mt-3 max-w-2xl text-sm text-white/68 md:text-base">
          Discover paid mini-internships, manage contracts, notifications, favorites, and rankings in one live
          marketplace flow.
        </p>

        {!authReady ? <p className="mt-6 text-sm text-white/70">Loading profile...</p> : null}

        {authReady && !profile ? (
          <div className="mt-6 flex gap-2">
            <Link href="/login">
              <Button>Log in</Button>
            </Link>
            <Link href="/register">
              <Button variant="outline">Sign up</Button>
            </Link>
          </div>
        ) : null}

        {profile?.role === "worker" ? (
          <div className="mt-8 space-y-6">
            <div className="flex flex-wrap gap-3">
              {workerTabs.map((t: Tab) => (
                <button
                  key={t}
                  onClick={() => pushTab(t)}
                  className={
                    tab === t
                      ? "rounded-full bg-white px-7 py-3 text-sm font-semibold text-black"
                      : "rounded-full bg-surface-1 px-7 py-3 text-sm font-semibold text-white/82 transition hover:bg-surface-2 hover:text-white"
                  }
                >
                  {t}
                </button>
              ))}
            </div>

            {workspaceLoading ? (
              <article className="rounded-3xl bg-surface-1/90 p-6 text-sm text-white/70 shadow-glow">
                Syncing your worker workspace...
              </article>
            ) : null}

            {tab === "Projects" ? (
              <div className="space-y-6">
                <div className="grid gap-3 md:grid-cols-3">
                  <input
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Category"
                    className="rounded-2xl bg-surface-1 px-4 py-3 text-sm text-white placeholder:text-white/45 focus:outline-none focus:ring-2 focus:ring-white/35"
                  />
                  <input
                    value={skill}
                    onChange={(e) => setSkill(e.target.value)}
                    placeholder="Skill"
                    className="rounded-2xl bg-surface-1 px-4 py-3 text-sm text-white placeholder:text-white/45 focus:outline-none focus:ring-2 focus:ring-white/35"
                  />
                  <select
                    value={locationType}
                    onChange={(e) => setLocationType(e.target.value as "" | LocationType)}
                    className="rounded-2xl bg-surface-1 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/35"
                  >
                    <option value="">Any location</option>
                    <option value="remote">remote</option>
                    <option value="onsite">onsite</option>
                    <option value="hybrid">hybrid</option>
                  </select>
                </div>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
                  <div className="space-y-4">
                    {jobsLoading ? (
                      <article className="rounded-3xl bg-surface-1/90 p-6 text-sm text-white/70 shadow-glow">
                        Loading tasks...
                      </article>
                    ) : null}

                    {!jobsLoading && jobs.length === 0 ? (
                      <article className="rounded-3xl bg-surface-1/90 p-6 text-sm text-white/70 shadow-glow">
                        No tasks found. Adjust filters and try again.
                      </article>
                    ) : null}

                    {!jobsLoading
                      ? jobs.map((job) => (
                        <JobCard
                          key={job.id}
                          job={job}
                          isFavorite={favoriteEmployerIds.has(job.employerId)}
                        />
                      ))
                      : null}
                  </div>

                  <aside className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                    {banners.map((banner) => (
                      <PromoCard key={banner.id} banner={banner} />
                    ))}

                    <article className="rounded-3xl bg-surface-1/90 p-6 shadow-glow">
                      <p className="text-xs font-semibold uppercase tracking-wide text-white/55">Worker Snapshot</p>
                      <div className="mt-4 space-y-3">
                        <div className="flex items-center justify-between rounded-2xl bg-white/5 px-3 py-2">
                          <span className="text-sm text-white/60">Balance</span>
                          <span className="text-sm font-semibold text-white">{profile.jobPreppedBalance} JP</span>
                        </div>
                        <div className="flex items-center justify-between rounded-2xl bg-white/5 px-3 py-2">
                          <span className="text-sm text-white/60">Notifications</span>
                          <span className="text-sm font-semibold text-white">{unreadNotifications}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-2xl bg-white/5 px-3 py-2">
                          <span className="text-sm text-white/60">My applications</span>
                          <span className="text-sm font-semibold text-white">{applications.length}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-2xl bg-white/5 px-3 py-2">
                          <span className="text-sm text-white/60">Leaderboard rank</span>
                          <span className="text-sm font-semibold text-white">{myRank ?? "-"}</span>
                        </div>
                      </div>
                    </article>
                  </aside>
                </div>
              </div>
            ) : null}

            {tab === "Applications" ? (
              <div className="space-y-4">
                <article className="rounded-3xl bg-surface-1/90 p-5 shadow-glow">
                  <p className="text-sm text-white/70">
                    Total: <span className="font-semibold text-white">{applications.length}</span> | Awaiting
                    delivery: <span className="font-semibold text-white">{applicationsInProgress}</span> | Completed:{" "}
                    <span className="font-semibold text-white">{completedApplications}</span>
                  </p>
                </article>

                {applications.length === 0 ? (
                  <article className="rounded-3xl bg-surface-1/90 p-6 text-sm text-white/70 shadow-glow">
                    No applications yet.
                  </article>
                ) : (
                  applications.map((application) => {
                    const badge = statusMeta[application.contractStatus];
                    return (
                      <article
                        key={application.id}
                        className="flex flex-col items-start justify-between gap-4 rounded-3xl bg-surface-1/90 p-6 shadow-glow md:flex-row md:items-center"
                      >
                        <div className="min-w-0">
                          <h3 className="text-xl font-black tracking-tight text-white md:text-2xl">
                            {application.jobTitle}
                          </h3>
                          <p className="mt-1 text-sm text-white/60">{application.employerName}</p>
                          <p className="mt-1 text-xs text-white/45">Applied: {formatTimestamp(application.createdAt)}</p>
                          <p className="mt-3 text-sm leading-relaxed text-white/75">
                            {toProposalSnippet(application.message)}
                          </p>
                        </div>

                        <div className="flex shrink-0 flex-col items-start gap-3 md:items-end">
                          <span className={`rounded-full px-4 py-1 text-sm font-bold tracking-wide ${badge.className}`}>
                            {badge.label}
                          </span>
                          <Link href={`/chat/${application.id}`}>
                            <Button className="px-6 py-3">Open Workspace</Button>
                          </Link>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            ) : null}

            {tab === "Notifications" ? (
              <div className="space-y-4">
                <article className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-surface-1/90 p-5 shadow-glow">
                  <p className="text-sm text-white/70">
                    Unread notifications: <span className="font-semibold text-white">{unreadNotifications}</span>
                  </p>
                  <Button onClick={onMarkAllNotificationsRead} disabled={markingAll || unreadNotifications === 0}>
                    {markingAll ? "Marking..." : "Mark all read"}
                  </Button>
                </article>

                {notifications.length === 0 ? (
                  <article className="rounded-3xl bg-surface-1/90 p-6 text-sm text-white/70 shadow-glow">
                    No notifications yet.
                  </article>
                ) : (
                  notifications.map((item) => (
                    <article
                      key={item.id}
                      className={`rounded-3xl p-5 shadow-glow ${item.read ? "bg-surface-1/85" : "bg-sky-300/10 ring-1 ring-sky-300/35"
                        }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold">{item.title}</p>
                          <p className="mt-1 text-xs text-white/60">
                            Employer: {item.employerId} | Job: {item.jobId}
                          </p>
                        </div>

                        {!item.read ? (
                          <Button
                            variant="outline"
                            onClick={() => onMarkNotificationRead(item.id)}
                            disabled={busyNotifId === item.id}
                          >
                            {busyNotifId === item.id ? "Marking..." : "Mark read"}
                          </Button>
                        ) : (
                          <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">Read</span>
                        )}
                      </div>

                      <div className="mt-4">
                        <Link href={`/worker/jobs/${item.jobId}`}>
                          <Button className="px-5 py-2">Open job</Button>
                        </Link>
                      </div>
                    </article>
                  ))
                )}
              </div>
            ) : null}

            {tab === "Favorites" ? (
              <div className="space-y-4">
                <article className="rounded-3xl bg-surface-1/90 p-5 shadow-glow">
                  <p className="text-sm text-white/70">
                    Following <span className="font-semibold text-white">{favorites.length}</span> employers
                  </p>
                </article>

                {favorites.length === 0 ? (
                  <article className="rounded-3xl bg-surface-1/90 p-6 text-sm text-white/70 shadow-glow">
                    No favorite employers yet. Open a job and favorite its employer.
                  </article>
                ) : (
                  favorites.map((item) => (
                    <article
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-surface-1/90 p-5 shadow-glow"
                    >
                      <div>
                        <p className="text-base font-semibold text-white">{item.employerName || item.employerId}</p>
                        <p className="mt-1 text-xs text-white/60">Employer ID: {item.employerId}</p>
                      </div>

                      <Button
                        variant="outline"
                        onClick={() => onUnfavoriteEmployer(item.employerId)}
                        disabled={busyEmployerId === item.employerId}
                      >
                        {busyEmployerId === item.employerId ? "Removing..." : "Unfollow"}
                      </Button>
                    </article>
                  ))
                )}
              </div>
            ) : null}

            {tab === "Leaderboard" ? (
              <div className="space-y-3">
                <article className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-surface-1/90 p-5 shadow-glow">
                  <p className="text-sm text-white/70">
                    Your rank: <span className="font-semibold text-white">{myRank ?? "-"}</span> | Balance:{" "}
                    <span className="font-semibold text-white">{profile.jobPreppedBalance} JP</span>
                  </p>
                  <div className="flex gap-2">
                    <Button variant={boardMode === "global" ? "primary" : "ghost"} onClick={() => onSwitchBoardMode("global")}>Global</Button>
                    <Button variant={boardMode === "weekly" ? "primary" : "ghost"} onClick={() => onSwitchBoardMode("weekly")}>Weekly</Button>
                  </div>
                </article>

                {leaderboard.map((worker, i) => (
                  <article
                    key={worker.uid}
                    className={`grid grid-cols-[56px_1fr_auto] items-center gap-4 rounded-3xl p-5 ${worker.uid === profile.uid ? "bg-neon-cyan/15 ring-1 ring-neon-cyan/45" : "bg-surface-1/85"
                      }`}
                  >
                    <p className="text-lg font-bold text-white/85">#{i + 1}</p>
                    <div>
                      <Link href={`/profile?id=${worker.uid}`} className="text-base font-semibold hover:underline decoration-white/50 underline-offset-4">{worker.displayName}</Link>
                      <p className="text-xs text-white/65 mt-1">
                        Streak: {worker.currentStreakDays}d | Completed: {worker.completedJobsCount} | Rating:{" "}
                        {worker.rating.toFixed(2)}
                      </p>
                    </div>
                    <p className="text-sm text-white/75">{worker.jobPreppedBalance} JP</p>
                  </article>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {profile?.role === "employer" ? (
          <div className="mt-8 space-y-6">
            <div className="flex flex-wrap gap-3">
              {employerTabs.map((t: Tab) => (
                <button
                  key={t}
                  onClick={() => pushTab(t)}
                  className={
                    tab === t
                      ? "rounded-full bg-white px-7 py-3 text-sm font-semibold text-black"
                      : "rounded-full bg-surface-1 px-7 py-3 text-sm font-semibold text-white/82 transition hover:bg-surface-2 hover:text-white"
                  }
                >
                  {t}
                </button>
              ))}
            </div>

            {workspaceLoading ? (
              <article className="rounded-3xl bg-surface-1/90 p-6 text-sm text-white/70 shadow-glow">
                Syncing your employer workspace...
              </article>
            ) : null}

            {tab === "Dashboard" ? (
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    { label: "Total jobs", value: String(employerJobs.length) },
                    { label: "Open jobs", value: String(employerJobs.filter((job) => job.status === "open").length) },
                    { label: "In review", value: String(employerJobs.filter((job) => job.status === "in_review").length) },
                    { label: "Applicants", value: String(employerJobs.reduce((acc, item) => acc + item.applicantsCount, 0)) }
                  ].map((item) => (
                    <article key={item.label} className="rounded-3xl bg-surface-1/90 p-6 shadow-glow transition hover:bg-surface-2/90">
                      <p className="text-xs uppercase tracking-wide text-white/55">{item.label}</p>
                      <p className="mt-3 text-4xl font-black tracking-tight">{item.value}</p>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}

            {tab === "My Jobs" ? (
              <section className="flex flex-col gap-4 rounded-3xl bg-surface-1/90 p-8 shadow-glow">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-black tracking-tight">Active & Closed Jobs</h2>
                    <p className="mt-1 text-sm text-white/60">Open each job to review applicants and update statuses.</p>
                  </div>
                  <span className="rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-white/75">{employerJobs.length} total</span>
                </div>

                <div className="flex flex-col gap-4 mt-2">
                  {employerJobs.length === 0 ? (
                    <p className="rounded-2xl bg-[#2A2A2A] p-6 text-sm text-white/65">No jobs yet.</p>
                  ) : null}

                  {employerJobs.map((job) => (
                    <article key={job.id} className="rounded-2xl bg-[#2A2A2A] p-6 transition hover:bg-[#303030]">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-lg font-extrabold leading-tight md:text-xl">{job.title}</h3>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white/70">
                              {job.category}
                            </span>
                            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white/70">
                              {job.level}
                            </span>
                            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white/70">
                              {job.applicantsCount} applicants
                            </span>
                          </div>
                          <p className="mt-3 text-xs text-white/45">Posted {formatTimestamp(job.createdAt)}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${job.status === "open" ? "bg-emerald-300/20 text-emerald-200" : job.status === "in_review" ? "bg-amber-300/20 text-amber-200" : "bg-white/10 text-white/75"}`}>
                          {job.status.replaceAll("_", " ")}
                        </span>
                      </div>

                      <div className="mt-5 flex justify-end">
                        <Link href={`/employer/jobs/${job.id}`}>
                          <button className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-black transition hover:bg-gray-200">
                            Manage job
                          </button>
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {tab === "Create Job" ? (
              <section className="flex flex-col gap-6 rounded-3xl bg-surface-1/90 p-8 shadow-glow">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-black tracking-tight md:text-3xl">Create Job</h2>
                    <p className="mt-2 text-sm text-white/60 md:text-base">
                      Fill out the essentials and publish a structured role with clean category, level, and skills data.
                    </p>
                  </div>
                  <SeedMarketplaceDataButton />
                </div>

                <form className="flex flex-col gap-6" onSubmit={onCreateJob}>
                  <label className="block">
                    <span className="mb-1 block text-xs text-white/70">Title *</span>
                    <input
                      value={form.title}
                      onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                      className="w-full rounded-2xl border border-white/5 bg-[#1F1F1F] p-4 text-white placeholder:text-gray-500 outline-none focus:outline-none focus:ring-2 focus:ring-white/20"
                      placeholder="Senior Product Designer for mobile growth"
                      required
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs text-white/70">Description *</span>
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                      className="min-h-32 w-full resize-none rounded-2xl border border-white/5 bg-[#1F1F1F] p-4 text-white placeholder:text-gray-500 outline-none focus:outline-none focus:ring-2 focus:ring-white/20"
                      placeholder="Describe deliverables, expected communication style, and review checkpoints."
                      required
                    />
                  </label>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-xs text-white/70">Category</span>
                      <select
                        value={form.category}
                        onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                        className="w-full cursor-pointer appearance-none rounded-2xl border border-white/5 bg-[#1F1F1F] p-4 text-white outline-none focus:outline-none focus:ring-2 focus:ring-white/20"
                      >
                        {CATEGORIES.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-xs text-white/70">Level</span>
                      <select
                        value={VALUE_TO_LEVEL[form.level]}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            level: LEVEL_TO_VALUE[e.target.value as (typeof LEVELS)[number]]
                          }))
                        }
                        className="w-full cursor-pointer appearance-none rounded-2xl border border-white/5 bg-[#1F1F1F] p-4 text-white outline-none focus:outline-none focus:ring-2 focus:ring-white/20"
                      >
                        {LEVELS.map((level) => (
                          <option key={level} value={level}>
                            {level}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-xs text-white/70">Duration</span>
                      <select
                        value={form.duration}
                        onChange={(e) => setForm((prev) => ({ ...prev, duration: e.target.value }))}
                        className="w-full cursor-pointer appearance-none rounded-2xl border border-white/5 bg-[#1F1F1F] p-4 text-white outline-none focus:outline-none focus:ring-2 focus:ring-white/20"
                      >
                        {DURATIONS.map((duration) => (
                          <option key={duration} value={duration}>
                            {duration}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-xs text-white/70">Location</span>
                      <select
                        value={VALUE_TO_LOCATION[form.locationType]}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            locationType: LOCATION_TO_VALUE[e.target.value as (typeof LOCATIONS)[number]]
                          }))
                        }
                        className="w-full cursor-pointer appearance-none rounded-2xl border border-white/5 bg-[#1F1F1F] p-4 text-white outline-none focus:outline-none focus:ring-2 focus:ring-white/20"
                      >
                        {LOCATIONS.map((location) => (
                          <option key={location} value={location}>
                            {location}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="block">
                    <span className="mb-1 block text-xs text-white/70">City</span>
                    <input
                      value={form.city || ""}
                      onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
                      className="w-full rounded-2xl border border-white/5 bg-[#1F1F1F] p-4 text-white placeholder:text-gray-500 outline-none focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-50"
                      placeholder="Optional for remote jobs"
                      disabled={form.locationType === "remote"}
                    />
                  </label>

                  <div className="flex flex-col gap-3">
                    <p className="text-xs text-white/70">Required skills *</p>
                    <div className="flex flex-wrap gap-3">
                      {POPULAR_SKILLS.map((skill) => {
                        const selected = form.requiredSkills.includes(skill);
                        return (
                          <button
                            key={skill}
                            type="button"
                            onClick={() => toggleSkill(skill)}
                            className={
                              selected
                                ? "rounded-full bg-white px-4 py-2 text-sm font-bold text-black transition"
                                : "cursor-pointer rounded-full bg-[#1F1F1F] ring-1 ring-white/10 px-4 py-2 text-sm text-gray-400 transition hover:bg-white/10"
                            }
                          >
                            {skill}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <label className="block">
                    <span className="mb-1 block text-xs text-white/70">Reward JP *</span>
                    <input
                      type="number"
                      min={1}
                      value={form.rewardJP || ""}
                      onChange={(e) => setForm((prev) => ({ ...prev, rewardJP: Number(e.target.value) || 0 }))}
                      className="w-full rounded-2xl border border-white/5 bg-[#1F1F1F] p-5 text-2xl font-bold text-white placeholder:text-gray-500 outline-none focus:outline-none focus:ring-2 focus:ring-white/20"
                      placeholder="JP Points"
                      required
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs text-white/70">Deadline</span>
                    <input
                      type="datetime-local"
                      onChange={(e) => {
                        const value = e.target.value;
                        setForm((prev) => ({ ...prev, deadlineAt: value ? new Date(value) : null }));
                      }}
                      className="w-full rounded-2xl border border-white/5 bg-[#1F1F1F] p-4 text-white outline-none focus:outline-none focus:ring-2 focus:ring-white/20"
                    />
                  </label>

                  {error ? (
                    <div className="rounded-2xl bg-rose-500/10 p-5 text-sm text-rose-200">
                      <p>{error}</p>
                      {error.includes("Insufficient JP Points") ? (
                        <div className="mt-4">
                          <Link
                            href="/pricing"
                            className="inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-bold text-black transition hover:bg-gray-200"
                          >
                            Get Points
                          </Link>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div>
                    <button
                      type="submit"
                      disabled={submitting || !requiredFilled}
                      className="mt-4 flex w-full items-center justify-center gap-3 rounded-full bg-white px-10 py-4 text-base font-bold text-black transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
                    >
                      {submitting ? (
                        <span className="h-5 w-5 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                      ) : null}
                      {submitting ? "Creating..." : "Create Job"}
                    </button>
                  </div>
                </form>
              </section>
            ) : null}

            {tab === "Leaderboard" ? (
              <div className="space-y-3">
                <article className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-surface-1/90 p-5 shadow-glow">
                  <p className="text-sm text-white/70">
                    Leaderboard access: <span className="font-semibold text-white">Guest view</span> | Balance:{" "}
                    <span className="font-semibold text-white">{profile.jobPreppedBalance} JP</span>
                  </p>
                  <div className="flex gap-2">
                    <Button variant={boardMode === "global" ? "primary" : "ghost"} onClick={() => onSwitchBoardMode("global")}>Global</Button>
                    <Button variant={boardMode === "weekly" ? "primary" : "ghost"} onClick={() => onSwitchBoardMode("weekly")}>Weekly</Button>
                  </div>
                </article>

                {leaderboard.map((worker, i) => (
                  <article
                    key={worker.uid}
                    className="grid grid-cols-[56px_1fr_auto] items-center gap-4 rounded-3xl bg-surface-1/85 p-5"
                  >
                    <p className="text-lg font-bold text-white/85">#{i + 1}</p>
                    <div>
                      <Link href={`/profile?id=${worker.uid}`} className="text-base font-semibold hover:underline decoration-white/50 underline-offset-4">{worker.displayName}</Link>
                      <p className="mt-1 text-xs text-white/65">
                        Streak: {worker.currentStreakDays}d | Completed: {worker.completedJobsCount} | Rating:{" "}
                        {worker.rating.toFixed(2)}
                      </p>
                    </div>
                    <p className="text-sm text-white/75">{worker.jobPreppedBalance} JP</p>
                  </article>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
      </section>

      <Footer />
    </main>
  );
}
