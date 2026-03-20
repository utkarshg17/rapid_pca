"use client";

import { useEffect, useState } from "react";
import {
  getCurrentUserProfile,
  type UserProfile,
} from "@/features/auth/services/get-current-user-profile";

export function ProfileButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleOpen() {
    setIsOpen(true);

    // Avoid refetching every time if we already have the data.
    if (profile) return;

    setIsLoading(true);
    try {
      const userProfile = await getCurrentUserProfile();
      setProfile(userProfile);
    } catch (error) {
      console.error("Failed to load user profile:", error);
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  }

  function handleClose() {
    setIsOpen(false);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      window.addEventListener("keydown", onKeyDown);
    }

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-label="Open profile"
        className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] transition duration-200 hover:scale-105 hover:bg-[var(--surface-strong)]"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className="h-5 w-5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.418 0-8 2.239-8 5v1h16v-1c0-2.761-3.582-5-8-5Z"
          />
        </svg>
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] px-4"
          onClick={handleClose}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6 text-[var(--foreground)] shadow-[var(--shadow-lg)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)]">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="h-6 w-6"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.418 0-8 2.239-8 5v1h16v-1c0-2.761-3.582-5-8-5Z"
                  />
                </svg>
              </div>

              <div>
                <h2 className="text-lg font-semibold">User Profile</h2>
                <p className="text-sm text-[var(--muted)]">
                  Your account details and access level
                </p>
              </div>
            </div>

            {isLoading ? (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-5 text-sm text-[var(--muted)]">
                Loading profile...
              </div>
            ) : (
              <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <ProfileRow
                  label="First Name"
                  value={profile?.first_name ?? "N/A"}
                />
                <ProfileRow
                  label="Last Name"
                  value={profile?.last_name ?? "N/A"}
                />
                <ProfileRow
                  label="Email ID"
                  value={profile?.email_id ?? "N/A"}
                />
                <ProfileRow label="Role" value={profile?.role ?? "N/A"} />
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-xl bg-[var(--inverse-bg)] px-5 py-2.5 text-sm font-medium text-[var(--inverse-fg)] transition duration-200 hover:scale-105"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

type ProfileRowProps = {
  label: string;
  value: string;
};

function ProfileRow({ label, value }: ProfileRowProps) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-2.5">
      <span className="text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">
        {label}
      </span>
      <span className="text-sm text-[var(--foreground)]">{value}</span>
    </div>
  );
}
