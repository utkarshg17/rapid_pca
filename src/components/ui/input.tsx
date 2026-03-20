import { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "w-full rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--placeholder)] focus:border-[var(--border-strong)]",
        className
      )}
      {...props}
    />
  );
}
