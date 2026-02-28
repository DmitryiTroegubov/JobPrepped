export type UserRole = "worker" | "employer";

export type UserSocials = {
  github: string;
  telegram: string;
};

export type PortfolioProject = {
  id: string;
  title: string;
  role: string;
  description: string;
  liveUrl: string;
  codeUrl: string;
  stack: string[];
};

export type EducationItem = {
  id: string;
  title: string;
  subtitle: string;
};

export type UserDoc = {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  displayName?: string;
  title?: string;
  avatarUrl?: string;
  photoURL?: string;
  coverUrl?: string;
  bio?: string;
  socials?: UserSocials;
  hardSkills?: string[];
  portfolioProjects?: PortfolioProject[];
  education?: EducationItem[];
  jpBalance?: number;
  jobPreppedBalance: number;
  subscriptionTier?: string;
  currentStreakDays?: number;
  longestStreakDays?: number;
  lastActiveDate?: string | null;
  streakFreezeTokens?: number;
  completedJobsCount?: number;
  jobsCompleted?: number;
  totalRatingPoints?: number;
  reviewCount?: number;
  rating?: number;
  // Employer Fields
  companyName?: string;
  industry?: string;
  website?: string;
  hiredCount?: number;
  totalJPAwarded?: number;

  createdAt: unknown;
  updatedAt: unknown;
};

export type SkillPentagon = {
  quality: number;
  speed: number;
  reliability: number;
  communication: number;
  consistency: number;
};

export type WorkerDoc = {
  skills: string[];
  city: string;
  portfolioUrl: string;
  completedJobsCount?: number;
  acceptedApplicationsCount?: number;
  submissionsCount?: number;
  avgEmployerRating?: number;
  ratingsCount?: number;
  onTimeRate?: number;
  responseRate?: number;
  totalEarnedJP?: number;
  weeklyEarnedJP?: number;
  skillPentagon?: SkillPentagon;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type EmployerDoc = {
  companyName: string;
  companyDescription: string;
  website: string;
};

export type JobLevel = "intern" | "junior" | "middle" | "senior" | "lead" | "any";

export type LocationType = "remote" | "onsite" | "hybrid";

export type JobStatus = "open" | "in_review" | "closed";

export type Attachment = {
  name: string;
  url: string;
};

export type JobDoc = {
  id: string;
  employerId: string;
  employerName: string;
  title: string;
  description: string;
  category: string;
  requiredSkills: string[];
  level: JobLevel;
  rewardJP: number;
  duration: string;
  deadlineAt: unknown | null;
  locationType: LocationType;
  city: string | null;
  attachments?: Attachment[];
  status: JobStatus;
  createdAt: unknown;
  updatedAt: unknown;
  applicantsCount: number;
  searchKeywords?: string[];
};

export type ApplicationStatus =
  | "pending"
  | "hired"
  | "sent"
  | "viewed"
  | "accepted"
  | "rejected"
  | "submitted"
  | "completed";

export type ApplicationDoc = {
  id: string;
  jobId: string;
  employerId: string;
  employerName?: string;
  workerId: string;
  workerName: string;
  message: string;
  links: string[];
  rewardJP?: number;
  proposedDeliveryAt: unknown | null;
  status: ApplicationStatus;
  acceptedAt?: unknown | null;
  submittedAt?: unknown | null;
  completedAt?: unknown | null;
  rating?: number | null;
  review?: string | null;
  employerRating?: number | null;
  ratedAt?: unknown | null;
  createdAt: unknown;
  updatedAt: unknown;
};

export type MyJobDoc = {
  jobId: string;
  title: string;
  category: string;
  rewardJP: number;
  status: JobStatus;
  applicantsCount: number;
  createdAt: unknown;
  updatedAt: unknown;
};

export type MyApplicationDoc = {
  applicationId: string;
  jobId: string;
  jobTitle: string;
  employerId: string;
  employerName: string;
  status: ApplicationStatus;
  createdAt: unknown;
  updatedAt: unknown;
};

export type CreateJobInput = {
  title: string;
  description: string;
  category: string;
  requiredSkills: string[];
  level: JobLevel;
  rewardJP: number;
  duration: string;
  deadlineAt: Date | null;
  locationType: LocationType;
  city: string | null;
  attachments?: Attachment[];
  searchKeywords?: string[];
};

export type ListJobsFilters = {
  category?: string;
  skill?: string;
  locationType?: LocationType;
};

export type ApplyToJobInput = {
  message: string;
  links: string[];
  proposedDeliveryAt: Date | null;
};

export type ActivityType = "APPLY_JOB" | "SUBMIT_WORK" | "COMPLETE_JOB" | "STUDY_TASK";

export type ActivityLogDoc = {
  type: ActivityType;
  refId: string;
  createdAt: unknown;
  dayKey: string;
};

export type LeaderboardWorker = {
  uid: string;
  displayName: string;
  avatarUrl: string;
  jobPreppedBalance: number;
  currentStreakDays: number;
  completedJobsCount: number;
  rating: number;
};

export type FavoriteEmployerDoc = {
  employerId: string;
  employerName: string;
  createdAt: unknown;
};

export type NotificationType = "NEW_JOB";

export type NotificationDoc = {
  type: NotificationType;
  workerId: string;
  employerId: string;
  jobId: string;
  title: string;
  createdAt: unknown;
  read: boolean;
  readAt?: unknown | null;
};

export type ApplicationThreadDoc = {
  applicationId: string;
  jobId: string;
  employerId: string;
  workerId: string;
  createdAt: unknown;
  lastMessageAt: unknown;
  lastMessageText: string;
};

export type ThreadMessageType = "text" | "system";

export type ThreadMessageDoc = {
  senderId: string;
  text: string;
  createdAt: unknown;
  readBy: Record<string, boolean>;
  type: ThreadMessageType;
};
