import type { ReactNode } from "react";
import Link from "next/link";

export function AuthShell({
  title,
  subtitle,
  children,
  footer
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_350px_at_10%_-10%,rgba(154,107,255,0.25),transparent),radial-gradient(700px_300px_at_95%_10%,rgba(35,231,255,0.18),transparent)]" />

      <section className="relative z-10 w-full max-w-md rounded-3xl border border-white/10 bg-surface-1/95 p-6 shadow-glow backdrop-blur-md md:p-8">
        <Link href="/" className="text-xs font-semibold text-white/60 hover:text-white">
          JobPrepped
        </Link>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-white/60">{subtitle}</p>

        <div className="mt-6">{children}</div>

        <div className="mt-6 border-t border-white/10 pt-4 text-sm text-white/60">{footer}</div>
      </section>
    </main>
  );
}
