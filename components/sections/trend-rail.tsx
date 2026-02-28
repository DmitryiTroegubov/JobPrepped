"use client";

import { motion } from "framer-motion";
import { TrendingPill } from "@/components/ui/trending-pill";

type TrendRailProps = {
  items: Array<{ title: string; meta: string }>;
};

export function TrendRail({ items }: TrendRailProps) {
  return (
    <section className="px-4 md:px-6">
      <div className="scrollbar-hide overflow-x-auto">
        <motion.div drag="x" dragConstraints={{ left: -600, right: 0 }} className="flex w-max gap-3 pb-2">
          {items.map((item) => (
            <TrendingPill key={item.title} title={item.title} meta={item.meta} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
