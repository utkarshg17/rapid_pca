"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { signOut } from "@/features/auth/services/sign-out";

export function LogoutButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogout() {
    setIsLoading(true);

    try {
      await signOut();
      router.push("/");
      router.refresh();
    } catch {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isLoading}
      className="inline-flex items-center justify-center rounded-full border border-red-600 bg-red-600 px-5 py-2 text-sm font-medium text-white transition duration-200 ease-out hover:scale-105 hover:bg-red-600 hover:text-white hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
    >
      {isLoading ? "Logging out..." : "Logout"}
    </button>
  );
}