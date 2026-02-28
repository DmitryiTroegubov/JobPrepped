"use client";

import { motion } from "framer-motion";

type TrendingPillProps = {
  title: string;
  meta: string;
};

export function TrendingPill({ title, meta }: TrendingPillProps) {
  return (
    <motion.article
      whileHover={{ scale: 1.05 }}
      className="min-w-[260px] rounded-full border border-white/10 bg-white/5 px-5 py-3 backdrop-blur"
    >
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="text-xs text-white/55">{meta}</p>
    </motion.article>
  );
}
