"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/sections/header";
import { getUserProfile } from "@/lib/auth";
import { toAuthErrorMessage } from "@/lib/firebase-error";
import { getFirebaseAuth, hasFirebaseConfig } from "@/lib/firebase";
import {
  handleApproveAndPay,
  handleHire,
  handleSubmitWork,
  listenApplicationById,
  getApplicationThread,
  getJobById,
  listenMessages,
  markThreadAsRead,
  sendMessage,
  toContractStatus
} from "@/lib/marketplace";
import type { ApplicationDoc, ApplicationThreadDoc, ThreadMessageDoc, UserDoc } from "@/lib/types";

type MessageItem = ThreadMessageDoc & { id: string };

export default function ApplicationChatPage() {
  const params = useParams<{ applicationId: string }>();
  const router = useRouter();

  const [profile, setProfile] = useState<UserDoc | null>(null);
  const [thread, setThread] = useState<ApplicationThreadDoc | null>(null);
  const [application, setApplication] = useState<ApplicationDoc | null>(null);
  const [jobTitle, setJobTitle] = useState("Task conversation");
  const [jobRewardJP, setJobRewardJP] = useState(0);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedRating, setSelectedRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hasFirebaseConfig()) {
      router.replace("/login");
      return;
    }

    const auth = getFirebaseAuth();
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
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

        setProfile(userProfile);

        const threadDoc = await getApplicationThread(params.applicationId);
        if (!threadDoc) {
          throw new Error("Application thread not found");
        }

        if (threadDoc.workerId !== user.uid && threadDoc.employerId !== user.uid) {
          throw new Error("Access denied");
        }

        setThread(threadDoc);
        const jobData = await getJobById(threadDoc.jobId);
        setJobTitle(jobData?.title?.trim() || "Task conversation");
        setJobRewardJP(Number(jobData?.rewardJP ?? 0));
        await markThreadAsRead(params.applicationId, user.uid);
      } catch (e) {
        setError(toAuthErrorMessage(e));
      } finally {
        setLoading(false);
      }
    });

    return () => unsubAuth();
  }, [router, params.applicationId]);

  useEffect(() => {
    if (!profile || !thread) {
      return;
    }

    const unsub = listenMessages(
      params.applicationId,
      (items) => {
        setMessages(items);
      },
      (listenError) => {
        setError(toAuthErrorMessage(listenError));
      }
    );

    return () => unsub();
  }, [profile, thread, params.applicationId]);

  useEffect(() => {
    if (!thread) {
      return;
    }

    const unsub = listenApplicationById(
      params.applicationId,
      (next) => setApplication(next),
      (listenError) => setError(toAuthErrorMessage(listenError))
    );

    return () => unsub();
  }, [thread, params.applicationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const backHref = useMemo(() => {
    if (!thread || !profile) {
      return "/";
    }

    if (profile.role === "worker") {
      return "/marketplace?tab=applications";
    }

    return `/employer/jobs/${thread.jobId}/applications/${thread.applicationId}`;
  }, [thread, profile]);

  const contractStatus = useMemo(() => toContractStatus(application?.status), [application?.status]);

  const onHireWorker = async () => {
    if (!profile || profile.role !== "employer") {
      return;
    }

    setIsProcessing(true);
    setError("");
    try {
      await handleHire({
        applicationId: params.applicationId,
        employerId: profile.uid
      });
    } catch (err) {
      setError(toAuthErrorMessage(err));
    } finally {
      setIsProcessing(false);
    }
  };

  const onSubmitWork = async () => {
    if (!profile || profile.role !== "worker") {
      return;
    }

    const link = window.prompt("Paste your submission URL", "https://");
    if (link === null) {
      return;
    }

    const cleanLink = link.trim();
    if (!cleanLink) {
      setError("Submission link is required.");
      return;
    }

    setIsProcessing(true);
    setError("");
    try {
      await handleSubmitWork({
        applicationId: params.applicationId,
        workerId: profile.uid,
        submissionLink: cleanLink
      });
    } catch (err) {
      setError(toAuthErrorMessage(err));
    } finally {
      setIsProcessing(false);
    }
  };

  const onApproveAndPay = async () => {
    if (!profile || profile.role !== "employer") {
      return;
    }
    if (!selectedRating) {
      setError("Please select a rating before approving payment.");
      return;
    }

    setIsProcessing(true);
    setError("");
    try {
      const reward = await handleApproveAndPay({
        applicationId: params.applicationId,
        employerId: profile.uid,
        rating: selectedRating,
        review: reviewText
      });
      setJobRewardJP(reward);
      setSelectedRating(0);
      setHoverRating(0);
      setReviewText("");
    } catch (err) {
      setError(toAuthErrorMessage(err));
    } finally {
      setIsProcessing(false);
    }
  };

  const onSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile || !text.trim()) {
      return;
    }

    setSending(true);
    setError("");
    try {
      await sendMessage(params.applicationId, profile.uid, text);
      setText("");
      await markThreadAsRead(params.applicationId, profile.uid);
    } catch (err) {
      setError(toAuthErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0D0D0D] text-white">
        <Header />
        <div className="mx-auto flex min-h-[60vh] w-full max-w-6xl items-center justify-center px-4 pb-10 pt-28 md:px-8">
          <div className="rounded-3xl bg-[#1A1A1A] px-8 py-6 text-sm text-white/70">Loading chat...</div>
        </div>
      </main>
    );
  }

  if (!profile || !thread) {
    return (
      <main className="min-h-screen bg-[#0D0D0D] text-white">
        <Header />
        <div className="mx-auto w-full max-w-6xl px-4 pb-10 pt-24 md:px-8 md:pt-28">
          <section className="rounded-3xl bg-[#1A1A1A] p-10">
            <h1 className="text-3xl font-black tracking-tight md:text-4xl">Thread unavailable</h1>
            <p className="mt-3 text-sm text-white/60 md:text-base">
              This chat is missing or you do not have access.
            </p>
            {error ? <p className="mt-5 text-sm text-rose-300">{error}</p> : null}
            <div className="mt-8">
              <Link
                href={backHref}
                className="inline-flex rounded-full bg-white/10 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                Back
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0D0D0D] text-white">
      <Header />
      <div className="mx-auto w-full max-w-6xl px-4 pb-10 pt-24 md:px-8 md:pt-28">
        <section className="flex h-[calc(100vh-9rem)] min-h-[620px] flex-col rounded-3xl bg-[#1A1A1A] p-8 md:p-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black tracking-tight md:text-4xl">{jobTitle}</h1>
              <p className="mt-2 text-sm text-white/55 md:text-base">Direct chat between Worker and Employer</p>
            </div>
            <Link
              href={backHref}
              className="inline-flex shrink-0 rounded-full bg-white/10 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
            >
              Back
            </Link>
          </div>

          <div className="mb-6 mt-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-[#2A2A2A] p-6">
            <p className="text-sm text-white/75 md:text-base">
              {contractStatus === "pending" && profile.role === "employer"
                ? "Reviewing applicant."
                : null}
              {contractStatus === "pending" && profile.role === "worker"
                ? "Application sent. Waiting for employer to hire you."
                : null}
              {contractStatus === "hired" && profile.role === "employer" ? "Work in progress." : null}
              {contractStatus === "hired" && profile.role === "worker" ? "You are hired! Deliver your work." : null}
              {contractStatus === "submitted" && profile.role === "employer"
                ? "Work submitted for review."
                : null}
              {contractStatus === "submitted" && profile.role === "worker"
                ? "Work submitted. Waiting for approval and payment."
                : null}
              {contractStatus === "completed" ? "🎉 Task Completed successfully." : null}
            </p>

            {contractStatus === "pending" && profile.role === "employer" ? (
              <button
                type="button"
                onClick={onHireWorker}
                disabled={isProcessing}
                className="rounded-full bg-white px-8 py-3 text-sm font-bold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isProcessing ? "Processing..." : "Hire Worker"}
              </button>
            ) : null}

            {contractStatus === "hired" && profile.role === "worker" ? (
              <button
                type="button"
                onClick={onSubmitWork}
                disabled={isProcessing}
                className="rounded-full bg-white px-8 py-3 text-sm font-bold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isProcessing ? "Processing..." : "Submit Work"}
              </button>
            ) : null}

            {contractStatus === "submitted" && profile.role === "employer" ? (
              <div className="w-full max-w-xl rounded-3xl bg-[#222222] p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-white/45">Rate Worker</p>
                <div className="mt-2 flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const active = star <= (hoverRating || selectedRating);
                    return (
                      <button
                        key={star}
                        type="button"
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        onClick={() => setSelectedRating(star)}
                        className={`transition ${active ? "text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.45)]" : "text-gray-600 hover:text-yellow-400"}`}
                        aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
                      >
                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-7 w-7">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.176 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.719c-.783-.57-.38-1.81.588-1.81h3.462a1 1 0 00.95-.69l1.07-3.292z" />
                        </svg>
                      </button>
                    );
                  })}
                  <span className="ml-2 text-sm text-white/65">
                    {selectedRating ? `${selectedRating}/5 selected` : "Select 1-5"}
                  </span>
                </div>
                <input
                  type="text"
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="Optional short review"
                  maxLength={300}
                  className="mt-3 w-full rounded-2xl bg-[#2A2A2A] px-4 py-2 text-sm text-white placeholder:text-white/40 outline-none"
                />
                <button
                  type="button"
                  onClick={onApproveAndPay}
                  disabled={isProcessing || selectedRating < 1}
                  className="mt-3 rounded-full bg-emerald-300 px-8 py-3 text-sm font-bold text-black transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isProcessing ? "Processing..." : `Approve & Pay ${jobRewardJP} JP Points`}
                </button>
              </div>
            ) : null}
          </div>

          {error ? (
            <div className="mb-4 rounded-2xl bg-rose-500/12 px-4 py-3 text-sm text-rose-200">{error}</div>
          ) : null}

          <div className="flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full flex-col gap-4 pb-2">
              {messages.length === 0 ? (
                <p className="mt-6 text-center text-sm text-white/45">
                  No messages yet. Start the conversation when you are ready.
                </p>
              ) : null}

              {messages.map((message) => {
                const mine = message.senderId === profile.uid;
                const isSystem = message.type === "system";

                if (isSystem) {
                  return (
                    <p key={message.id} className="my-4 text-center text-sm text-gray-500">
                      {message.text}
                    </p>
                  );
                }

                return (
                  <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[70%] whitespace-pre-wrap px-6 py-3 text-sm leading-relaxed ${
                        mine
                          ? "rounded-2xl rounded-br-sm bg-white/10 text-white"
                          : "rounded-2xl rounded-bl-sm bg-[#2A2A2A] text-white"
                      }`}
                    >
                      {message.text}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {contractStatus === "completed" ? (
            <div className="mt-6 rounded-full bg-[#2A2A2A] px-6 py-4 text-center text-sm text-white/55">
              Chat closed
            </div>
          ) : (
            <form onSubmit={onSend} className="mt-6">
              <div className="flex items-center gap-2 rounded-full bg-[#2A2A2A] p-2">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Write a message..."
                  className="min-w-0 flex-1 bg-transparent px-6 py-3 text-base text-white placeholder:text-white/45 outline-none"
                />
                <button
                  type="submit"
                  disabled={sending || !text.trim()}
                  className="rounded-full bg-white px-8 py-3 text-sm font-bold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {sending ? "Sending..." : "Send"}
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
