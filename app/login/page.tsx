"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { loginWithEmail, getUserRole } from "@/lib/auth";
import { toAuthErrorMessage } from "@/lib/firebase-error";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const user = await loginWithEmail(email, password);
      const role = await getUserRole(user.uid);

      if (role === "worker") {
        router.replace("/marketplace");
      } else if (role === "employer") {
        router.replace("/employer");
      } else {
        router.replace("/complete-profile");
      }
    } catch (e) {
      setError(toAuthErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Welcome Back"
      subtitle="Sign in with your email and password"
      footer={
        <>
          No account yet? <Link href="/register" className="font-semibold text-white">Create one</Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={onSubmit}>
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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </AuthShell>
  );
}
