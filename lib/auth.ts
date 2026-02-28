import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User
} from "firebase/auth";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  type DocumentData
} from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase";
import type { EmployerDoc, UserDoc, UserRole, WorkerDoc } from "@/lib/types";

const defaultSkillPentagon = {
  quality: 0,
  speed: 0,
  reliability: 0,
  communication: 0,
  consistency: 0
};

const defaultWorkerStats = {
  completedJobsCount: 0,
  acceptedApplicationsCount: 0,
  submissionsCount: 0,
  avgEmployerRating: 0,
  ratingsCount: 0,
  onTimeRate: 0,
  responseRate: 0,
  totalEarnedJP: 0,
  weeklyEarnedJP: 0,
  skillPentagon: defaultSkillPentagon
};

export async function createOrUpdateRoleProfile(params: {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
}) {
  const { uid, email, name, role } = params;
  const db = getFirebaseDb();
  const userRef = doc(db, "users", uid);
  const existing = await getDoc(userRef);

  if (existing.exists()) {
    const existingData = existing.data();
    const currentBalance =
      (existingData.jpBalance as number | undefined) ??
      (existingData.jobPreppedBalance as number | undefined) ??
      0;

    await updateDoc(userRef, {
      email,
      name,
      displayName: name,
      title: (existingData.title as string | undefined) ?? "",
      photoURL:
        (existingData.photoURL as string | undefined) ??
        (existingData.avatarUrl as string | undefined) ??
        "",
      bio: (existingData.bio as string | undefined) ?? "",
      coverUrl: (existingData.coverUrl as string | undefined) ?? "",
      socials:
        typeof existingData.socials === "object" && existingData.socials !== null
          ? {
              github: String((existingData.socials as { github?: unknown }).github ?? ""),
              telegram: String((existingData.socials as { telegram?: unknown }).telegram ?? "")
            }
          : {
              github: "",
              telegram: ""
            },
      hardSkills: Array.isArray(existingData.hardSkills)
        ? (existingData.hardSkills as unknown[]).map((item) => String(item)).filter(Boolean)
        : [],
      portfolioProjects: Array.isArray(existingData.portfolioProjects)
        ? existingData.portfolioProjects
        : [],
      education: Array.isArray(existingData.education) ? existingData.education : [],
      role,
      jpBalance: currentBalance,
      jobPreppedBalance: currentBalance,
      avatarUrl:
        (existingData.avatarUrl as string | undefined) ??
        (existingData.photoURL as string | undefined) ??
        "",
      subscriptionTier: (existingData.subscriptionTier as string | undefined) ?? "",
      currentStreakDays: (existingData.currentStreakDays as number | undefined) ?? 0,
      longestStreakDays: (existingData.longestStreakDays as number | undefined) ?? 0,
      lastActiveDate: (existingData.lastActiveDate as string | undefined) ?? null,
      streakFreezeTokens: (existingData.streakFreezeTokens as number | undefined) ?? 0,
      completedJobsCount: (existingData.completedJobsCount as number | undefined) ?? 0,
      rating: (existingData.rating as number | undefined) ?? 0,
      updatedAt: serverTimestamp()
    });
  } else {
    const baseDoc: Omit<UserDoc, "createdAt" | "updatedAt"> = {
      uid,
      email,
      name,
      role,
      displayName: name,
      title: "",
      avatarUrl: "",
      photoURL: "",
      coverUrl: "",
      bio: "",
      socials: {
        github: "",
        telegram: ""
      },
      hardSkills: [],
      portfolioProjects: [],
      education: [],
      jpBalance: 0,
      jobPreppedBalance: 0,
      subscriptionTier: "",
      currentStreakDays: 0,
      longestStreakDays: 0,
      lastActiveDate: null,
      streakFreezeTokens: 0,
      completedJobsCount: 0,
      rating: 0
    };

    await setDoc(userRef, {
      ...baseDoc,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  if (role === "worker") {
    const workerDoc: WorkerDoc = {
      skills: [],
      city: "",
      portfolioUrl: "",
      ...defaultWorkerStats
    };

    await setDoc(
      doc(db, "workers", uid),
      {
        ...workerDoc,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      },
      { merge: true }
    );
  } else {
    const employerDoc: EmployerDoc = {
      companyName: "",
      companyDescription: "",
      website: ""
    };

    await setDoc(
      doc(db, "employers", uid),
      {
        ...employerDoc,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      },
      { merge: true }
    );
  }
}

export async function registerWithEmail(params: {
  email: string;
  password: string;
  name: string;
  role: UserRole;
}) {
  const { email, password, name, role } = params;
  const auth = getFirebaseAuth();

  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });

  await createOrUpdateRoleProfile({
    uid: cred.user.uid,
    email,
    name,
    role
  });

  return cred.user;
}

export async function loginWithEmail(email: string, password: string) {
  const auth = getFirebaseAuth();
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function signOutUser() {
  const auth = getFirebaseAuth();
  await signOut(auth);
}

export async function getUserRole(uid: string): Promise<UserRole | null> {
  const db = getFirebaseDb();
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) {
    return null;
  }
  const data = snap.data() as DocumentData;
  return (data.role as UserRole) ?? null;
}

export async function getUserProfile(uid: string) {
  const db = getFirebaseDb();
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) {
    return null;
  }

  const data = snap.data() as DocumentData;
  const balance = Number(data.jpBalance ?? data.jobPreppedBalance ?? 0);

  return {
    ...data,
    uid,
    title: typeof data.title === "string" ? data.title : "",
    bio: typeof data.bio === "string" ? data.bio : "",
    photoURL:
      typeof data.photoURL === "string" && data.photoURL.trim()
        ? data.photoURL
        : typeof data.avatarUrl === "string"
          ? data.avatarUrl
          : "",
    coverUrl: typeof data.coverUrl === "string" ? data.coverUrl : "",
    socials:
      typeof data.socials === "object" && data.socials !== null
        ? {
            github: String((data.socials as { github?: unknown }).github ?? ""),
            telegram: String((data.socials as { telegram?: unknown }).telegram ?? "")
          }
        : {
            github: "",
            telegram: ""
          },
    hardSkills: Array.isArray(data.hardSkills)
      ? (data.hardSkills as unknown[]).map((item) => String(item).trim()).filter(Boolean)
      : [],
    portfolioProjects: Array.isArray(data.portfolioProjects)
      ? (data.portfolioProjects as unknown[]).map((entry) => {
          const project = (entry ?? {}) as Record<string, unknown>;
          return {
            id: String(project.id ?? ""),
            title: String(project.title ?? ""),
            role: String(project.role ?? ""),
            description: String(project.description ?? ""),
            liveUrl: String(project.liveUrl ?? ""),
            codeUrl: String(project.codeUrl ?? ""),
            stack: Array.isArray(project.stack)
              ? (project.stack as unknown[]).map((item) => String(item).trim()).filter(Boolean)
              : []
          };
        })
      : [],
    education: Array.isArray(data.education)
      ? (data.education as unknown[]).map((entry) => {
          const item = (entry ?? {}) as Record<string, unknown>;
          return {
            id: String(item.id ?? ""),
            title: String(item.title ?? ""),
            subtitle: String(item.subtitle ?? "")
          };
        })
      : [],
    avatarUrl:
      typeof data.avatarUrl === "string" && data.avatarUrl.trim()
        ? data.avatarUrl
        : typeof data.photoURL === "string"
          ? data.photoURL
          : "",
    jpBalance: balance,
    jobPreppedBalance: balance,
    subscriptionTier: typeof data.subscriptionTier === "string" ? data.subscriptionTier : "",
    name:
      typeof data.name === "string" && data.name.trim()
        ? data.name
        : typeof data.displayName === "string" && data.displayName.trim()
          ? data.displayName
          : ""
  } as UserDoc;
}

export async function getWorkerProfile(uid: string) {
  const db = getFirebaseDb();
  const snap = await getDoc(doc(db, "workers", uid));
  return snap.exists() ? (snap.data() as WorkerDoc) : null;
}

export async function getEmployerProfile(uid: string) {
  const db = getFirebaseDb();
  const snap = await getDoc(doc(db, "employers", uid));
  return snap.exists() ? (snap.data() as EmployerDoc) : null;
}

export async function updateUserName(uid: string, name: string) {
  const db = getFirebaseDb();
  await updateDoc(doc(db, "users", uid), {
    name,
    displayName: name,
    updatedAt: serverTimestamp()
  });
}

export async function updateUserProfileIdentity(params: {
  uid: string;
  name: string;
  title: string;
  bio: string;
}) {
  const db = getFirebaseDb();
  await updateDoc(doc(db, "users", params.uid), {
    name: params.name,
    displayName: params.name,
    title: params.title,
    bio: params.bio,
    updatedAt: serverTimestamp()
  });
}

export async function updateUserBio(uid: string, bio: string) {
  const db = getFirebaseDb();
  await updateDoc(doc(db, "users", uid), {
    bio,
    updatedAt: serverTimestamp()
  });
}

export async function updateUserPhoto(uid: string, photoURL: string) {
  const db = getFirebaseDb();
  await updateDoc(doc(db, "users", uid), {
    photoURL,
    avatarUrl: photoURL,
    updatedAt: serverTimestamp()
  });
}

export async function updateUserCover(uid: string, coverUrl: string) {
  const db = getFirebaseDb();
  await updateDoc(doc(db, "users", uid), {
    coverUrl,
    updatedAt: serverTimestamp()
  });
}

export async function updateWorkerProfile(uid: string, payload: WorkerDoc) {
  const db = getFirebaseDb();
  await setDoc(
    doc(db, "workers", uid),
    {
      ...payload,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp()
    },
    { merge: true }
  );
}

export async function updateEmployerProfile(uid: string, payload: EmployerDoc) {
  const db = getFirebaseDb();
  await setDoc(
    doc(db, "employers", uid),
    {
      ...payload,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp()
    },
    { merge: true }
  );
}

export async function touchUserUpdatedAt(uid: string) {
  const db = getFirebaseDb();
  await updateDoc(doc(db, "users", uid), {
    updatedAt: serverTimestamp()
  });
}

export function assertSignedIn(user: User | null): user is User {
  return Boolean(user);
}
