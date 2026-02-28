"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { getUserProfile } from "@/lib/auth";
import { listWorkers } from "@/lib/marketplace";
import { Header } from "@/components/sections/header";
import { Footer } from "@/components/sections/footer";
import type { UserDoc } from "@/lib/types";

const CATEGORY_FILTERS = ["All", "Frontend", "Backend", "UI/UX Design", "Copywriting", "Video Editing"];

export default function DiscoverWorkersPage() {
    const [workers, setWorkers] = useState<Array<UserDoc & { id: string }>>([]);
    const [loading, setLoading] = useState(true);

    const [searchQuery, setSearchQuery] = useState("");
    const [activeCategory, setActiveCategory] = useState("All");

    useEffect(() => {
        async function loadData() {
            try {
                setLoading(true);
                const fetched = await listWorkers(100);
                setWorkers(fetched);
            } catch (error) {
                console.error("Failed to load workers:", error);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, []);

    const filteredWorkers = useMemo(() => {
        return workers.filter((worker) => {
            const q = searchQuery.toLowerCase();
            const matchesSearch =
                (worker.name?.toLowerCase() || "").includes(q) ||
                (worker.displayName?.toLowerCase() || "").includes(q) ||
                (worker.title?.toLowerCase() || "").includes(q) ||
                (worker.bio?.toLowerCase() || "").includes(q);

            const workerSkills = worker.hardSkills || [];
            const matchesCategory =
                activeCategory === "All" ||
                workerSkills.some(skill => skill.toLowerCase() === activeCategory.toLowerCase()) ||
                worker.title?.toLowerCase().includes(activeCategory.toLowerCase());

            return matchesSearch && matchesCategory;
        });
    }, [workers, searchQuery, activeCategory]);

    return (
        <main className="min-h-screen bg-[#0D0D0D] text-white">
            <Header />

            <div className="mx-auto max-w-[1200px] px-5 pb-24 pt-32 md:px-8">
                <header className="mb-10 text-center md:mb-16">
                    <h1 className="text-4xl font-black tracking-tight text-white md:text-6xl">Hire top rising talent.</h1>
                    <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-500 md:text-xl">
                        Browse verified developers, designers, and creators hand-picked for your next project.
                    </p>
                </header>

                {/* Filter Bar */}
                <div className="flex flex-col gap-4 rounded-3xl bg-[#1A1A1A] p-4 md:flex-row md:items-center">
                    <div className="flex flex-1 items-center gap-3 rounded-full bg-[#0D0D0D] px-6 py-4">
                        <Search className="h-5 w-5 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Search by name, title, or skills..."
                            className="w-full bg-transparent text-lg text-white placeholder-gray-600 outline-none"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 px-2 md:px-0 scrollbar-hide">
                        {CATEGORY_FILTERS.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={`whitespace-nowrap px-6 py-3 rounded-full text-sm font-semibold transition-all ${activeCategory === cat
                                    ? "bg-white text-black"
                                    : "bg-[#2A2A2A] text-gray-400 hover:text-white"
                                    }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Talent Grid */}
                <div className="mt-12">
                    {loading ? (
                        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
                            {[1, 2, 3, 4, 5, 6].map(i => (
                                <div key={i} className="flex flex-col gap-5 rounded-3xl bg-[#1A1A1A] p-8">
                                    <div className="flex items-start gap-4">
                                        <div className="h-20 w-20 animate-pulse rounded-full bg-[#2A2A2A]" />
                                        <div className="flex flex-col gap-2">
                                            <div className="h-6 w-32 animate-pulse rounded bg-[#2A2A2A]" />
                                            <div className="h-4 w-24 animate-pulse rounded bg-[#2A2A2A]" />
                                        </div>
                                    </div>
                                    <div className="h-4 w-full animate-pulse rounded bg-[#2A2A2A]" />
                                    <div className="h-4 w-2/3 animate-pulse rounded bg-[#2A2A2A]" />
                                    <div className="mt-auto h-14 w-full animate-pulse rounded-full bg-[#2A2A2A]" />
                                </div>
                            ))}
                        </div>
                    ) : filteredWorkers.length > 0 ? (
                        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
                            {filteredWorkers.map(worker => {
                                const name = worker.displayName || worker.name || "Anonymous";
                                const title = worker.title || "Rising Talent";
                                const statsCompleted = worker.jobsCompleted || 0;
                                const activeSkills = (worker.hardSkills || []).slice(0, 3);
                                const extraSkillsCount = Math.max(0, (worker.hardSkills || []).length - 3);

                                return (
                                    <Link
                                        key={worker.id}
                                        href={`/profile?id=${worker.id}`}
                                        className="group relative flex cursor-pointer flex-col gap-5 rounded-3xl bg-[#1A1A1A] p-8 transition-transform duration-300 hover:scale-[1.02]"
                                    >
                                        <div className="absolute right-6 top-6 flex items-center gap-2">
                                            <span className="flex items-center gap-1.5 rounded-full bg-green-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-green-500">
                                                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
                                                Available
                                            </span>
                                        </div>

                                        <div className="flex items-end gap-5">
                                            <div className="relative -mt-4 h-20 w-20 shrink-0 overflow-hidden rounded-full border-4 border-[#0D0D0D] bg-[#2A2A2A]">
                                                {worker.photoURL ? (
                                                    <img src={worker.photoURL} alt={name} className="h-full w-full object-cover" />
                                                ) : (
                                                    <div className="flex h-full w-full items-center justify-center text-xl font-bold text-gray-400">
                                                        {name.charAt(0)}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-col pb-1">
                                                <h3 className="text-2xl font-bold text-white tracking-tight">{name}</h3>
                                                <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">{title}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 text-sm font-bold text-gray-300">
                                            <svg className="h-4 w-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                            </svg>
                                            {worker.rating ? worker.rating.toFixed(1) : "New"}
                                            <span className="text-gray-500 ml-1">({statsCompleted} jobs completed)</span>
                                        </div>

                                        {worker.bio && (
                                            <p className="text-gray-400 italic text-sm">
                                                "{worker.bio.substring(0, 80)}{worker.bio.length > 80 ? "..." : ""}"
                                            </p>
                                        )}

                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {activeSkills.length > 0 ? (
                                                activeSkills.map(skill => (
                                                    <span key={skill} className="rounded-full bg-[#2A2A2A] px-3 py-1 text-xs font-semibold text-white">
                                                        {skill}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="rounded-full bg-[#2A2A2A] px-3 py-1 text-xs font-semibold text-gray-500">
                                                    Ready to work
                                                </span>
                                            )}

                                            {extraSkillsCount > 0 && (
                                                <span className="rounded-full bg-[#2A2A2A] px-3 py-1 text-xs font-semibold text-gray-400">
                                                    +{extraSkillsCount}
                                                </span>
                                            )}
                                        </div>

                                        <div className="mt-auto w-full text-center rounded-full bg-white py-4 font-black text-black transition-colors hover:bg-gray-200">
                                            View Profile
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
                            <h3 className="text-2xl font-bold text-white">No talent found</h3>
                            <p className="mt-2 text-gray-500">Try adjusting your search filters or categories.</p>
                            <button
                                onClick={() => { setSearchQuery(""); setActiveCategory("All"); }}
                                className="mt-6 rounded-full bg-[#2A2A2A] px-6 py-3 font-semibold text-white hover:bg-[#333]"
                            >
                                Clear Filters
                            </button>
                        </div>
                    )}
                </div>
            </div>
            <Footer />
        </main>
    );
}
