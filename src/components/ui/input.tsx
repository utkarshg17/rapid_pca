import { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "w-full rounded-2xl border border-white/15 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-white",
        className
      )}
      {...props}
    />
  );
}