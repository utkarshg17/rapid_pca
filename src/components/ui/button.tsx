import { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-full border border-[var(--inverse-bg)] bg-[var(--inverse-bg)] px-5 py-2 text-sm font-medium text-[var(--inverse-fg)] transition duration-200 ease-out hover:scale-105 hover:cursor-pointer hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100",
        className
      )}
      {...props}
    />
  );
}
