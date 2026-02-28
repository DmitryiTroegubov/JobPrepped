import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/components/ui/cn";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline";
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  const variants = {
    primary: "bg-white text-black hover:bg-white/90",
    ghost: "text-white/90 hover:bg-white/10",
    outline: "border border-white/20 bg-transparent text-white hover:border-white/40 hover:bg-white/5"
  };

  return (
    <button
      className={cn(
        "rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-300",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
