"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { registerWithEmail } from "@/lib/auth";
import { toAuthErrorMessage } from "@/lib/firebase-error";
import type { UserRole } from "@/lib/types";

export default function RegisterScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("worker");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await registerWithEmail({ email, password, name, role });
      router.replace(role === "worker" ? "/marketplace" : "/employer");
    } catch (e) {
      setError(toAuthErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Create Account"
      subtitle="Set your identity and role to unlock the dashboard"
      footer={
        <>
          Already have an account? <Link href="/login" className="font-semibold text-white">Sign in</Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <label className="block">
          <span className="mb-1 block text-xs text-white/70">Name</span>
          <input
            className="w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-2.5 outline-none ring-0 transition focus:border-white/35"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-white/70">Email</span>
          <input
            className="w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-2.5 outline-none ring-0 transition focus:border-white/35"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-white/70">Password</span>
          <input
            className="w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-2.5 outline-none ring-0 transition focus:border-white/35"
            type="password"
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        <div>
          <span className="mb-2 block text-xs text-white/70">Role</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setRole("worker")}
              className={
                role === "worker"
                  ? "rounded-full bg-white px-3 py-2 text-sm font-semibold text-black"
                  : "rounded-full border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/75"
              }
            >
              worker
            </button>
            <button
              type="button"
              onClick={() => setRole("employer")}
              className={
                role === "employer"
                  ? "rounded-full bg-white px-3 py-2 text-sm font-semibold text-black"
                  : "rounded-full border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/75"
              }
            >
              employer
            </button>
          </div>
        </div>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-60"
        >
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}
