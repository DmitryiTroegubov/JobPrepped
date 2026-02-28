"use client";

import { useEffect, useState, type FormEvent } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { createOrUpdateRoleProfile } from "@/lib/auth";
import { getFirebaseAuth, hasFirebaseConfig } from "@/lib/firebase";
import { toAuthErrorMessage } from "@/lib/firebase-error";
import type { UserRole } from "@/lib/types";

export default function CompleteProfileScreen() {
  const router = useRouter();
  const [uid, setUid] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("worker");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!hasFirebaseConfig()) {
      router.replace("/login");
      return;
    }

    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }
      setUid(user.uid);
      setEmail(user.email ?? "");
      setName(user.displayName ?? "");
    });

    return () => unsub();
  }, [router]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await createOrUpdateRoleProfile({ uid, email, name, role });
      router.replace(role === "worker" ? "/marketplace" : "/employer");
    } catch (e) {
      setError(toAuthErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-surface-1 p-6 md:p-8">
        <p className="text-xs font-semibold text-white/60">Profile Setup</p>
        <h1 className="mt-2 text-3xl font-extrabold">Complete your profile</h1>
        <p className="mt-2 text-sm text-white/60">Finalize your name and role to open the right workspace.</p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className="block">
            <span className="mb-1 block text-xs text-white/70">Email</span>
            <input
              className="w-full rounded-2xl border border-white/15 bg-black/20 px-4 py-2.5 text-white/70"
              value={email}
              readOnly
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-white/70">Name</span>
            <input
              className="w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-2.5 outline-none transition focus:border-white/35"
              value={name}
              onChange={(e) => setName(e.target.value)}
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
            disabled={loading || !uid}
            className="w-full rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-60"
          >
            {loading ? "Saving..." : "Save profile"}
          </button>
        </form>
      </section>
    </main>
  );
}
