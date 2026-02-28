import {
  Timestamp,
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  serverTimestamp,
  where,
  writeBatch,
  type DocumentData,
  type QueryConstraint,
  type Transaction,
  type Unsubscribe
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import type {
  ActivityLogDoc,
  ActivityType,
  ApplicationDoc,
  ApplicationStatus,
  ApplicationThreadDoc,
  ApplyToJobInput,
  CreateJobInput,
  FavoriteEmployerDoc,
  JobDoc,
  JobStatus,
  LeaderboardWorker,
  ListJobsFilters,
  MyApplicationDoc,
  MyJobDoc,
  NotificationDoc,
  SkillPentagon,
  ThreadMessageDoc,
  UserDoc,
  UserRole
} from "@/lib/types";

const JOB_STATUS_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  open: ["in_review", "closed"],
  in_review: ["open", "closed"],
  closed: []
};

const APPLICATION_STATUS_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  pending: ["hired", "accepted", "viewed", "rejected"],
  hired: ["submitted", "completed", "rejected"],
  sent: ["viewed", "accepted", "hired", "rejected"],
  viewed: ["accepted", "rejected"],
  accepted: ["submitted", "completed", "rejected"],
  rejected: [],
  submitted: ["completed", "rejected"],
  completed: []
};

const DAY_MS = 24 * 60 * 60 * 1000;
const WRITE_CHUNK_SIZE = 450;
const DEFAULT_SKILL_PENTAGON: SkillPentagon = {
  quality: 0,
  speed: 0,
  reliability: 0,
  communication: 0,
  consistency: 0
};

function toDateOrNull(value: unknown) {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate();
  return null;
}

function withId<T>(id: string, data: DocumentData): T {
  return { id, ...data } as T;
}

function clampRate(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function clampMetric(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function tokenizeKeyword(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/gi, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function buildSearchKeywords(input: CreateJobInput) {
  const fromPayload = input.searchKeywords ?? [];
  const base = [input.title, input.category, ...input.requiredSkills, ...fromPayload];
  return Array.from(new Set(base.flatMap((item) => tokenizeKeyword(item))));
}

export function validateCreateJobInput(input: CreateJobInput) {
  const errors: string[] = [];
  if (!input.title.trim()) errors.push("Title is required");
  if (!input.description.trim()) errors.push("Description is required");
  if (!input.requiredSkills.length) errors.push("At least one required skill is required");
  if (!Number.isFinite(input.rewardJP) || input.rewardJP <= 0) errors.push("rewardJP must be greater than 0");

  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateApplyInput(input: ApplyToJobInput) {
  const errors: string[] = [];
  if (!input.message.trim()) errors.push("Application message is required");
  if (input.links.some((link) => !link.startsWith("http://") && !link.startsWith("https://"))) {
    errors.push("All links must start with http:// or https://");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export async function createJob(params: {
  employerId: string;
  employerName: string;
  input: CreateJobInput;
}) {
  const { employerId, employerName, input } = params;
  const validation = validateCreateJobInput(input);
  if (!validation.valid) {
    throw new Error(validation.errors.join("; "));
  }

  const db = getFirebaseDb();
  const jobRef = doc(collection(db, "jobs"));
  const employerRef = doc(db, "users", employerId);
  const myJobRef = doc(db, "users", employerId, "myJobs", jobRef.id);
  const now = serverTimestamp();
  const keywords = buildSearchKeywords(input);

  const jobPayload: Omit<JobDoc, "id" | "createdAt" | "updatedAt" | "deadlineAt"> & {
    createdAt: ReturnType<typeof serverTimestamp>;
    updatedAt: ReturnType<typeof serverTimestamp>;
    deadlineAt: Timestamp | null;
  } = {
    employerId,
    employerName,
    title: input.title.trim(),
    description: input.description.trim(),
    category: input.category.trim(),
    requiredSkills: input.requiredSkills.map((s) => s.trim()).filter(Boolean),
    level: input.level,
    rewardJP: input.rewardJP,
    duration: input.duration,
    deadlineAt: input.deadlineAt ? Timestamp.fromDate(input.deadlineAt) : null,
    locationType: input.locationType,
    city: input.city?.trim() || null,
    attachments: input.attachments?.filter((a) => a.name && a.url) ?? [],
    status: "open",
    createdAt: now,
    updatedAt: now,
    applicantsCount: 0,
    searchKeywords: keywords
  };

  const myJobPayload: Omit<MyJobDoc, "createdAt" | "updatedAt"> & {
    createdAt: ReturnType<typeof serverTimestamp>;
    updatedAt: ReturnType<typeof serverTimestamp>;
  } = {
    jobId: jobRef.id,
    title: input.title.trim(),
    category: input.category.trim(),
    rewardJP: input.rewardJP,
    status: "open",
    applicantsCount: 0,
    createdAt: now,
    updatedAt: now
  };

  await runTransaction(db, async (tx) => {
    const employerSnap = await tx.get(employerRef);
    if (!employerSnap.exists()) {
      throw new Error("Employer account not found");
    }

    const employerData = employerSnap.data();
    if (String(employerData.role ?? "") !== "employer") {
      throw new Error("Only employers can create jobs");
    }

    const currentBalance =
      Number(employerData.jpBalance ?? employerData.jobPreppedBalance ?? 0);

    if (currentBalance < input.rewardJP) {
      throw new Error("Insufficient JP Points");
    }

    tx.set(jobRef, jobPayload);
    tx.set(myJobRef, myJobPayload);
    tx.set(
      employerRef,
      {
        jpBalance: increment(-input.rewardJP),
        jobPreppedBalance: increment(-input.rewardJP),
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  });

  const notifiedFollowers = await fanOutNewJobNotifications({
    employerId,
    employerName,
    jobId: jobRef.id,
    title: input.title.trim()
  });

  return { jobId: jobRef.id, notifiedFollowers };
}

export async function listJobs(filters: ListJobsFilters = {}, max = 50) {
  const db = getFirebaseDb();
  const constraints: QueryConstraint[] = [where("status", "==", "open")];

  if (filters.category) constraints.push(where("category", "==", filters.category));
  if (filters.locationType) constraints.push(where("locationType", "==", filters.locationType));
  if (filters.skill) constraints.push(where("requiredSkills", "array-contains", filters.skill));

  constraints.push(orderBy("createdAt", "desc"), limit(max));

  const snap = await getDocs(query(collection(db, "jobs"), ...constraints));
  return snap.docs.map((item) => withId<JobDoc>(item.id, item.data()));
}

export async function listWorkers(max = 100) {
  const db = getFirebaseDb();
  const constraints: QueryConstraint[] = [
    where("role", "==", "worker"),
    limit(max)
  ];

  const snap = await getDocs(query(collection(db, "users"), ...constraints));
  return snap.docs.map((item) => withId<UserDoc & { id: string }>(item.id, item.data()));
}

export async function getTrendingTopics() {
  const db = getFirebaseDb();

  const predefined = [
    { title: "React & Next.js", skill: "React" },
    { title: "Frontend Development", category: "Frontend" },
    { title: "Backend & Node.js", skill: "Node.js" },
    { title: "UI/UX Design", category: "UI/UX Design" },
    { title: "Python & Data Science", skill: "Python" }
  ];

  const results = await Promise.all(
    predefined.map(async (def) => {
      const constraints: QueryConstraint[] = [where("status", "==", "open")];
      if (def.skill) constraints.push(where("requiredSkills", "array-contains", def.skill));
      if (def.category) constraints.push(where("category", "==", def.category));

      const countRef = query(collection(db, "jobs"), ...constraints);
      const snap = await getCountFromServer(countRef);
      const count = snap.data().count;

      return {
        title: def.title,
        meta: `${count} Open Projects`
      };
    })
  );

  return results;
}

export async function listEmployerJobs(employerId: string, max = 50) {
  const db = getFirebaseDb();
  const q = query(
    collection(db, "jobs"),
    where("employerId", "==", employerId),
    orderBy("createdAt", "desc"),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map((item) => withId<JobDoc>(item.id, item.data()));
}

export async function getJobById(jobId: string) {
  const db = getFirebaseDb();
  const snap = await getDoc(doc(db, "jobs", jobId));
  if (!snap.exists()) return null;
  return withId<JobDoc>(snap.id, snap.data());
}

export async function updateJobStatus(params: {
  jobId: string;
  employerId: string;
  nextStatus: JobStatus;
}) {
  const db = getFirebaseDb();

  await runTransaction(db, async (tx) => {
    const jobRef = doc(db, "jobs", params.jobId);
    const jobSnap = await tx.get(jobRef);
    if (!jobSnap.exists()) throw new Error("Job not found");

    const job = jobSnap.data() as JobDoc;
    if (job.employerId !== params.employerId) {
      throw new Error("Only employer-owner can update job status");
    }

    const allowed = JOB_STATUS_TRANSITIONS[job.status];
    if (!allowed.includes(params.nextStatus)) {
      throw new Error(`Invalid status transition: ${job.status} -> ${params.nextStatus}`);
    }

    tx.update(jobRef, { status: params.nextStatus, updatedAt: serverTimestamp() });

    const myJobRef = doc(db, "users", params.employerId, "myJobs", params.jobId);
    tx.set(myJobRef, { status: params.nextStatus, updatedAt: serverTimestamp() }, { merge: true });
  });
}

export async function closeJob(jobId: string, employerId: string) {
  await updateJobStatus({ jobId, employerId, nextStatus: "closed" });
}

function todayUtcDayKey() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeDayKey(dayKey?: string) {
  if (!dayKey) return todayUtcDayKey();
  return /^\d{4}-\d{2}-\d{2}$/.test(dayKey) ? dayKey : todayUtcDayKey();
}

function parseDayKey(dayKey: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function dayGap(fromDayKey: string, toDayKey: string) {
  const from = parseDayKey(fromDayKey);
  const to = parseDayKey(toDayKey);
  if (!from || !to) return 0;
  return Math.floor((to.getTime() - from.getTime()) / DAY_MS);
}

function computeNextStreakState(params: {
  currentStreakDays: number;
  longestStreakDays: number;
  lastActiveDate: string | null;
  streakFreezeTokens: number;
  dayKey: string;
}) {
  let { currentStreakDays, longestStreakDays, lastActiveDate, streakFreezeTokens } = params;
  const { dayKey } = params;

  if (lastActiveDate === dayKey) {
    return { currentStreakDays, longestStreakDays, lastActiveDate, streakFreezeTokens, countedToday: false };
  }

  if (!lastActiveDate) {
    currentStreakDays = 1;
  } else {
    const gap = dayGap(lastActiveDate, dayKey);
    if (gap <= 0) {
      return { currentStreakDays, longestStreakDays, lastActiveDate, streakFreezeTokens, countedToday: false };
    }

    if (gap === 1) {
      currentStreakDays += 1;
    } else if (gap > 1 && streakFreezeTokens > 0) {
      streakFreezeTokens -= 1;
      currentStreakDays += 1;
    } else {
      currentStreakDays = 1;
    }
  }

  longestStreakDays = Math.max(longestStreakDays, currentStreakDays);
  lastActiveDate = dayKey;
  return { currentStreakDays, longestStreakDays, lastActiveDate, streakFreezeTokens, countedToday: true };
}

async function recordActivityInTransaction(params: {
  tx: Transaction;
  uid: string;
  activityType: ActivityType;
  refId: string;
  dayKey?: string;
}) {
  const db = getFirebaseDb();
  const dayKey = normalizeDayKey(params.dayKey);
  const userRef = doc(db, "users", params.uid);
  const userSnap = await params.tx.get(userRef);
  if (!userSnap.exists()) {
    throw new Error("User not found");
  }

  const data = userSnap.data();
  const nextStreak = computeNextStreakState({
    currentStreakDays: Number(data.currentStreakDays ?? 0),
    longestStreakDays: Number(data.longestStreakDays ?? 0),
    lastActiveDate: (data.lastActiveDate as string | null | undefined) ?? null,
    streakFreezeTokens: Number(data.streakFreezeTokens ?? 0),
    dayKey
  });

  params.tx.set(
    userRef,
    {
      currentStreakDays: nextStreak.currentStreakDays,
      longestStreakDays: nextStreak.longestStreakDays,
      lastActiveDate: nextStreak.lastActiveDate,
      streakFreezeTokens: nextStreak.streakFreezeTokens,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  const activityRef = doc(collection(db, "users", params.uid, "activity"));
  params.tx.set(activityRef, {
    type: params.activityType,
    refId: params.refId,
    createdAt: serverTimestamp(),
    dayKey
  });

  return {
    activityId: activityRef.id,
    ...nextStreak,
    dayKey
  };
}

function computeSkillPentagon(params: {
  avgEmployerRating: number;
  onTimeRate: number;
  completedJobsCount: number;
  acceptedApplicationsCount: number;
  responseRate: number;
  currentStreakDays: number;
  longestStreakDays: number;
}) {
  const reliability =
    params.acceptedApplicationsCount === 0
      ? 0
      : (params.completedJobsCount / params.acceptedApplicationsCount) * 100;
  const consistency =
    (Math.min(params.currentStreakDays, 30) / 30) * 70 +
    (Math.min(params.longestStreakDays, 60) / 60) * 30;

  return {
    quality: clampMetric((params.avgEmployerRating / 5) * 100),
    speed: clampMetric(params.onTimeRate * 100),
    reliability: clampMetric(reliability),
    communication: clampMetric(params.responseRate * 100),
    consistency: clampMetric(consistency)
  } satisfies SkillPentagon;
}

function statusToSystemMessage(status: ApplicationStatus) {
  if (status === "hired") return "Worker was hired! Work has started.";
  if (status === "viewed") return "Application viewed";
  if (status === "accepted") return "Application accepted";
  if (status === "submitted") return "Work submitted";
  if (status === "rejected") return "Application rejected";
  if (status === "completed") return "Job completed";
  return null;
}

export function toContractStatus(status: ApplicationStatus | string | undefined) {
  if (status === "submitted") return "submitted" as const;
  if (status === "completed") return "completed" as const;
  if (status === "hired" || status === "accepted") return "hired" as const;
  return "pending" as const;
}

function appendThreadMessageInTransaction(params: {
  tx: Transaction;
  applicationId: string;
  senderId: string;
  text: string;
  type: "text" | "system";
}) {
  const db = getFirebaseDb();
  const threadRef = doc(db, "applicationThreads", params.applicationId);
  const messageRef = doc(collection(db, "applicationThreads", params.applicationId, "messages"));

  params.tx.set(messageRef, {
    senderId: params.senderId,
    text: params.text,
    createdAt: serverTimestamp(),
    readBy: { [params.senderId]: true },
    type: params.type
  } satisfies ThreadMessageDoc);

  params.tx.set(
    threadRef,
    {
      lastMessageAt: serverTimestamp(),
      lastMessageText: params.text
    },
    { merge: true }
  );
}

async function fanOutNewJobNotifications(params: {
  employerId: string;
  employerName: string;
  jobId: string;
  title: string;
}) {
  const db = getFirebaseDb();
  const followersSnap = await getDocs(collection(db, "employers", params.employerId, "followers"));
  const workerIds = followersSnap.docs.map((item) => item.id);

  let notified = 0;
  for (let i = 0; i < workerIds.length; i += WRITE_CHUNK_SIZE) {
    const batch = writeBatch(db);
    const chunk = workerIds.slice(i, i + WRITE_CHUNK_SIZE);
    for (const workerId of chunk) {
      const notifRef = doc(collection(db, "users", workerId, "notifications"));
      batch.set(notifRef, {
        type: "NEW_JOB",
        workerId,
        employerId: params.employerId,
        jobId: params.jobId,
        title: `${params.employerName}: ${params.title}`,
        createdAt: serverTimestamp(),
        read: false,
        readAt: null
      } satisfies NotificationDoc);
    }
    await batch.commit();
    notified += chunk.length;
  }

  return notified;
}

export async function recordActivity(uid: string, activityType: ActivityType, refId: string, dayKey?: string) {
  const db = getFirebaseDb();
  return runTransaction(db, async (tx) => {
    return recordActivityInTransaction({
      tx,
      uid,
      activityType,
      refId,
      dayKey
    });
  });
}

export async function logStudyTaskActivity(uid: string, refId = "manual-study-task") {
  return recordActivity(uid, "STUDY_TASK", refId);
}

export async function listUserActivity(uid: string, max = 30) {
  const db = getFirebaseDb();
  const q = query(collection(db, "users", uid, "activity"), orderBy("createdAt", "desc"), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((item) => withId<ActivityLogDoc & { id: string }>(item.id, item.data()));
}

export async function applyToJob(params: {
  jobId: string;
  workerId: string;
  workerName: string;
  input: ApplyToJobInput;
}) {
  const validation = validateApplyInput(params.input);
  if (!validation.valid) {
    throw new Error(validation.errors.join("; "));
  }

  const db = getFirebaseDb();
  const normalizedWorkerName = String(params.workerName ?? "").trim() || "Worker";
  const applicationId = `${params.jobId}_${params.workerId}`;
  let threadJobId = "";
  let threadEmployerId = "";

  await runTransaction(db, async (tx) => {
    const jobRef = doc(db, "jobs", params.jobId);
    const jobSnap = await tx.get(jobRef);
    if (!jobSnap.exists()) {
      throw new Error("Job not found");
    }

    const job = withId<JobDoc>(jobSnap.id, jobSnap.data());
    threadJobId = job.id;
    threadEmployerId = job.employerId;
    if (job.status !== "open") {
      throw new Error("You can apply only to open jobs");
    }
    if (job.employerId === params.workerId) {
      throw new Error("Employer cannot apply to own job");
    }

    const appRef = doc(db, "applications", applicationId);
    const appSnap = await tx.get(appRef);
    if (appSnap.exists()) {
      throw new Error("Application already exists for this job and worker");
    }

    await recordActivityInTransaction({
      tx,
      uid: params.workerId,
      activityType: "APPLY_JOB",
      refId: applicationId
    });

    tx.set(appRef, {
      jobId: job.id,
      employerId: job.employerId,
      workerId: params.workerId,
      workerName: normalizedWorkerName,
      message: params.input.message.trim(),
      links: params.input.links,
      rewardJP: job.rewardJP,
      proposedDeliveryAt: params.input.proposedDeliveryAt
        ? Timestamp.fromDate(params.input.proposedDeliveryAt)
        : null,
      status: "pending",
      acceptedAt: null,
      submittedAt: null,
      completedAt: null,
      employerRating: null,
      ratedAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    const nextApplicantsCount = Number(job.applicantsCount ?? 0) + 1;
    tx.update(jobRef, {
      applicantsCount: nextApplicantsCount,
      updatedAt: serverTimestamp()
    });

    const myAppRef = doc(db, "users", params.workerId, "myApplications", applicationId);
    tx.set(myAppRef, {
      applicationId,
      jobId: job.id,
      jobTitle: job.title,
      employerId: job.employerId,
      employerName: job.employerName,
      status: "pending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    } satisfies Omit<MyApplicationDoc, "createdAt" | "updatedAt"> & {
      createdAt: ReturnType<typeof serverTimestamp>;
      updatedAt: ReturnType<typeof serverTimestamp>;
    });
  });

  if (!threadJobId || !threadEmployerId) {
    throw new Error("Application created, but failed to initialize thread metadata");
  }

  const threadRef = doc(db, "applicationThreads", applicationId);
  await setDoc(threadRef, {
    applicationId,
    jobId: threadJobId,
    employerId: threadEmployerId,
    workerId: params.workerId,
    createdAt: serverTimestamp(),
    lastMessageAt: serverTimestamp(),
    lastMessageText: "Application submitted"
  } satisfies ApplicationThreadDoc);

  const firstMessageRef = doc(collection(db, "applicationThreads", applicationId, "messages"));
  await setDoc(firstMessageRef, {
    senderId: params.workerId,
    text: "Application submitted",
    createdAt: serverTimestamp(),
    readBy: {
      [params.workerId]: true
    },
    type: "system"
  } satisfies ThreadMessageDoc);

  return applicationId;
}

export async function handleOneClickApply(
  job: Pick<JobDoc, "id" | "employerId" | "title">,
  currentWorkerId: string
) {
  const db = getFirebaseDb();
  if (!job?.id) {
    throw new Error("Job not found");
  }
  if (!currentWorkerId) {
    throw new Error("Worker not found");
  }

  const existingQuery = query(
    collection(db, "applications"),
    where("jobId", "==", job.id),
    where("workerId", "==", currentWorkerId),
    limit(1)
  );
  const existingSnap = await getDocs(existingQuery);
  if (!existingSnap.empty) {
    return existingSnap.docs[0].id;
  }

  const workerSnap = await getDoc(doc(db, "users", currentWorkerId));
  const workerData = workerSnap.data();
  const workerName =
    String(workerData?.name ?? workerData?.displayName ?? "").trim() || "Worker";

  try {
    return await applyToJob({
      jobId: job.id,
      workerId: currentWorkerId,
      workerName,
      input: {
        message: "Hi! I am ready to start working on this task.",
        links: [],
        proposedDeliveryAt: null
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (message.includes("already exists")) {
      return `${job.id}_${currentWorkerId}`;
    }
    throw error;
  }
}

export async function listApplicationsByJob(jobId: string, max = 100) {
  const db = getFirebaseDb();
  const q = query(
    collection(db, "applications"),
    where("jobId", "==", jobId),
    orderBy("createdAt", "desc"),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map((item) => withId<ApplicationDoc>(item.id, item.data()));
}

export async function listApplicationsByWorker(workerId: string, max = 100) {
  const db = getFirebaseDb();
  const q = query(
    collection(db, "applications"),
    where("workerId", "==", workerId),
    orderBy("createdAt", "desc"),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map((item) => withId<ApplicationDoc>(item.id, item.data()));
}

export async function listApplicationsByEmployer(employerId: string, max = 100) {
  const db = getFirebaseDb();
  const q = query(
    collection(db, "applications"),
    where("employerId", "==", employerId),
    orderBy("createdAt", "desc"),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map((item) => withId<ApplicationDoc>(item.id, item.data()));
}

export async function getApplicationById(applicationId: string) {
  const db = getFirebaseDb();
  const snap = await getDoc(doc(db, "applications", applicationId));
  if (!snap.exists()) return null;
  return withId<ApplicationDoc>(snap.id, snap.data());
}

export function listenApplicationById(
  applicationId: string,
  onData: (application: ApplicationDoc | null) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const db = getFirebaseDb();
  const ref = doc(db, "applications", applicationId);

  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      onData(withId<ApplicationDoc>(snap.id, snap.data()));
    },
    (error) => {
      if (onError) onError(error);
    }
  );
}

export async function handleHire(params: {
  applicationId: string;
  employerId: string;
}) {
  const db = getFirebaseDb();
  let workerId = "";

  await runTransaction(db, async (tx) => {
    const appRef = doc(db, "applications", params.applicationId);
    const appSnap = await tx.get(appRef);
    if (!appSnap.exists()) {
      throw new Error("Application not found");
    }

    const application = withId<ApplicationDoc>(appSnap.id, appSnap.data());
    workerId = application.workerId;

    if (application.employerId !== params.employerId) {
      throw new Error("Only employer-owner can hire this worker");
    }
    if (toContractStatus(application.status) !== "pending") {
      throw new Error("Worker can be hired only from pending status");
    }

    tx.update(appRef, {
      status: "hired",
      acceptedAt: application.acceptedAt ?? serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    const jobRef = doc(db, "jobs", application.jobId);
    tx.set(jobRef, { status: "in_review", updatedAt: serverTimestamp() }, { merge: true });

    const myJobRef = doc(db, "users", application.employerId, "myJobs", application.jobId);
    tx.set(myJobRef, { status: "in_review", updatedAt: serverTimestamp() }, { merge: true });

    const workerStatsRef = doc(db, "workers", application.workerId);
    tx.set(
      workerStatsRef,
      {
        acceptedApplicationsCount: increment(1),
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    appendThreadMessageInTransaction({
      tx,
      applicationId: application.id,
      senderId: params.employerId,
      text: "Worker was hired! Work has started.",
      type: "system"
    });
  });

  if (workerId) {
    await recomputeWorkerStats(workerId);
  }
}

export async function handleSubmitWork(params: {
  applicationId: string;
  workerId: string;
  submissionLink: string;
}) {
  const db = getFirebaseDb();
  const cleanLink = params.submissionLink.trim();
  if (!cleanLink) {
    throw new Error("Submission link is required");
  }

  let targetWorkerId = "";
  await runTransaction(db, async (tx) => {
    const appRef = doc(db, "applications", params.applicationId);
    const appSnap = await tx.get(appRef);
    if (!appSnap.exists()) {
      throw new Error("Application not found");
    }

    const application = withId<ApplicationDoc>(appSnap.id, appSnap.data());
    targetWorkerId = application.workerId;

    if (application.workerId !== params.workerId) {
      throw new Error("Only worker-owner can submit work");
    }
    if (toContractStatus(application.status) !== "hired") {
      throw new Error("Work can be submitted only after hire");
    }

    await recordActivityInTransaction({
      tx,
      uid: application.workerId,
      activityType: "SUBMIT_WORK",
      refId: application.id
    });

    tx.update(appRef, {
      status: "submitted",
      submittedAt: application.submittedAt ?? serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    const myAppRef = doc(db, "users", application.workerId, "myApplications", application.id);
    tx.set(myAppRef, { status: "submitted", updatedAt: serverTimestamp() }, { merge: true });

    const workerStatsRef = doc(db, "workers", application.workerId);
    tx.set(
      workerStatsRef,
      {
        submissionsCount: increment(1),
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    appendThreadMessageInTransaction({
      tx,
      applicationId: application.id,
      senderId: params.workerId,
      text: `Work submitted: ${cleanLink}`,
      type: "system"
    });
  });

  if (targetWorkerId) {
    await recomputeWorkerStats(targetWorkerId);
  }
}

export async function handleApproveAndPay(params: {
  applicationId: string;
  employerId: string;
  rating: number;
  review?: string;
}) {
  const numericRating = Number(params.rating);
  if (!Number.isFinite(numericRating) || numericRating < 1 || numericRating > 5) {
    throw new Error("A worker rating from 1 to 5 is required");
  }

  const normalizedRating = Math.round(numericRating);
  const cleanReview = String(params.review ?? "").trim();
  if (cleanReview.length > 300) {
    throw new Error("Review must be 300 characters or less");
  }

  const db = getFirebaseDb();
  let workerId = "";
  let rewardJP = 0;

  await runTransaction(db, async (tx) => {
    const appRef = doc(db, "applications", params.applicationId);
    const appSnap = await tx.get(appRef);
    if (!appSnap.exists()) {
      throw new Error("Application not found");
    }

    const application = withId<ApplicationDoc>(appSnap.id, appSnap.data());
    workerId = application.workerId;

    if (application.employerId !== params.employerId) {
      throw new Error("Only employer-owner can approve this task");
    }
    if (toContractStatus(application.status) !== "submitted") {
      throw new Error("Task can be approved only after work submission");
    }

    const jobRef = doc(db, "jobs", application.jobId);
    const jobSnap = await tx.get(jobRef);
    if (!jobSnap.exists()) {
      throw new Error("Job not found");
    }
    const job = withId<JobDoc>(jobSnap.id, jobSnap.data());
    rewardJP = Number(job.rewardJP ?? application.rewardJP ?? 0);
    if (!Number.isFinite(rewardJP) || rewardJP <= 0) {
      throw new Error("Job reward is invalid");
    }

    await recordActivityInTransaction({
      tx,
      uid: application.workerId,
      activityType: "COMPLETE_JOB",
      refId: application.id
    });

    tx.update(appRef, {
      status: "completed",
      completedAt: application.completedAt ?? serverTimestamp(),
      rating: normalizedRating,
      review: cleanReview,
      updatedAt: serverTimestamp()
    });

    tx.update(jobRef, { status: "closed", updatedAt: serverTimestamp() });

    const myJobRef = doc(db, "users", application.employerId, "myJobs", job.id);
    tx.set(myJobRef, { status: "closed", updatedAt: serverTimestamp() }, { merge: true });

    const workerRef = doc(db, "users", application.workerId);
    tx.set(
      workerRef,
      {
        jpBalance: increment(rewardJP),
        jobPreppedBalance: increment(rewardJP),
        completedJobsCount: increment(1),
        jobsCompleted: increment(1),
        totalRatingPoints: increment(normalizedRating),
        reviewCount: increment(1),
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    const workerStatsRef = doc(db, "workers", application.workerId);
    tx.set(
      workerStatsRef,
      {
        completedJobsCount: increment(1),
        totalEarnedJP: increment(rewardJP),
        weeklyEarnedJP: increment(rewardJP),
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    appendThreadMessageInTransaction({
      tx,
      applicationId: application.id,
      senderId: params.employerId,
      text: `Task completed! ${rewardJP} JP Points transferred. Employer rating: ${normalizedRating}/5.`,
      type: "system"
    });
  });

  if (workerId) {
    await recomputeWorkerStats(workerId);
  }

  return rewardJP;
}

export async function updateApplicationStatus(params: {
  applicationId: string;
  nextStatus: ApplicationStatus;
  actorUid: string;
  actorRole: UserRole;
}) {
  const db = getFirebaseDb();
  let workerId = "";

  await runTransaction(db, async (tx) => {
    const appRef = doc(db, "applications", params.applicationId);
    const appSnap = await tx.get(appRef);
    if (!appSnap.exists()) {
      throw new Error("Application not found");
    }

    const application = withId<ApplicationDoc>(appSnap.id, appSnap.data());
    workerId = application.workerId;

    const allowed = APPLICATION_STATUS_TRANSITIONS[application.status];
    if (!allowed.includes(params.nextStatus)) {
      throw new Error(`Invalid status transition: ${application.status} -> ${params.nextStatus}`);
    }

    if (params.actorRole === "employer") {
      if (application.employerId !== params.actorUid) {
        throw new Error("Only employer-owner can review this application");
      }
      if (!["viewed", "accepted", "rejected"].includes(params.nextStatus)) {
        throw new Error("Employer can set only viewed/accepted/rejected in review flow");
      }
    }

    if (params.actorRole === "worker") {
      if (application.workerId !== params.actorUid) {
        throw new Error("Worker can update only own application");
      }
      if (params.nextStatus !== "submitted") {
        throw new Error("Worker can set only submitted");
      }
    }

    const appUpdate: Record<string, unknown> = {
      status: params.nextStatus,
      updatedAt: serverTimestamp()
    };

    if (params.nextStatus === "accepted" && !application.acceptedAt) {
      appUpdate.acceptedAt = serverTimestamp();
    }
    if (params.nextStatus === "submitted" && !application.submittedAt) {
      appUpdate.submittedAt = serverTimestamp();
    }

    tx.update(appRef, appUpdate);

    if (params.actorRole === "worker") {
      const myAppRef = doc(db, "users", application.workerId, "myApplications", application.id);
      tx.set(
        myAppRef,
        {
          status: params.nextStatus,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
    }

    const workerStatsRef = doc(db, "workers", application.workerId);

    if (params.nextStatus === "accepted") {
      const jobRef = doc(db, "jobs", application.jobId);
      tx.set(jobRef, { status: "in_review", updatedAt: serverTimestamp() }, { merge: true });

      const myJobRef = doc(db, "users", application.employerId, "myJobs", application.jobId);
      tx.set(myJobRef, { status: "in_review", updatedAt: serverTimestamp() }, { merge: true });

      tx.set(
        workerStatsRef,
        {
          acceptedApplicationsCount: increment(1),
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
    }

    if (params.nextStatus === "submitted") {
      tx.set(
        workerStatsRef,
        {
          submissionsCount: increment(1),
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );

      await recordActivityInTransaction({
        tx,
        uid: application.workerId,
        activityType: "SUBMIT_WORK",
        refId: application.id
      });
    }

    const systemMessage = statusToSystemMessage(params.nextStatus);
    if (systemMessage) {
      appendThreadMessageInTransaction({
        tx,
        applicationId: application.id,
        senderId: params.actorUid,
        text: systemMessage,
        type: "system"
      });
    }
  });

  if (workerId && (params.nextStatus === "accepted" || params.nextStatus === "submitted")) {
    await recomputeWorkerStats(workerId);
  }
}

export async function completeApplicationAndSettleJP(params: {
  applicationId: string;
  employerId: string;
}) {
  const db = getFirebaseDb();
  let workerId = "";

  await runTransaction(db, async (tx) => {
    const appRef = doc(db, "applications", params.applicationId);
    const appSnap = await tx.get(appRef);
    if (!appSnap.exists()) throw new Error("Application not found");

    const application = withId<ApplicationDoc>(appSnap.id, appSnap.data());
    workerId = application.workerId;

    if (application.employerId !== params.employerId) {
      throw new Error("Only employer-owner can complete this application");
    }
    if (!["accepted", "submitted"].includes(application.status)) {
      throw new Error("Application must be accepted or submitted before completion");
    }

    const jobRef = doc(db, "jobs", application.jobId);
    const jobSnap = await tx.get(jobRef);
    if (!jobSnap.exists()) throw new Error("Job not found");
    const job = withId<JobDoc>(jobSnap.id, jobSnap.data());

    const workerRef = doc(db, "users", application.workerId);

    tx.update(appRef, {
      status: "completed",
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    tx.update(jobRef, { status: "closed", updatedAt: serverTimestamp() });

    const myJobRef = doc(db, "users", application.employerId, "myJobs", job.id);
    tx.set(myJobRef, { status: "closed", updatedAt: serverTimestamp() }, { merge: true });

    tx.set(
      workerRef,
      {
        jpBalance: increment(job.rewardJP),
        jobPreppedBalance: increment(job.rewardJP),
        completedJobsCount: increment(1),
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    const workerStatsRef = doc(db, "workers", application.workerId);
    tx.set(
      workerStatsRef,
      {
        completedJobsCount: increment(1),
        totalEarnedJP: increment(job.rewardJP),
        weeklyEarnedJP: increment(job.rewardJP),
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    await recordActivityInTransaction({
      tx,
      uid: application.workerId,
      activityType: "COMPLETE_JOB",
      refId: application.id
    });

    appendThreadMessageInTransaction({
      tx,
      applicationId: application.id,
      senderId: params.employerId,
      text: "Job completed",
      type: "system"
    });
  });

  if (workerId) {
    await recomputeWorkerStats(workerId);
  }
}

export async function rateWorkerForApplication(params: {
  applicationId: string;
  employerId: string;
  rating: number;
}) {
  const db = getFirebaseDb();
  const normalizedRating = Math.max(1, Math.min(5, Math.round(params.rating)));
  let workerId = "";

  await runTransaction(db, async (tx) => {
    const appRef = doc(db, "applications", params.applicationId);
    const appSnap = await tx.get(appRef);
    if (!appSnap.exists()) {
      throw new Error("Application not found");
    }

    const application = withId<ApplicationDoc>(appSnap.id, appSnap.data());
    workerId = application.workerId;

    if (application.employerId !== params.employerId) {
      throw new Error("Only employer-owner can rate this worker");
    }
    if (application.status !== "completed") {
      throw new Error("Rating is allowed only after completion");
    }
    if (typeof application.employerRating === "number") {
      throw new Error("Application already rated");
    }

    tx.update(appRef, {
      employerRating: normalizedRating,
      ratedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    const workerStatsRef = doc(db, "workers", application.workerId);
    const workerStatsSnap = await tx.get(workerStatsRef);
    const currentAvg = (workerStatsSnap.data()?.avgEmployerRating as number | undefined) ?? 0;
    const currentCount = (workerStatsSnap.data()?.ratingsCount as number | undefined) ?? 0;
    const nextCount = currentCount + 1;
    const nextAvg = (currentAvg * currentCount + normalizedRating) / nextCount;

    tx.set(
      workerStatsRef,
      {
        avgEmployerRating: Number(nextAvg.toFixed(4)),
        ratingsCount: nextCount,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    const workerUserRef = doc(db, "users", application.workerId);
    tx.set(workerUserRef, { rating: Number(nextAvg.toFixed(4)), updatedAt: serverTimestamp() }, { merge: true });

    appendThreadMessageInTransaction({
      tx,
      applicationId: application.id,
      senderId: params.employerId,
      text: `Employer rated this job ${normalizedRating}/5`,
      type: "system"
    });
  });

  if (workerId) {
    await recomputeWorkerStats(workerId);
  }
}

export async function recomputeWorkerStats(uid: string) {
  const db = getFirebaseDb();
  const userRef = doc(db, "users", uid);
  const workerRef = doc(db, "workers", uid);
  const [userSnap, appsSnap] = await Promise.all([
    getDoc(userRef),
    getDocs(query(collection(db, "applications"), where("workerId", "==", uid)))
  ]);

  const userData = userSnap.data() ?? {};
  const weekStart = new Date(Date.now() - 7 * DAY_MS);

  let completedJobsCount = 0;
  let acceptedApplicationsCount = 0;
  let submissionsCount = 0;
  let ratingsCount = 0;
  let ratingsSum = 0;
  let onTimeCompletedCount = 0;
  let totalEarnedJP = 0;
  let weeklyEarnedJP = 0;

  for (const item of appsSnap.docs) {
    const app = item.data() as ApplicationDoc;

    const accepted =
      Boolean(app.acceptedAt) || app.status === "accepted" || app.status === "submitted" || app.status === "completed";
    if (accepted) {
      acceptedApplicationsCount += 1;
    }

    const submitted = Boolean(app.submittedAt) || app.status === "submitted" || app.status === "completed";
    if (submitted) {
      submissionsCount += 1;
    }

    if (app.status === "completed") {
      completedJobsCount += 1;

      const reward = Number(app.rewardJP ?? 0);
      totalEarnedJP += reward;

      const completedAt = toDateOrNull(app.completedAt);
      if (completedAt && completedAt >= weekStart) {
        weeklyEarnedJP += reward;
      }

      const proposed = toDateOrNull(app.proposedDeliveryAt);
      if (!proposed || (completedAt && completedAt <= proposed)) {
        onTimeCompletedCount += 1;
      }
    }

    const appRating = typeof app.rating === "number" ? app.rating : app.employerRating;
    if (typeof appRating === "number") {
      ratingsCount += 1;
      ratingsSum += appRating;
    }
  }

  const avgEmployerRating = ratingsCount ? Number((ratingsSum / ratingsCount).toFixed(4)) : 0;
  const onTimeRate = completedJobsCount ? clampRate(onTimeCompletedCount / completedJobsCount) : 0;
  const responseRate = acceptedApplicationsCount ? clampRate(submissionsCount / acceptedApplicationsCount) : 0;
  const currentStreakDays = Number(userData.currentStreakDays ?? 0);
  const longestStreakDays = Number(userData.longestStreakDays ?? 0);

  const skillPentagon = computeSkillPentagon({
    avgEmployerRating,
    onTimeRate,
    completedJobsCount,
    acceptedApplicationsCount,
    responseRate,
    currentStreakDays,
    longestStreakDays
  });

  const batch = writeBatch(db);
  batch.set(
    workerRef,
    {
      completedJobsCount,
      acceptedApplicationsCount,
      submissionsCount,
      avgEmployerRating,
      ratingsCount,
      onTimeRate: Number(onTimeRate.toFixed(4)),
      responseRate: Number(responseRate.toFixed(4)),
      totalEarnedJP,
      weeklyEarnedJP,
      skillPentagon,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  batch.set(
    userRef,
    {
      completedJobsCount,
      jobsCompleted: completedJobsCount,
      rating: avgEmployerRating,
      totalRatingPoints: ratingsSum,
      reviewCount: ratingsCount,
      currentStreakDays,
      longestStreakDays,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
  await batch.commit();

  return {
    completedJobsCount,
    acceptedApplicationsCount,
    submissionsCount,
    avgEmployerRating,
    ratingsCount,
    onTimeRate,
    responseRate,
    totalEarnedJP,
    weeklyEarnedJP,
    skillPentagon
  };
}

export async function listTopWorkersLeaderboard(max = 100) {
  const db = getFirebaseDb();
  const q = query(
    collection(db, "users"),
    where("role", "==", "worker"),
    orderBy("jobPreppedBalance", "desc"),
    orderBy("currentStreakDays", "desc"),
    orderBy("completedJobsCount", "desc"),
    limit(max)
  );
  const snap = await getDocs(q);

  return snap.docs.map((item) => {
    const data = item.data();
    return {
      uid: item.id,
      displayName: (data.displayName as string | undefined) ?? (data.name as string | undefined) ?? "Worker",
      avatarUrl: (data.avatarUrl as string | undefined) ?? "",
      jobPreppedBalance: Number(data.jpBalance ?? data.jobPreppedBalance ?? 0),
      currentStreakDays: Number(data.currentStreakDays ?? 0),
      completedJobsCount: Number(data.completedJobsCount ?? 0),
      rating: Number(data.rating ?? 0)
    } satisfies LeaderboardWorker;
  });
}

export async function listWeeklyWorkersLeaderboard(max = 100) {
  return listTopWorkersLeaderboard(max);
}

export async function favoriteEmployer(params: {
  workerId: string;
  employerId: string;
  employerName: string;
}) {
  const db = getFirebaseDb();
  const favoriteRef = doc(db, "users", params.workerId, "favorites", params.employerId);
  const followerRef = doc(db, "employers", params.employerId, "followers", params.workerId);
  const batch = writeBatch(db);

  batch.set(favoriteRef, {
    employerId: params.employerId,
    employerName: params.employerName,
    createdAt: serverTimestamp()
  } satisfies FavoriteEmployerDoc);

  batch.set(followerRef, {
    workerId: params.workerId,
    createdAt: serverTimestamp()
  });

  await batch.commit();
}

export async function unfavoriteEmployer(params: { workerId: string; employerId: string }) {
  const db = getFirebaseDb();
  const favoriteRef = doc(db, "users", params.workerId, "favorites", params.employerId);
  const followerRef = doc(db, "employers", params.employerId, "followers", params.workerId);
  const batch = writeBatch(db);
  batch.delete(favoriteRef);
  batch.delete(followerRef);
  await batch.commit();
}

export async function listFavoriteEmployers(workerId: string, max = 100) {
  const db = getFirebaseDb();
  const q = query(collection(db, "users", workerId, "favorites"), orderBy("createdAt", "desc"), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((item) => withId<FavoriteEmployerDoc>(item.id, item.data()));
}

export async function listNotifications(workerId: string, max = 100) {
  const db = getFirebaseDb();
  const q = query(
    collection(db, "users", workerId, "notifications"),
    orderBy("createdAt", "desc"),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map((item) => withId<NotificationDoc>(item.id, item.data()));
}

export async function getUnreadNotificationsCount(workerId: string) {
  const db = getFirebaseDb();
  const unreadQuery = query(collection(db, "users", workerId, "notifications"), where("read", "==", false));
  const result = await getCountFromServer(unreadQuery);
  return result.data().count;
}

export async function markNotificationRead(workerId: string, notifId: string) {
  const db = getFirebaseDb();
  await runTransaction(db, async (tx) => {
    const notifRef = doc(db, "users", workerId, "notifications", notifId);
    const snap = await tx.get(notifRef);
    if (!snap.exists() || snap.data().read === true) {
      return;
    }
    tx.update(notifRef, {
      read: true,
      readAt: serverTimestamp()
    });
  });
}

export async function markAllNotificationsRead(workerId: string) {
  const db = getFirebaseDb();
  const unreadSnap = await getDocs(
    query(collection(db, "users", workerId, "notifications"), where("read", "==", false))
  );

  let updated = 0;
  for (let i = 0; i < unreadSnap.docs.length; i += WRITE_CHUNK_SIZE) {
    const chunk = unreadSnap.docs.slice(i, i + WRITE_CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const item of chunk) {
      batch.update(item.ref, {
        read: true,
        readAt: serverTimestamp()
      });
    }
    await batch.commit();
    updated += chunk.length;
  }

  return updated;
}

export async function getApplicationThread(applicationId: string) {
  const db = getFirebaseDb();
  const snap = await getDoc(doc(db, "applicationThreads", applicationId));
  if (!snap.exists()) return null;
  return withId<ApplicationThreadDoc>(snap.id, snap.data());
}

export async function listApplicationThreadsForUser(params: {
  uid: string;
  role: UserRole;
  max?: number;
}) {
  const db = getFirebaseDb();
  const field = params.role === "worker" ? "workerId" : "employerId";
  const q = query(
    collection(db, "applicationThreads"),
    where(field, "==", params.uid),
    orderBy("lastMessageAt", "desc"),
    limit(params.max ?? 100)
  );
  const snap = await getDocs(q);
  return snap.docs.map((item) => withId<ApplicationThreadDoc>(item.id, item.data()));
}

export async function listThreadMessages(applicationId: string, max = 200) {
  const db = getFirebaseDb();
  const q = query(
    collection(db, "applicationThreads", applicationId, "messages"),
    orderBy("createdAt", "asc"),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map((item) => withId<ThreadMessageDoc>(item.id, item.data()));
}

export async function sendMessage(applicationId: string, senderId: string, text: string) {
  const cleanText = text.trim();
  if (!cleanText) {
    throw new Error("Message text is required");
  }

  const db = getFirebaseDb();
  await runTransaction(db, async (tx) => {
    const threadRef = doc(db, "applicationThreads", applicationId);
    const threadSnap = await tx.get(threadRef);
    if (!threadSnap.exists()) {
      throw new Error("Thread not found");
    }

    const thread = threadSnap.data() as ApplicationThreadDoc;
    if (thread.workerId !== senderId && thread.employerId !== senderId) {
      throw new Error("Sender is not part of this thread");
    }

    appendThreadMessageInTransaction({
      tx,
      applicationId,
      senderId,
      text: cleanText,
      type: "text"
    });
  });
}

export function listenMessages(
  applicationId: string,
  onData: (messages: Array<ThreadMessageDoc & { id: string }>) => void,
  onError?: (error: Error) => void,
  max = 200
): Unsubscribe {
  const db = getFirebaseDb();
  const q = query(
    collection(db, "applicationThreads", applicationId, "messages"),
    orderBy("createdAt", "asc"),
    limit(max)
  );

  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((item) => withId<ThreadMessageDoc & { id: string }>(item.id, item.data())));
    },
    (error) => {
      if (onError) onError(error);
    }
  );
}

export async function markThreadAsRead(applicationId: string, readerUid: string, max = 300) {
  const db = getFirebaseDb();
  const threadRef = doc(db, "applicationThreads", applicationId);
  const threadSnap = await getDoc(threadRef);
  if (!threadSnap.exists()) {
    throw new Error("Thread not found");
  }

  const thread = threadSnap.data() as ApplicationThreadDoc;
  if (thread.workerId !== readerUid && thread.employerId !== readerUid) {
    throw new Error("Reader is not part of this thread");
  }

  const messagesSnap = await getDocs(
    query(
      collection(db, "applicationThreads", applicationId, "messages"),
      orderBy("createdAt", "desc"),
      limit(max)
    )
  );

  const batch = writeBatch(db);
  let changed = 0;
  for (const messageDoc of messagesSnap.docs) {
    const data = messageDoc.data() as ThreadMessageDoc;
    if (data.readBy?.[readerUid]) continue;
    batch.update(messageDoc.ref, {
      [`readBy.${readerUid}`]: true
    });
    changed += 1;
  }

  batch.set(
    threadRef,
    {
      lastReadAtBy: {
        [readerUid]: serverTimestamp()
      }
    },
    { merge: true }
  );
  await batch.commit();
  return changed;
}

export function formatTimestamp(value: unknown) {
  const date = toDateOrNull(value);
  if (!date) return "-";

  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

export function getDefaultSkillPentagon() {
  return { ...DEFAULT_SKILL_PENTAGON };
}
