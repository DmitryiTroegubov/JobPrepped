"use client";

import { useState } from "react";
import { collection, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { toAuthErrorMessage } from "@/lib/firebase-error";
import type { JobLevel, LocationType } from "@/lib/types";

type SeedCategory =
  | "Frontend"
  | "Backend"
  | "Full-Stack"
  | "UI/UX Design"
  | "Mobile Dev"
  | "Data Science"
  | "DevOps"
  | "Product Management";

type SeedLevel = "Intern" | "Junior" | "Middle" | "Senior" | "Lead";
type SeedDuration = "< 1 week" | "1-2 weeks" | "1 month" | "2-3 months" | "Ongoing";
type SeedLocation = "Remote" | "Hybrid" | "On-site";
type SeedSkill =
  | "React"
  | "Next.js"
  | "Vue"
  | "Node.js"
  | "Python"
  | "Firebase"
  | "Figma"
  | "Tailwind CSS"
  | "TypeScript"
  | "SQL"
  | "AWS"
  | "UI/UX";

type SeedJobInput = {
  title: string;
  description: string;
  category: SeedCategory;
  level: SeedLevel;
  duration: SeedDuration;
  locationType: SeedLocation;
  requiredSkills: SeedSkill[];
  rewardPoints: number;
  employerName: string;
  employerId: string;
  status: "open";
  createdAt: ReturnType<typeof serverTimestamp>;
  applicantsCount: number;
};

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const SEED_JOBS: SeedJobInput[] = [
  {
    title: "Build a Landing Page for AI Startup",
    description:
      "Create a modern, conversion-focused landing page for an early-stage AI product. You'll implement key sections, polish interactions, and optimize mobile responsiveness. This is a fast sprint with a clear design direction.",
    category: "Frontend",
    level: "Junior",
    duration: "< 1 week",
    locationType: "Remote",
    requiredSkills: ["React", "Tailwind CSS", "TypeScript"],
    rewardPoints: 300,
    employerName: "Alex from VibeTech",
    employerId: "seed_employer_1",
    status: "open",
    createdAt: serverTimestamp(),
    applicantsCount: randomInt(0, 5)
  },
  {
    title: "Vue Dashboard for Creator Analytics",
    description:
      "Build a clean Vue dashboard that tracks creator growth, retention, and campaign performance. You will structure reusable widgets and wire chart-ready data cards. We want a polished interface stakeholders can demo immediately.",
    category: "Frontend",
    level: "Middle",
    duration: "1-2 weeks",
    locationType: "Hybrid",
    requiredSkills: ["Vue", "TypeScript", "Tailwind CSS"],
    rewardPoints: 900,
    employerName: "Nexus AI",
    employerId: "seed_employer_2",
    status: "open",
    createdAt: serverTimestamp(),
    applicantsCount: randomInt(0, 5)
  },
  {
    title: "Design Mobile App Onboarding Flow",
    description:
      "Design a premium onboarding flow for a productivity app with clear user activation moments. You will deliver polished Figma screens and a lightweight interaction proposal. We need someone who balances speed with thoughtful UX decisions.",
    category: "UI/UX Design",
    level: "Middle",
    duration: "1-2 weeks",
    locationType: "Remote",
    requiredSkills: ["Figma", "UI/UX"],
    rewardPoints: 650,
    employerName: "Studio M",
    employerId: "seed_employer_3",
    status: "open",
    createdAt: serverTimestamp(),
    applicantsCount: randomInt(0, 5)
  },
  {
    title: "Write API Endpoints for E-commerce",
    description:
      "Implement robust backend endpoints for cart, checkout, and order history in an e-commerce MVP. You will focus on reliable data modeling and clear request validation. The team needs production-minded engineering with practical tradeoffs.",
    category: "Backend",
    level: "Middle",
    duration: "1 month",
    locationType: "On-site",
    requiredSkills: ["Node.js", "Firebase", "SQL"],
    rewardPoints: 1600,
    employerName: "Shiply Labs",
    employerId: "seed_employer_4",
    status: "open",
    createdAt: serverTimestamp(),
    applicantsCount: randomInt(0, 5)
  },
  {
    title: "Ship Full-Stack Hiring Workspace MVP",
    description:
      "Build a full-stack workspace where teams can post tasks, chat with candidates, and track status in real time. You will own architecture decisions, implementation, and final stabilization. This is a high-impact delivery tied to investor demo week.",
    category: "Full-Stack",
    level: "Senior",
    duration: "1 month",
    locationType: "Remote",
    requiredSkills: ["Next.js", "Tailwind CSS", "TypeScript", "Firebase"],
    rewardPoints: 5000,
    employerName: "Orbit Foundry",
    employerId: "seed_employer_5",
    status: "open",
    createdAt: serverTimestamp(),
    applicantsCount: randomInt(0, 5)
  },
  {
    title: "Build Churn Prediction Starter Model",
    description:
      "Create a first-pass churn prediction pipeline and baseline model from product events data. You will clean data, train a simple model, and present clear feature insights. The goal is a practical model the product team can iterate on quickly.",
    category: "Data Science",
    level: "Senior",
    duration: "2-3 months",
    locationType: "Hybrid",
    requiredSkills: ["Python", "SQL", "AWS"],
    rewardPoints: 3200,
    employerName: "Pulse Metrics",
    employerId: "seed_employer_6",
    status: "open",
    createdAt: serverTimestamp(),
    applicantsCount: randomInt(0, 5)
  },
  {
    title: "Prototype Mobile Habit Tracker App",
    description:
      "Prototype a mobile-first habit tracker with daily check-ins and streak feedback. You will ship core screens and basic state persistence for a clickable MVP. We want fast execution with strong product instincts.",
    category: "Mobile Dev",
    level: "Junior",
    duration: "1-2 weeks",
    locationType: "On-site",
    requiredSkills: ["React", "TypeScript", "Firebase"],
    rewardPoints: 1100,
    employerName: "Northlane Studio",
    employerId: "seed_employer_7",
    status: "open",
    createdAt: serverTimestamp(),
    applicantsCount: randomInt(0, 5)
  },
  {
    title: "Set Up CI/CD and Cloud Deployment Flow",
    description:
      "Set up a reliable CI/CD pipeline with staging and production deployment gates. You will define build checks, release flow, and rollback basics for a small SaaS team. This role requires practical DevOps choices, not over-engineering.",
    category: "DevOps",
    level: "Senior",
    duration: "Ongoing",
    locationType: "Remote",
    requiredSkills: ["AWS", "Node.js", "Python"],
    rewardPoints: 2400,
    employerName: "KiteOps",
    employerId: "seed_employer_8",
    status: "open",
    createdAt: serverTimestamp(),
    applicantsCount: randomInt(0, 5)
  }
];

const LEVEL_TO_VALUE: Record<SeedLevel, JobLevel> = {
  Intern: "intern",
  Junior: "junior",
  Middle: "middle",
  Senior: "senior",
  Lead: "lead"
};

const LOCATION_TO_VALUE: Record<SeedLocation, LocationType> = {
  Remote: "remote",
  Hybrid: "hybrid",
  "On-site": "onsite"
};

function tokenizeKeyword(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/gi, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function buildSearchKeywords(job: SeedJobInput) {
  const base = [job.title, job.category, ...job.requiredSkills];
  return Array.from(new Set(base.flatMap((item) => tokenizeKeyword(item))));
}

export async function seedMarketplaceData() {
  const db = getFirebaseDb();
  const batch = writeBatch(db);

  for (let i = 0; i < SEED_JOBS.length; i += 1) {
    const seed = SEED_JOBS[i];
    const jobRef = doc(collection(db, "jobs"), `seed_job_${i + 1}`);

    batch.set(jobRef, {
      employerId: seed.employerId,
      employerName: seed.employerName,
      title: seed.title,
      description: seed.description,
      category: seed.category,
      requiredSkills: seed.requiredSkills,
      level: LEVEL_TO_VALUE[seed.level],
      rewardJP: seed.rewardPoints,
      duration: seed.duration,
      deadlineAt: null,
      locationType: LOCATION_TO_VALUE[seed.locationType],
      city: null,
      attachments: [],
      status: seed.status,
      createdAt: seed.createdAt,
      updatedAt: serverTimestamp(),
      applicantsCount: seed.applicantsCount,
      searchKeywords: buildSearchKeywords(seed)
    });
  }

  await batch.commit();
  return SEED_JOBS.length;
}

export function SeedMarketplaceDataButton() {
  const [isSeeding, setIsSeeding] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  const onSeed = async () => {
    setIsSeeding(true);
    setError("");
    setResult("");
    try {
      const count = await seedMarketplaceData();
      setResult(`Seeded ${count} demo jobs successfully.`);
    } catch (e) {
      setError(toAuthErrorMessage(e));
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-3">
      <button
        type="button"
        onClick={onSeed}
        disabled={isSeeding}
        className="inline-flex items-center gap-3 rounded-full bg-white px-6 py-3 text-sm font-bold text-black transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSeeding ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" /> : null}
        {isSeeding ? "Seeding..." : "Seed Demo Jobs"}
      </button>
      {result ? <p className="text-sm text-emerald-300">{result}</p> : null}
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
    </div>
  );
}
