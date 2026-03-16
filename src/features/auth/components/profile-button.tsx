"use client";

import { useEffect, useState } from "react";
import { getCurrentUserProfile, type UserProfile } from "@/features/auth/services/get-current-user-profile";

export function ProfileButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleOpen() {
    setIsOpen(true);

    // Avoid refetching every time if we already have the data
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
        className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition duration-200 hover:scale-105 hover:bg-white/15"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4"
          onClick={handleClose}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/15 bg-[#111111] p-6 text-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/10">
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
                <p className="text-sm text-white/65">
                  Your account details and access level
                </p>
              </div>
            </div>

            {isLoading ? (
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-5 text-sm text-white/75">
                Loading profile...
              </div>
            ) : (
              <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
                <ProfileRow
                  label="First Name"
                  value={profile?.first_name ?? "—"}
                />
                <ProfileRow
                  label="Last Name"
                  value={profile?.last_name ?? "—"}
                />
                <ProfileRow
                  label="Email ID"
                  value={profile?.email_id ?? "—"}
                />
                <ProfileRow
                  label="Role"
                  value={profile?.role ?? "—"}
                />
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-xl bg-white px-5 py-2.5 text-sm font-medium text-black transition duration-200 hover:scale-105"
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
    <div className="flex flex-col gap-1 rounded-lg border border-white/8 bg-black/20 px-3 py-2.5">
      <span className="text-xs uppercase tracking-[0.18em] text-white/45">
        {label}
      </span>
      <span className="text-sm text-white">{value}</span>
    </div>
  );
}