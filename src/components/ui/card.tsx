import { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type CardProps = {
  children: ReactNode;
  className?: string;
};

export function Card({ children, className }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-lg)]",
        className
      )}
    >
      {children}
    </div>
  );
}
