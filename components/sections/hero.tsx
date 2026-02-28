import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="mx-auto max-w-4xl px-4 pb-16 pt-40 text-center md:px-6 md:py-24">
      <h1 className="text-balance text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-6xl lg:text-8xl">
        A new way to work
      </h1>
      <p className="mx-auto mt-5 max-w-3xl text-balance text-base text-gray-400 md:text-xl">
        Discover, connect, and work with the world&apos;s best independent creatives and clients. Browse
        1M+ independents.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link href="/discover">
          <Button className="px-6 py-3">Hire creatives</Button>
        </Link>
        <Link href="/marketplace">
          <Button variant="outline" className="px-6 py-3">Get hired</Button>
        </Link>
      </div>
    </section>
  );
}
