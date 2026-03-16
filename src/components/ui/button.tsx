import { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-full border border-white bg-white px-5 py-2 text-sm font-medium text-black transition duration-200 ease-out hover:scale-105 hover:bg-white hover:text-black hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100",
        className
      )}
      {...props}
    />
  );
}