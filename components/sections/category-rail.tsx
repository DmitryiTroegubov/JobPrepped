"use client";

import { useState } from "react";
import { motion } from "framer-motion";

export function CategoryRail({ categories }: { categories: string[] }) {
  const [active, setActive] = useState(categories[0]);

  return (
    <section className="sticky top-[72px] z-30 mt-5 border-y border-white/10 bg-bg/85 py-3 backdrop-blur">
      <div className="scrollbar-hide overflow-x-auto px-4 md:px-6">
        <motion.div drag="x" dragConstraints={{ left: -550, right: 0 }} className="flex w-max gap-2">
          {categories.map((item) => (
            <button
              key={item}
              onClick={() => setActive(item)}
              className={
                active === item
                  ? "rounded-full bg-white px-4 py-2 text-sm font-semibold text-black"
                  : "rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/75 transition hover:bg-white/10"
              }
            >
              {item}
            </button>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
