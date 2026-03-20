"use client";

import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { getProjectAccessUsers } from "@/features/projects/services/get-project-access-users";
import type { ProjectAccessUser } from "@/features/projects/types/project";

type ProjectAccessPanelProps = {
  projectId: number;
  currentUserRole: string | null;
};

export function ProjectAccessPanel({
  projectId,
  currentUserRole,
}: ProjectAccessPanelProps) {
  const [users, setUsers] = useState<ProjectAccessUser[]>([]);
  const [searchValue, setSearchValue] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState("");

  const canViewAccess = currentUserRole === "Admin";

  useEffect(() => {
    if (!canViewAccess) {
      setUsers([]);
      setIsLoading(false);
      return;
    }

    async function loadUsers() {
      setIsLoading(true);
      try {
        const accessUsers = await getProjectAccessUsers(projectId);
        setUsers(accessUsers);
      } catch (error) {
        console.error("Failed to load project access users:", error);
        setUsers([]);
      } finally {
        setIsLoading(false);
      }
    }

    loadUsers();
  }, [projectId, canViewAccess]);

  if (!canViewAccess) {
    return (
      <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)] p-8">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--subtle)]">
          Project Access
        </p>
        <h2 className="mt-4 text-3xl font-semibold">Access Restricted</h2>
        <p className="mt-4 max-w-2xl text-[var(--muted)]">
          You do not have access to view/edit access for this project. Please
          contact your system administrator for assistance.
        </p>
      </section>
    );
  }

  const normalizedSearch = searchValue.trim().toLowerCase();
  const filteredUsers = users.filter((user) => {
    if (!normalizedSearch) return true;

    return (user.first_name ?? "").toLowerCase().includes(normalizedSearch);
  });

  function handleAddUserClick() {
    setActionMessage("Add user flow will be wired in next.");
  }

  return (
    <section className="space-y-6 text-[var(--foreground)]">
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--subtle)]">
              Project Access
            </p>
            <h2 className="mt-2 text-2xl font-semibold">Access Directory</h2>
            <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
              This list includes all active Admin users automatically, along
              with any additional users linked to this project through project
              access.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
            <Input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search by first name"
              className="min-w-[220px]"
            />

            <button
              type="button"
              onClick={handleAddUserClick}
              className="rounded-full border border-[var(--inverse-bg)] bg-[var(--inverse-bg)] px-5 py-3 text-sm font-medium text-[var(--inverse-fg)] transition duration-200 hover:scale-105 hover:cursor-pointer"
            >
              Add User
            </button>
          </div>
        </div>

        {actionMessage ? (
          <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--muted)]">
            {actionMessage}
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)] p-6 text-sm text-[var(--muted)]">
          Loading project access...
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--panel-soft)] p-10 text-center">
          <h3 className="text-lg font-semibold">No users found</h3>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Try a different first name search to find a user with project
            access.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredUsers.map((user) => (
            <AccessUserCard key={user.id} user={user} />
          ))}
        </div>
      )}
    </section>
  );
}

function AccessUserCard({ user }: { user: ProjectAccessUser }) {
  const displayName = [user.first_name, user.last_name].filter(Boolean).join(" ");

  return (
    <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)] p-5 shadow-[var(--shadow-md)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">
            {displayName || user.email_id || "Unnamed User"}
          </h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {user.email_id ?? "No email available"}
          </p>
        </div>

        <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs text-[var(--muted)]">
          {user.role ?? "User"}
        </span>
      </div>
    </div>
  );
}
