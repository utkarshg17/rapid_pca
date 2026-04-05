"use client";

import { type ReactNode } from "react";

type JobEstimateHierarchyNodeProps = {
  level: number;
  label: string;
  meta: string;
  isOpen: boolean;
  onToggle: () => void;
  badge?: string | string[];
  hideHeader?: boolean;
  children: ReactNode;
};

export function JobEstimateHierarchyNode({
  level,
  label,
  meta,
  isOpen,
  onToggle,
  badge,
  hideHeader = false,
  children,
}: JobEstimateHierarchyNodeProps) {
  const indent = Math.min(level * 18, 54);

  return (
    <div className="space-y-3 overflow-x-hidden min-w-0">
      {hideHeader ? null : (
        <div
          className="relative min-w-0"
          style={{
            marginLeft: level === 0 ? 0 : `${indent}px`,
            width: level === 0 ? "100%" : `calc(100% - ${indent}px)`,
          }}
        >
          {level > 0 ? (
            <span
              aria-hidden="true"
              className="absolute top-0 bottom-0 w-px bg-[var(--border)]"
              style={{ left: `${Math.max(-10, -indent + 8)}px` }}
            />
          ) : null}

          <button
            type="button"
            onClick={onToggle}
            className="relative flex w-full min-w-0 items-center justify-between gap-4 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] px-4 py-3 text-left transition duration-200 hover:cursor-pointer hover:border-[var(--border-strong)]"
          >
            <div className="flex min-w-0 items-center gap-3 overflow-hidden">
              <span className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--panel)] text-sm font-medium text-[var(--foreground)]">
                {isOpen ? "-" : "+"}
              </span>
              <div className="min-w-0 overflow-hidden">
                <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                  {label}
                </p>
                <p className="truncate text-xs uppercase tracking-[0.16em] text-[var(--subtle)]">
                  {meta}
                </p>
              </div>
            </div>

            {badge ? (
              <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-2">
                {(Array.isArray(badge) ? badge : [badge]).map((badgeValue) => (
                  <span
                    key={badgeValue}
                    className="inline-flex rounded-full border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-2.5 py-1 text-xs font-medium text-[var(--status-success-fg)]"
                  >
                    {badgeValue}
                  </span>
                ))}
              </div>
            ) : null}
          </button>
        </div>
      )}

      {isOpen ? <div className="min-w-0">{children}</div> : null}
    </div>
  );
}
