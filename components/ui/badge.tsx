type BadgeProps = {
  type: "pro" | "max";
};

export function Badge({ type }: BadgeProps) {
  if (type === "max") {
    return (
      <span className="rounded-full bg-neon-gradient px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-black">
        Max
      </span>
    );
  }

  return (
    <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/80">
      Pro
    </span>
  );
}
