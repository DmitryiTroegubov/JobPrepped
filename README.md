# JobPrepped 2026 Rebuild

This project is a **Next.js + Firebase marketplace MVP** where:
- `worker` users browse jobs, apply, chat, track applications, keep streaks, favorite employers, and view leaderboards.
- `employer` users create jobs, review candidates, update statuses, and settle JP rewards.

The app is currently a **frontend-heavy MVP** with direct Firebase client access and Firestore security rules.

## Current Status

The project is functional as an MVP and includes:
- Authentication (email/password)
- Role-based dashboards (`worker` and `employer`)
- Job posting and browsing
- Applications lifecycle (sent -> viewed/accepted/rejected -> submitted -> completed)
- In-app per-application chat threads
- Favorites/followers and in-app `NEW_JOB` notifications
- Worker stats/streak tracking and leaderboard views
- Firestore indexes and rules prepared for these flows

## Tech Stack

- Next.js `15.1.6` (App Router)
- React `19`
- TypeScript
- Tailwind CSS
- Firebase Web SDK `11.x`:
  - Auth
  - Firestore

## Project Structure

- `app/` - route pages
  - Auth: `app/login/page.tsx`, `app/register/page.tsx`, `app/complete-profile/page.tsx`
  - Worker: `app/worker/**`
  - Employer: `app/employer/**`
  - Shared chat: `app/applications/[applicationId]/chat/page.tsx`
  - Profile: `app/profile/page.tsx`
- `lib/`
  - `lib/firebase.ts` - Firebase init/config
  - `lib/auth.ts` - auth/profile helpers
  - `lib/marketplace.ts` - main marketplace domain logic
  - `lib/types.ts` - domain types
  - `lib/firebase-error.ts` - user-facing Firebase error mapping
- `docs/marketplace-mvp-mechanics.md` - schema/flow mechanics reference
- `firestore.rules` - Firestore security rules
- `firestore.indexes.json` - required composite indexes

## Main Domain Flows Implemented

1. Employer creates job:
- writes to `jobs/{jobId}` and `users/{employerId}/myJobs/{jobId}`
- fans out notifications to followers (`users/{workerId}/notifications/*`)

2. Worker applies:
- creates `applications/{jobId_workerId}` (one application per worker per job)
- increments applicants counters
- creates `users/{workerId}/myApplications/{applicationId}`
- creates `applicationThreads/{applicationId}` + first system message
- records worker activity/streak update

3. Review and completion:
- employer can set `viewed/accepted/rejected`
- worker can set `submitted`
- employer can complete and settle JP
- worker stats are recomputed

4. Messaging:
- thread-per-application with message list and read markers

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env.local` from `.env.local.example` and set:
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

3. Run dev server:
```bash
npm run dev
```

4. Open:
- `http://localhost:3000/marketplace`

## Firebase Deployment Commands

```bash
npm run firebase:deploy:rules
npm run firebase:deploy:indexes
npm run firebase:deploy:firestore
```

## Known Issues and Problems (Current Reality)

### 1) Security model is weak for production
- Core business logic is executed from the client (`lib/marketplace.ts`) instead of trusted backend functions.
- Rules still permit owners to write broad parts of their own documents (`users/{uid}`, `workers/{uid}`), so a malicious client can alter fields that should be server-controlled.
- This is acceptable only for MVP/prototype; high risk for production.

### 2) Financial integrity gaps
- `completeApplicationAndSettleJP` does not enforce non-negative employer balance before payout.
- No escrow/hold model; funds are deducted only at completion.
- This creates risk of negative balances and inconsistent economics.

### 3) Multi-accept / multi-payout risk per job
- Current logic can allow multiple applications for the same job to be accepted and eventually completed.
- No hard invariant in rules/backend guarantees “exactly one winner per job”.
- This can lead to accidental multiple JP payouts for one job.

### 4) Firestore rules are permissive in places
- `users` read allows any signed-in user to read worker user docs.
- Rules on `applications` and related docs do not fully validate all business invariants at write time (job status, ownership relationships, amounts).
- Security depends heavily on honest clients.

### 5) Weekly leaderboard is not real weekly ranking yet
- `listWeeklyWorkersLeaderboard` currently reuses global leaderboard logic.
- Product label says weekly, but computation is not weekly-specific.

### 6) Scalability and cost concerns
- Notifications fan-out is direct Firestore writes (chunked by 450), no queue/worker.
- Stats recomputation scans worker applications (`recomputeWorkerStats`) and may become expensive at scale.
- Chat read marking is capped by limits and can miss very old unread messages.

### 7) UX / product consistency issues
- Mixed language strings (English + Russian error messages).
- “Employer mode is unchanged” note indicates uneven UI depth.
- Some screens rely on IDs rather than friendly names/details.

### 8) Quality and maintainability gaps
- No automated tests (unit/integration/e2e).
- No CI quality gates (lint/test/build pipelines).
- No server audit trail or admin moderation tools.

## Opportunities

1. Move critical writes to backend:
- Cloud Functions / Next.js server actions with Admin SDK for:
  - status transitions
  - payout settlement
  - stats aggregation
  - notification fan-out

2. Enforce hard invariants:
- one accepted/completed application per job
- employer balance checks before settlement
- immutable payout snapshot fields

3. Improve security rules:
- minimize owner-writable fields
- validate entity relationships on create/update
- reduce broad reads of user data

4. Add reliability features:
- idempotency keys for settlement actions
- transaction-level event logs
- retry-safe notification pipeline

5. Improve product depth:
- true weekly leaderboard from `workers.weeklyEarnedJP`
- pagination and virtualized lists
- better profile cards and employer discovery

6. Add engineering guardrails:
- test coverage for transitions and payouts
- emulator-based Firestore rules tests
- CI pipeline (`lint`, `typecheck`, tests, build)

## Recommended Next Milestones

1. **Security + Money safety pass** (highest priority)
2. **Backend migration for critical flows**
3. **Leaderboard/analytics correctness**
4. **Performance/pagination pass**
5. **Testing + CI hardening**

## Notes

- `docs/marketplace-mvp-mechanics.md` describes intended mechanics; implementation is mostly aligned but not fully hardened.
- This codebase is a strong MVP foundation, but it is **not production-safe yet** without security, invariants, and backend ownership improvements.
