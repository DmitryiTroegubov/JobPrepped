# Firebase Marketplace MVP Mechanics (React + Firebase v9)

## Firestore Schema Tree

```text
users/{uid}
  uid, email, name, role("worker"|"employer"), displayName, avatarUrl
  jobPreppedBalance
  currentStreakDays, longestStreakDays, lastActiveDate("YYYY-MM-DD"), streakFreezeTokens
  completedJobsCount, rating
  createdAt, updatedAt
  myJobs/{jobId}
    jobId, title, category, rewardJP, status, applicantsCount, createdAt, updatedAt
  myApplications/{applicationId}
    applicationId, jobId, jobTitle, employerId, employerName, status, createdAt, updatedAt
  activity/{activityId}
    type("APPLY_JOB"|"SUBMIT_WORK"|"COMPLETE_JOB"|"STUDY_TASK"), refId, createdAt, dayKey
  favorites/{employerId}
    employerId, employerName, createdAt
  notifications/{notifId}
    type("NEW_JOB"), workerId, employerId, jobId, title, createdAt, read, readAt

jobs/{jobId}
  employerId, employerName, title, description, category, requiredSkills[]
  level, rewardJP, duration, deadlineAt, locationType, city, attachments[]
  status("open"|"in_review"|"closed"), applicantsCount, searchKeywords[]
  createdAt, updatedAt

applications/{applicationId}
  jobId, employerId, workerId, workerName
  message, links[], rewardJP, proposedDeliveryAt
  status("sent"|"viewed"|"accepted"|"rejected"|"submitted"|"completed")
  acceptedAt, submittedAt, completedAt
  employerRating, ratedAt
  createdAt, updatedAt

workers/{uid}
  skills[], city, portfolioUrl
  completedJobsCount, acceptedApplicationsCount, submissionsCount
  avgEmployerRating, ratingsCount
  onTimeRate, responseRate
  totalEarnedJP, weeklyEarnedJP
  skillPentagon{quality, speed, reliability, communication, consistency}
  createdAt, updatedAt

employers/{uid}
  companyName, companyDescription, website, createdAt, updatedAt
  followers/{workerId}
    workerId, createdAt

applicationThreads/{applicationId}
  applicationId, jobId, employerId, workerId
  createdAt, lastMessageAt, lastMessageText, lastReadAtBy{uid: timestamp}
  messages/{messageId}
    senderId, text, createdAt, readBy{uid: true}, type("text"|"system")
```

## Skill Pentagon Formulas (0..100)

```text
Quality      = clamp(round((avgEmployerRating / 5) * 100))
Speed        = clamp(round(onTimeRate * 100))
Reliability  = clamp(round((completedJobsCount / max(acceptedApplicationsCount,1)) * 100))
Communication= clamp(round(responseRate * 100))
Consistency  = clamp(round((min(currentStreakDays,30)/30)*70 + (min(longestStreakDays,60)/60)*30))
```

Where:
- `onTimeRate = onTimeCompletedCount / completedJobsCount`
- `responseRate = submissionsCount / acceptedApplicationsCount`
- `clamp` bounds values into `[0,100]`

## Event Flows (Plain Text)

### Worker applies to job

```text
applyToJob ->
  applications/{applicationId} create(status=sent, rewardJP snapshot)
  jobs/{jobId}.applicantsCount +1
  users/{employerId}/myJobs/{jobId}.applicantsCount +1
  users/{workerId}/myApplications/{applicationId} create
  applicationThreads/{applicationId} create + first system message
  recordActivity(workerId, APPLY_JOB, applicationId)
  recomputeWorkerStats(workerId)
```

### Employer accepts/rejects/views application

```text
updateApplicationStatus ->
  applications/{applicationId}.status update (+acceptedAt when accepted)
  users/{workerId}/myApplications/{applicationId}.status update
  if accepted:
    jobs/{jobId}.status = in_review
    users/{employerId}/myJobs/{jobId}.status = in_review
    workers/{workerId}.acceptedApplicationsCount +1
  append system message to thread
  recomputeWorkerStats(workerId)
```

### Worker submits work

```text
updateApplicationStatus(submitted by worker) ->
  applications/{applicationId}.status=submitted, submittedAt set
  workers/{workerId}.submissionsCount +1
  recordActivity(workerId, SUBMIT_WORK, applicationId)
  append system message
  recomputeWorkerStats(workerId)
```

### Employer completes job + settlement

```text
completeApplicationAndSettleJP ->
  applications/{applicationId}.status=completed, completedAt set
  users/{workerId}/myApplications/{applicationId}.status=completed
  jobs/{jobId}.status=closed
  users/{employerId}/myJobs/{jobId}.status=closed
  users/{employerId}.jobPreppedBalance -= rewardJP
  users/{workerId}.jobPreppedBalance += rewardJP, completedJobsCount +1
  workers/{workerId}.completedJobsCount +1, totalEarnedJP +rewardJP, weeklyEarnedJP +rewardJP
  recordActivity(workerId, COMPLETE_JOB, applicationId)
  append system message
  recomputeWorkerStats(workerId)
```

### Employer publishes new job (open)

```text
createJob ->
  jobs/{jobId} + users/{employerId}/myJobs/{jobId}
  query employers/{employerId}/followers/*
  batch fan-out users/{workerId}/notifications/* (chunked <=450 writes/batch)
```

## Core Queries

```text
Top 100 leaderboard:
  users where role=="worker"
  orderBy jobPreppedBalance desc
  orderBy currentStreakDays desc
  orderBy completedJobsCount desc
  limit 100

Weekly leaderboard (MVP):
  same query as top leaderboard

Worker notifications:
  users/{workerId}/notifications orderBy createdAt desc
  unread count: users/{workerId}/notifications where read==false (count)

Worker favorites:
  users/{workerId}/favorites orderBy createdAt desc

Application chat threads for worker:
  applicationThreads where workerId==uid orderBy lastMessageAt desc

Application chat threads for employer:
  applicationThreads where employerId==uid orderBy lastMessageAt desc

Messages in a thread:
  applicationThreads/{applicationId}/messages orderBy createdAt asc
```

## FCM Topic Strategy (Optional)

```text
Topic per employer: employer_{employerId}
Worker favorites employer -> client subscribes to employer_{employerId}
Unfavorite -> unsubscribe
Job publish -> Cloud Function sends topic message + keeps Firestore in-app notification write
```

## MVP UI Screens List

1. Leaderboard
2. Profile + Skill Pentagon
3. Favorite Employers
4. Notifications (with unread badge + mark as read)
5. Application Chat (thread per application)
