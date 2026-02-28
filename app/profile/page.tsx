"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { Github, PencilLine, Plus, ExternalLink, Mail, BadgeCheck } from "lucide-react";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from "recharts";
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where
} from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb, hasFirebaseConfig } from "@/lib/firebase";
import { getUserProfile } from "@/lib/auth";
import type { ApplicationDoc, PortfolioProject, UserDoc, UserSocials, JobDoc } from "@/lib/types";
import { Header } from "@/components/sections/header";
import { Footer } from "@/components/sections/footer";

// ============================================================================
// Types & Constants
// ============================================================================

const DEFAULT_PITCH =
  "A beginner frontend developer focused on React and smooth animations. I learn quickly, write clean code, and never hesitate to ask questions. Looking for my first commercial experience to apply my skills to real tasks.";

const PROJECT_PLACEHOLDERS = ["bg-blue-900/40", "bg-purple-900/40", "bg-cyan-900/40", "bg-emerald-900/40"];

type CompletedReview = {
  id: string;
  rating: number;
  review: string;
  employerId: string;
  employerName: string;
  completedAt: unknown;
};

type ProjectDraft = {
  title: string;
  role: string;
  description: string;
  stackCsv: string;
  liveUrl: string;
  codeUrl: string;
};

const EMPTY_PROJECT_DRAFT: ProjectDraft = {
  title: "",
  role: "",
  description: "",
  stackCsv: "",
  liveUrl: "",
  codeUrl: ""
};

// ============================================================================
// Helpers
// ============================================================================

function workerInitials(name: string) {
  const normalized = name.trim();
  if (!normalized) return "WP";
  const parts = normalized.split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "WP";
}

function StarSvg({ active = true }: { active?: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className={`h-5 w-5 ${active ? "text-yellow-400" : "text-yellow-400/30"}`}
      aria-hidden="true"
    >
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.176 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.719c-.783-.57-.38-1.81.588-1.81h3.462a1 1 0 00.95-.69l1.07-3.292z" />
    </svg>
  );
}

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `https://${trimmed}`;
}

function parseCommaSeparated(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

// ============================================================================
// Main Profile Content
// ============================================================================

// ============================================================================
// Employer Profile View Component
// ============================================================================

type EmployerReview = {
  id: string;
  rating: number;
  review: string;
  workerName: string;
  workerId: string;
  completedAt: unknown;
};

function EmployerProfileView({
  profileUser,
  isOwner,
}: {
  profileUser: UserDoc;
  isOwner: boolean;
}) {
  const [activeJobs, setActiveJobs] = useState<JobDoc[]>([]);
  const [workerReviews, setWorkerReviews] = useState<EmployerReview[]>([]);
  const [loading, setLoading] = useState(true);

  // Editable state
  const [isEditingAbout, setIsEditingAbout] = useState(false);
  const [editAbout, setEditAbout] = useState(profileUser.bio || "");
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [editCompanyName, setEditCompanyName] = useState(profileUser.companyName || "");
  const [editIndustry, setEditIndustry] = useState(profileUser.industry || "");
  const [editWebsite, setEditWebsite] = useState(profileUser.website || "");
  const [savingHeader, setSavingHeader] = useState(false);
  const [savingAbout, setSavingAbout] = useState(false);

  useEffect(() => {
    const uid = profileUser.uid;
    if (!uid || !hasFirebaseConfig()) { setLoading(false); return; }
    const db = getFirebaseDb();
    async function load() {
      try {
        // Active jobs
        const jobsSnap = await getDocs(
          query(collection(db, "jobs"), where("employerId", "==", uid), where("status", "==", "open"))
        );
        setActiveJobs(jobsSnap.docs.map(d => ({ id: d.id, ...d.data() } as JobDoc)));

        // Worker reviews (apps they left a rating on)
        const revSnap = await getDocs(
          query(collection(db, "applications"), where("employerId", "==", uid), where("status", "==", "completed"))
        );
        const loaded: EmployerReview[] = [];
        revSnap.forEach(d => {
          const data = d.data() as ApplicationDoc;
          if (data.employerRating && data.employerRating > 0) {
            loaded.push({
              id: d.id,
              rating: data.employerRating,
              review: data.review || "",
              workerName: data.workerName || "Worker",
              workerId: data.workerId,
              completedAt: data.completedAt,
            });
          }
        });
        setWorkerReviews(loaded);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [profileUser.uid]);

  const avgRating = workerReviews.length
    ? (workerReviews.reduce((a, r) => a + r.rating, 0) / workerReviews.length).toFixed(1)
    : null;

  const saveHeader = async () => {
    setSavingHeader(true);
    const db = getFirebaseDb();
    const { serverTimestamp } = await import("firebase/firestore");
    await updateDoc(doc(db, "users", profileUser.uid), {
      companyName: editCompanyName.trim(),
      industry: editIndustry.trim(),
      website: normalizeUrl(editWebsite),
      updatedAt: serverTimestamp(),
    });
    setSavingHeader(false);
    setIsEditingHeader(false);
  };

  const saveAbout = async () => {
    setSavingAbout(true);
    const db = getFirebaseDb();
    const { serverTimestamp } = await import("firebase/firestore");
    await updateDoc(doc(db, "users", profileUser.uid), {
      bio: editAbout.trim(),
      updatedAt: serverTimestamp(),
    });
    setSavingAbout(false);
    setIsEditingAbout(false);
  };

  const companyName = profileUser.companyName || profileUser.displayName || profileUser.name || "Company";
  const industry = profileUser.industry || "Tech";
  const coverGradients = [
    "from-blue-900 via-indigo-900 to-purple-950",
    "from-emerald-900 via-teal-900 to-cyan-950",
    "from-rose-900 via-pink-900 to-purple-950",
    "from-amber-900 via-orange-900 to-red-950",
  ];
  const gradient = coverGradients[(companyName.charCodeAt(0) || 0) % coverGradients.length];

  return (
    <div className="bg-[#0D0D0D] text-white min-h-screen px-5 pt-24 pb-20 md:px-8 font-sans">
      <div className="max-w-[1100px] mx-auto space-y-8">

        {/* COVER + LOGO HERO */}
        <div className="relative">
          {/* Cover */}
          <div className={`h-52 md:h-64 w-full rounded-3xl bg-gradient-to-r ${gradient} overflow-hidden`}>
            <div className="absolute inset-0 opacity-20 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLXdpZHRoPSIwLjUiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZykiLz48L3N2Zz4=')]" />
          </div>

          {/* Logo + Identity */}
          <div className="flex flex-col md:flex-row md:items-end gap-6 -mt-16 px-6 md:px-10">
            <div className="w-32 h-32 rounded-2xl bg-[#1A1A1A] flex-shrink-0 flex items-center justify-center text-4xl font-black shadow-2xl" style={{ border: '4px solid #0D0D0D' }}>
              {(companyName[0] || "C").toUpperCase()}
            </div>

            <div className="flex flex-col gap-3 pb-2 flex-1">
              {isEditingHeader ? (
                <div className="flex flex-col gap-3 bg-[#1A1A1A] p-6 rounded-3xl">
                  <input className="bg-[#2A2A2A] rounded-2xl px-5 py-3 text-white outline-none text-xl font-bold" value={editCompanyName} onChange={e => setEditCompanyName(e.target.value)} placeholder="Company Name" />
                  <input className="bg-[#2A2A2A] rounded-2xl px-5 py-3 text-white outline-none" value={editIndustry} onChange={e => setEditIndustry(e.target.value)} placeholder="Industry (e.g. SaaS, FinTech)" />
                  <input className="bg-[#2A2A2A] rounded-2xl px-5 py-3 text-white outline-none" value={editWebsite} onChange={e => setEditWebsite(e.target.value)} placeholder="https://yourcompany.com" />
                  <div className="flex gap-3 mt-2">
                    <button onClick={saveHeader} disabled={savingHeader} className="bg-white text-black font-black px-6 py-3 rounded-full text-sm">{savingHeader ? "Saving..." : "Save"}</button>
                    <button onClick={() => setIsEditingHeader(false)} className="bg-[#2A2A2A] text-white font-bold px-6 py-3 rounded-full text-sm">Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white">{companyName}</h1>
                    <span className="flex items-center gap-1.5 bg-blue-500/10 text-blue-400 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider">
                      <BadgeCheck className="w-3.5 h-3.5" /> Verified Employer
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="bg-[#2A2A2A] text-gray-300 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider">{industry}</span>
                    {profileUser.website && (
                      <a href={normalizeUrl(profileUser.website)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 bg-[#2A2A2A] hover:bg-white hover:text-black transition-colors text-gray-300 px-4 py-1 rounded-full text-xs font-bold">
                        <ExternalLink className="w-3 h-3" /> Website
                      </a>
                    )}
                  </div>
                  {isOwner && (
                    <button onClick={() => setIsEditingHeader(true)} className="self-start mt-1 flex items-center gap-2 bg-[#2A2A2A] hover:bg-[#333] px-5 py-2.5 rounded-full text-sm font-bold transition">
                      <PencilLine className="w-4 h-4" /> Edit Profile
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* QUICK STATS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "JP Rewarded", value: profileUser.totalJPAwarded || 0, gold: true },
            { label: "Interns Hired", value: profileUser.hiredCount || 0, gold: false },
            { label: "Active Jobs", value: loading ? "—" : activeJobs.length, gold: false },
            { label: "Employer Rating", value: avgRating ? `${avgRating} ⭐` : "New", gold: false },
          ].map(({ label, value, gold }) => (
            <div key={label} className="bg-[#1A1A1A] rounded-3xl p-6 md:p-8 flex flex-col gap-2">
              <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">{label}</p>
              {gold ? (
                <p className="text-4xl md:text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-orange-500">{value}</p>
              ) : (
                <p className="text-4xl md:text-5xl font-black text-white">{value}</p>
              )}
            </div>
          ))}
        </div>

        {/* ABOUT THE COMPANY */}
        <div className="bg-[#1A1A1A] rounded-3xl p-8 md:p-10">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-black">About the Company</h2>
            {isOwner && (
              <button
                onClick={() => isEditingAbout ? saveAbout() : setIsEditingAbout(true)}
                disabled={savingAbout}
                className="bg-[#2A2A2A] hover:bg-white hover:text-black transition-colors px-5 py-2.5 rounded-full text-sm font-bold"
              >
                {savingAbout ? "Saving..." : isEditingAbout ? "Save" : "Edit"}
              </button>
            )}
          </div>
          {isEditingAbout ? (
            <textarea
              className="w-full bg-[#2A2A2A] rounded-2xl p-6 text-lg text-white outline-none resize-none min-h-[160px]"
              value={editAbout}
              onChange={e => setEditAbout(e.target.value)}
              placeholder="Tell workers what your company is about, your mission, and what you're building..."
            />
          ) : (
            <p className="text-gray-300 text-lg leading-relaxed">
              {profileUser.bio || "No company description yet."}
            </p>
          )}
        </div>

        {/* OPEN MINI-INTERNSHIPS */}
        <div>
          <h2 className="text-4xl font-black mb-6">Open Mini-Internships</h2>
          {loading ? (
            <div className="animate-pulse bg-[#1A1A1A] rounded-3xl h-28" />
          ) : activeJobs.length > 0 ? (
            <div className="flex flex-col gap-4">
              {activeJobs.map(job => (
                <Link
                  key={job.id}
                  href={`/marketplace?jobId=${job.id}`}
                  className="bg-[#1A1A1A] p-8 rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center hover:scale-[1.01] transition-transform cursor-pointer group gap-4"
                >
                  <div>
                    <h3 className="text-2xl font-bold text-white">{job.title}</h3>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className="bg-[#2A2A2A] text-gray-400 px-3 py-1 rounded-full text-xs font-bold uppercase">{job.category}</span>
                      <span className="text-gray-500 text-xs">{job.duration}</span>
                    </div>
                  </div>
                  <div className="bg-[#2A2A2A] group-hover:bg-white group-hover:text-black transition-colors px-6 py-3 rounded-full font-bold text-sm whitespace-nowrap">
                    Reward: {job.rewardJP} JP
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="bg-[#1A1A1A] rounded-3xl p-10 text-center text-gray-500">No open positions right now.</div>
          )}
        </div>

        {/* WORKER FEEDBACK */}
        {workerReviews.length > 0 && (
          <div>
            <h2 className="text-4xl font-black mb-6">Worker Feedback</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {workerReviews.map(r => (
                <div key={r.id} className="bg-[#1A1A1A] p-8 rounded-3xl flex flex-col gap-4">
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, i) => <StarSvg key={i} active={i < Math.round(r.rating)} />)}
                  </div>
                  {r.review && <p className="text-gray-300 italic leading-relaxed">"{r.review}"</p>}
                  <p className="text-gray-600 text-xs font-black uppercase tracking-widest">{r.workerName}</p>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ============================================================================
// Main Profile Content
// ============================================================================

function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryId = searchParams.get("id");

  const [authReady, setAuthReady] = useState(false);
  const [authUser, setAuthUser] = useState<UserDoc | null>(null);

  const [profileUser, setProfileUser] = useState<UserDoc | null>(null);
  const [reviews, setReviews] = useState<CompletedReview[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const profileId = queryId || authUser?.uid;
  const isOwner = !!authUser && !!profileId && authUser.uid === profileId;

  // Edit Header State
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editGithub, setEditGithub] = useState("");

  // Edit Skills State
  const [isEditingSkills, setIsEditingSkills] = useState(false);
  const [editSkillsCsv, setEditSkillsCsv] = useState("");

  // Edit Portfolio Project State
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [projectDraft, setProjectDraft] = useState<ProjectDraft>(EMPTY_PROJECT_DRAFT);

  // 1. Auth Listener
  useEffect(() => {
    if (!hasFirebaseConfig()) {
      setAuthReady(true);
      return;
    }
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const udoc = await getUserProfile(user.uid);
        setAuthUser(udoc);
      } else {
        setAuthUser(null);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // 2. Fetch Profile User and Reviews
  useEffect(() => {
    if (!authReady) return;
    if (!profileId) {
      setLoadingProfile(false);
      return;
    }

    const loadData = async () => {
      setLoadingProfile(true);
      try {
        const db = getFirebaseDb();

        // Fetch User
        if (authUser?.uid === profileId) {
          setProfileUser(authUser);
        } else {
          const docSnap = await getDoc(doc(db, "users", profileId));
          if (docSnap.exists()) {
            setProfileUser(docSnap.data() as UserDoc);
          } else {
            setProfileUser(null);
          }
        }

        // Fetch Completed Applications (Reviews)
        const qStr = query(collection(db, "applications"), where("workerId", "==", profileId), where("status", "==", "completed"));
        const snap = await getDocs(qStr);
        const loadedReviews: CompletedReview[] = [];
        snap.forEach((dSnap) => {
          const data = dSnap.data() as ApplicationDoc;
          if (data.rating && data.rating > 0) {
            loadedReviews.push({
              id: dSnap.id,
              rating: data.rating,
              review: data.review || "Great job.",
              employerId: data.employerId,
              employerName: data.employerName || "Employer",
              completedAt: data.completedAt
            });
          }
        });

        // Sort by dates down locally
        loadedReviews.sort((a, b) => {
          // Basic sort assuming completedAt is a firebase timestamp or we can fallback
          return 0;
        });

        setReviews(loadedReviews);
      } catch (err) {
        console.error("Error loading profile data", err);
      } finally {
        setLoadingProfile(false);
      }
    };
    loadData();
  }, [profileId, authReady, authUser]);

  // Derive radar data safely
  const radarData = useMemo(() => {
    const hardSkillsLen = profileUser?.hardSkills?.length || 1;
    let avgRating = 0;
    if (reviews.length > 0) {
      avgRating = reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length;
    } else if (profileUser?.rating) {
      avgRating = profileUser.rating;
    }

    // Radar expects 0-100 logic or arbitrary scale. Let's do 0-100.
    const speed = avgRating ? Math.min(100, avgRating * 20) : 60;
    const reliability = avgRating ? Math.min(100, avgRating * 20) : 50;
    const quality = avgRating ? Math.min(100, avgRating * 20 + 5) : 65;
    const adaptability = Math.min(100, 40 + hardSkillsLen * 10);
    const techScale = Math.min(100, 30 + hardSkillsLen * 15);

    return [
      { subject: "Speed", A: speed },
      { subject: "Reliability", A: reliability },
      { subject: "Tech Skill", A: techScale },
      { subject: "Adaptability", A: adaptability },
      { subject: "Quality", A: quality },
    ];
  }, [profileUser?.hardSkills, profileUser?.rating, reviews]);

  const handleSaveHeader = async () => {
    if (!isOwner || !profileUser) return;
    const db = getFirebaseDb();

    const newTitle = editTitle.trim();
    const newBio = editBio.trim();
    const newGithub = editGithub.trim();

    const nextSocials = { ...(profileUser.socials || {}), github: newGithub, telegram: profileUser.socials?.telegram || "" } as UserSocials;

    await updateDoc(doc(db, "users", profileUser.uid), {
      title: newTitle,
      bio: newBio,
      socials: nextSocials
    });

    setProfileUser((prev) => prev ? { ...prev, title: newTitle, bio: newBio, socials: nextSocials } : null);
    setIsEditingHeader(false);
  };

  const handleSaveSkills = async () => {
    if (!isOwner || !profileUser) return;
    const db = getFirebaseDb();
    const newSkills = parseCommaSeparated(editSkillsCsv);

    await updateDoc(doc(db, "users", profileUser.uid), {
      hardSkills: newSkills
    });

    setProfileUser((prev) => prev ? { ...prev, hardSkills: newSkills } : null);
    setIsEditingSkills(false);
  };

  const handleSaveProject = async () => {
    if (!isOwner || !profileUser) return;
    const db = getFirebaseDb();
    const stack = parseCommaSeparated(projectDraft.stackCsv);
    const newProject: PortfolioProject = {
      id: createId(),
      title: projectDraft.title.trim(),
      role: projectDraft.role.trim(),
      description: projectDraft.description.trim(),
      liveUrl: normalizeUrl(projectDraft.liveUrl),
      codeUrl: normalizeUrl(projectDraft.codeUrl),
      stack,
    };

    await updateDoc(doc(db, "users", profileUser.uid), {
      portfolioProjects: arrayUnion(newProject)
    });

    setProfileUser((prev) => prev ? { ...prev, portfolioProjects: [...(prev.portfolioProjects || []), newProject] } : null);
    setIsAddingProject(false);
    setProjectDraft(EMPTY_PROJECT_DRAFT);
  };


  if (!authReady || loadingProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0D0D0D]">
        <div className="text-white/50 text-sm font-semibold animate-pulse">Loading profile...</div>
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0D0D0D]">
        <div className="text-white/50 text-sm font-semibold">Profile not found.</div>
      </div>
    );
  }

  // ── Employer role branch ──
  if (profileUser.role === "employer") {
    return (
      <>
        <EmployerProfileView profileUser={profileUser} isOwner={isOwner} />
      </>
    );
  }

  return (
    <div className="bg-[#0D0D0D] text-white selection:bg-white/30 px-5 pt-24 pb-16 md:px-8 font-sans">
      <div className="max-w-[1200px] mx-auto space-y-10">

        {/* HEADER CARD */}
        <div className="bg-[#1A1A1A] rounded-[2.5rem] p-10 md:p-14 relative overflow-hidden flex flex-col md:flex-row gap-10 items-start shadow-2xl">
          {/* Avatar Area */}
          <div className="w-32 h-32 md:w-44 md:h-44 rounded-full bg-surface-2 flex-shrink-0 flex items-center justify-center text-4xl md:text-5xl font-black bg-gradient-to-br from-zinc-800 to-black ring-4 ring-white/5 shadow-2xl">
            {workerInitials(profileUser.displayName || profileUser.name)}
          </div>

          {/* Info Area */}
          <div className="flex-1 w-full relative">
            {isOwner && (
              <button
                onClick={() => {
                  if (isEditingHeader) handleSaveHeader();
                  else {
                    setEditTitle(profileUser.title || "");
                    setEditBio(profileUser.bio || "");
                    setEditGithub(profileUser.socials?.github || "");
                    setIsEditingHeader(true);
                  }
                }}
                className="absolute top-0 right-0 bg-[#2A2A2A] hover:bg-[#3A3A3A] px-5 py-2.5 rounded-full text-sm font-bold transition flex items-center gap-2 shadow-lg"
              >
                {isEditingHeader ? "Save Changes" : <><PencilLine className="w-4 h-4" /> Edit Profile</>}
              </button>
            )}

            <h1 className="text-4xl md:text-6xl font-black tracking-tight">{profileUser.displayName || profileUser.name}</h1>

            {isEditingHeader ? (
              <div className="mt-8 space-y-4 max-w-2xl bg-[#0D0D0D] p-6 rounded-3xl border border-white/5">
                <input
                  className="w-full bg-[#1A1A1A] rounded-2xl outline-none px-5 py-4 text-white placeholder-white/30 focus:ring-2 focus:ring-white/10 font-medium"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  placeholder="Professional Title (e.g. Creative Frontend Dev)"
                />
                <textarea
                  className="w-full bg-[#1A1A1A] rounded-2xl outline-none px-5 py-4 text-white placeholder-white/30 min-h-[120px] resize-none focus:ring-2 focus:ring-white/10 font-medium leading-relaxed"
                  value={editBio}
                  onChange={e => setEditBio(e.target.value)}
                  placeholder="Your compelling bio..."
                />
                <div className="flex relative items-center">
                  <Github className="w-5 h-5 absolute left-5 text-white/40" />
                  <input
                    className="w-full bg-[#1A1A1A] rounded-2xl outline-none pl-14 pr-5 py-4 text-white placeholder-white/30 focus:ring-2 focus:ring-white/10 font-medium"
                    value={editGithub}
                    onChange={e => setEditGithub(e.target.value)}
                    placeholder="https://github.com/..."
                  />
                </div>
              </div>
            ) : (
              <div className="mt-5 max-w-3xl">
                <h2 className="text-xl md:text-2xl font-bold text-white/80">{profileUser.title || "Independent Professional"}</h2>
                <p className="mt-5 text-base md:text-[1.15rem] text-white/60 leading-relaxed font-medium">
                  {profileUser.bio || DEFAULT_PITCH}
                </p>

                {profileUser.socials?.github && (
                  <a href={normalizeUrl(profileUser.socials.github)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 mt-8 bg-[#2A2A2A] hover:bg-white hover:text-black transition-colors px-6 py-3 rounded-full text-sm font-black shadow-lg">
                    <Github className="w-4 h-4" /> GitHub
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">

          {/* LEFT COLUMN: Skills + Radar */}
          <div className="space-y-10 lg:col-span-1">
            <div className="bg-[#1A1A1A] rounded-[2.5rem] p-10 shadow-2xl relative">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-black tracking-tight">Hard Skills</h3>
                {isOwner && (
                  <button
                    onClick={() => {
                      if (isEditingSkills) handleSaveSkills();
                      else {
                        setEditSkillsCsv(profileUser.hardSkills?.join(", ") || "");
                        setIsEditingSkills(true);
                      }
                    }}
                    className="bg-[#2A2A2A] hover:bg-white hover:text-black px-4 py-2 rounded-full text-sm font-bold transition flex items-center shadow-lg"
                  >
                    {isEditingSkills ? "Save" : "Edit"}
                  </button>
                )}
              </div>

              {isEditingSkills ? (
                <textarea
                  className="w-full bg-[#0D0D0D] rounded-3xl outline-none px-6 py-5 text-white font-medium focus:ring-2 focus:ring-white/10 resize-none min-h-[140px] shadow-inner"
                  placeholder="React, CSS, Framer Motion, Node..."
                  value={editSkillsCsv}
                  onChange={e => setEditSkillsCsv(e.target.value)}
                />
              ) : (
                <div className="flex flex-wrap gap-2.5">
                  {(profileUser.hardSkills?.length ? profileUser.hardSkills : ["Design", "React", "Firebase"]).map((skill, i) => (
                    <span key={i} className="bg-[#2A2A2A] px-5 py-2.5 rounded-full text-sm font-bold shadow-md tracking-wide">
                      {skill}
                    </span>
                  ))}
                </div>
              )}

              {/* RADAR CHART */}
              <div className="mt-10 h-[280px] w-full bg-[#0D0D0D] rounded-3xl flex items-center justify-center p-4 shadow-inner">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                    <PolarGrid stroke="#2A2A2A" strokeDasharray="3 3" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#808080', fontSize: 11, fontWeight: 700 }} />
                    <Radar
                      name="Skills"
                      dataKey="A"
                      stroke="#FFFFFF"
                      strokeWidth={2}
                      fill="#FFFFFF"
                      fillOpacity={0.08}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Portfolio & Reviews */}
          <div className="space-y-10 lg:col-span-2">

            {/* PORTFOLIO */}
            <div className="bg-[#1A1A1A] rounded-[2.5rem] p-10 shadow-2xl">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-10">
                <h3 className="text-3xl font-black tracking-tight">Portfolio</h3>
                {isOwner && !isAddingProject && (
                  <button onClick={() => setIsAddingProject(true)} className="bg-transparent text-white rounded-full px-6 py-3 text-sm font-bold flex items-center gap-2 transition border-[2px] border-dashed border-white/20 hover:border-white/50 hover:bg-white/5">
                    <Plus className="w-4 h-4" /> Add Project
                  </button>
                )}
              </div>

              {isAddingProject && (
                <div className="bg-[#0D0D0D] rounded-[2rem] p-8 mb-10 border border-[#2A2A2A] space-y-5 shadow-2xl">
                  <h4 className="text-xl font-black mb-2">New Project Draft</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <input className="w-full bg-[#1A1A1A] rounded-2xl outline-none px-5 py-4 text-white font-medium focus:ring-2 focus:ring-white/10" placeholder="Project Title" value={projectDraft.title} onChange={e => setProjectDraft(p => ({ ...p, title: e.target.value }))} />
                    <input className="w-full bg-[#1A1A1A] rounded-2xl outline-none px-5 py-4 text-white font-medium focus:ring-2 focus:ring-white/10" placeholder="Your Role (e.g. Lead Designer)" value={projectDraft.role} onChange={e => setProjectDraft(p => ({ ...p, role: e.target.value }))} />
                  </div>
                  <textarea className="w-full bg-[#1A1A1A] rounded-2xl outline-none px-5 py-4 text-white min-h-[120px] font-medium resize-none focus:ring-2 focus:ring-white/10 leading-relaxed" placeholder="Highlight what you built and the impact..." value={projectDraft.description} onChange={e => setProjectDraft(p => ({ ...p, description: e.target.value }))} />
                  <input className="w-full bg-[#1A1A1A] rounded-2xl outline-none px-5 py-4 text-white font-medium focus:ring-2 focus:ring-white/10" placeholder="Tech Stack (comma separated)" value={projectDraft.stackCsv} onChange={e => setProjectDraft(p => ({ ...p, stackCsv: e.target.value }))} />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <input className="w-full bg-[#1A1A1A] rounded-2xl outline-none px-5 py-4 text-white font-medium focus:ring-2 focus:ring-white/10" placeholder="https://live-preview.com" value={projectDraft.liveUrl} onChange={e => setProjectDraft(p => ({ ...p, liveUrl: e.target.value }))} />
                    <input className="w-full bg-[#1A1A1A] rounded-2xl outline-none px-5 py-4 text-white font-medium focus:ring-2 focus:ring-white/10" placeholder="https://github.com/..." value={projectDraft.codeUrl} onChange={e => setProjectDraft(p => ({ ...p, codeUrl: e.target.value }))} />
                  </div>
                  <div className="flex gap-4 justify-end mt-6 pt-4 border-t border-[#2A2A2A]">
                    <button onClick={() => { setIsAddingProject(false); setProjectDraft(EMPTY_PROJECT_DRAFT); }} className="px-6 py-3 rounded-full font-bold hover:bg-[#1A1A1A] text-white/70">Cancel</button>
                    <button onClick={handleSaveProject} disabled={!projectDraft.title} className="bg-white text-black px-8 py-3 rounded-full font-black disabled:opacity-50 shadow-xl">Publish Project</button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {profileUser.portfolioProjects?.length ? profileUser.portfolioProjects.map((proj, idx) => (
                  <div key={proj.id} className={`${PROJECT_PLACEHOLDERS[idx % PROJECT_PLACEHOLDERS.length]} p-8 md:p-10 rounded-[2rem] flex flex-col justify-between aspect-square md:aspect-auto min-h-[360px] relative overflow-hidden group shadow-2xl`}>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

                    <div className="relative z-10">
                      <h4 className="text-3xl font-black tracking-tight">{proj.title}</h4>
                      <p className="font-bold text-white/90 mt-2 text-sm uppercase tracking-widest">{proj.role}</p>
                      <p className="mt-5 text-sm font-medium leading-relaxed text-white/80 line-clamp-4">{proj.description}</p>
                    </div>

                    <div className="relative z-10 mt-8 space-y-5">
                      <div className="flex flex-wrap gap-2.5">
                        {proj.stack.map(s => <span key={s} className="bg-black/40 backdrop-blur-xl px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-inner">{s}</span>)}
                      </div>
                      <div className="flex gap-4 pt-2">
                        {proj.liveUrl && <a href={proj.liveUrl} target="_blank" rel="noreferrer" className="flex-1 bg-white/10 hover:bg-white text-white hover:text-black py-3.5 rounded-2xl text-center text-sm font-black transition backdrop-blur-xl shadow-lg">Preview</a>}
                        {proj.codeUrl && <a href={proj.codeUrl} target="_blank" rel="noreferrer" className="flex-1 bg-black/50 hover:bg-white text-white hover:text-black py-3.5 rounded-2xl text-center text-sm font-black transition backdrop-blur-xl shadow-lg">Source</a>}
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="col-span-full py-16 text-center text-white/30 font-bold border-[2px] border-dashed border-[#2A2A2A] rounded-[2rem]">
                    No projects showcased yet.
                  </div>
                )}
              </div>
            </div>

            {/* REVIEWS */}
            <div className="bg-[#1A1A1A] rounded-[2.5rem] p-10 shadow-2xl">
              <h3 className="text-3xl font-black tracking-tight mb-10">Recent Client Reviews</h3>
              {reviews.length ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  {reviews.map(review => (
                    <div key={review.id} className="bg-[#0D0D0D] p-8 rounded-[2rem] flex flex-col gap-6 shadow-inner relative">
                      <div className="absolute top-0 right-10 w-24 h-24 bg-yellow-500/5 blur-3xl rounded-full pointer-events-none" />
                      <div className="flex text-yellow-400 gap-1 lg:gap-1.5 z-10">
                        {[...Array(5)].map((_, i) => (
                          <StarSvg key={i} active={i < Math.round(review.rating)} />
                        ))}
                      </div>
                      <p className="text-white/80 italic leading-relaxed text-[0.95rem] flex-1 z-10 font-medium tracking-wide">"{review.review}"</p>
                      <p className="text-white/40 text-xs font-black uppercase tracking-widest z-10">{review.employerName}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-white/30 font-bold py-8 border-[2px] border-dashed border-[#2A2A2A] rounded-[2rem] text-center">No reviews yet.</div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <main className="min-h-screen">
      <Header />
      <Suspense fallback={<div className="min-h-[70vh] flex items-center justify-center text-white/50 text-sm font-semibold animate-pulse">Loading workspace...</div>}>
        <ProfileContent />
      </Suspense>
      <Footer />
    </main>
  );
}
