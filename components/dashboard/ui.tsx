"use client";

import type { ReactNode } from "react";
import { Header } from "@/components/sections/header";
import { cn } from "@/components/ui/cn";
import type { ApplicationStatus, JobStatus } from "@/lib/types";

type DashboardShellProps = {
  badge: string;
  title: ReactNode;
  description: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
};

export function DashboardShell({
  badge,
  title,
  description,
  actions,
  meta,
  children
}: DashboardShellProps) {
  return (
    <main className="min-h-screen">
      <Header />

      <div className="mx-auto w-full max-w-7xl px-4 pb-12 pt-24 md:px-6 md:pt-28">
        <section className="rounded-[2rem] border border-white/10 bg-surface-1/90 p-6 shadow-glow backdrop-blur-md md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <span className="inline-flex rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/70">
                {badge}
              </span>
              <h1 className="mt-4 text-3xl font-black tracking-tight md:text-4xl">{title}</h1>
              <p className="mt-2 text-sm text-white/65 md:text-base">{description}</p>
            </div>

            <div className="space-y-3">{meta}</div>
          </div>

          {actions ? <div className="mt-5 flex flex-wrap gap-2">{actions}</div> : null}
        </section>

        <div className="mt-6 space-y-6">{children}</div>
      </div>
    </main>
  );
}

type PanelProps = {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function DashboardPanel({ title, description, action, className, children }: PanelProps) {
  return (
    <section className={cn("rounded-3xl border border-white/10 bg-surface-1/80 p-5 shadow-glow md:p-6", className)}>
      {(title || description || action) ? (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title ? <h2 className="text-xl font-bold tracking-tight">{title}</h2> : null}
            {description ? <p className="mt-1 text-sm text-white/60">{description}</p> : null}
          </div>
          {action}
        </div>
      ) : null}

      {children}
    </section>
  );
}

type StatCardProps = {
  label: string;
  value: string;
  hint?: string;
  className?: string;
};

export function StatCard({ label, value, hint, className }: StatCardProps) {
  return (
    <article className={cn("rounded-2xl border border-white/10 bg-black/20 p-4", className)}>
      <p className="text-xs uppercase tracking-wide text-white/55">{label}</p>
      <p className="mt-1 text-2xl font-black tracking-tight">{value}</p>
      {hint ? <p className="mt-1 text-xs text-white/50">{hint}</p> : null}
    </article>
  );
}

const STATUS_CLASS: Record<JobStatus | ApplicationStatus, string> = {
  open: "border-emerald-300/45 bg-emerald-300/15 text-emerald-200",
  in_review: "border-amber-300/45 bg-amber-300/15 text-amber-200",
  closed: "border-white/25 bg-white/10 text-white/70",
  pending: "border-sky-300/45 bg-sky-300/15 text-sky-200",
  hired: "border-emerald-300/45 bg-emerald-300/15 text-emerald-200",
  sent: "border-sky-300/45 bg-sky-300/15 text-sky-200",
  viewed: "border-indigo-300/45 bg-indigo-300/15 text-indigo-200",
  accepted: "border-emerald-300/45 bg-emerald-300/15 text-emerald-200",
  rejected: "border-rose-300/45 bg-rose-300/15 text-rose-200",
  submitted: "border-cyan-300/45 bg-cyan-300/15 text-cyan-200",
  completed: "border-violet-300/45 bg-violet-300/15 text-violet-200"
};

type StatusPillProps = {
  status: JobStatus | ApplicationStatus;
};

export function StatusPill({ status }: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
        STATUS_CLASS[status]
      )}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

export const dashboardInputClass =
  "w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-white/45 focus:border-white/40 focus:bg-black/40";

export const dashboardTextareaClass = cn(dashboardInputClass, "min-h-24");

export const dashboardSelectClass = dashboardInputClass;
