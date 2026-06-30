"use client";

import { createContext, useContext, useMemo } from "react";

import type { Permission } from "@auction/shared";

const PermissionsCtx = createContext<ReadonlySet<string>>(new Set());

/** Provides the current dashboard user's permission set to client components. */
export function PermissionsProvider({
  value,
  children,
}: {
  value: Permission[];
  children: React.ReactNode;
}) {
  const set = useMemo(() => new Set<string>(value), [value]);
  return <PermissionsCtx.Provider value={set}>{children}</PermissionsCtx.Provider>;
}

/**
 * Read the current user's permissions in a client component. `can(p)` gates the
 * visibility of menus / buttons / actions. This is cosmetic — the server action
 * is the real guard — but keeps controls a user can't use out of sight.
 */
export function usePermissions() {
  const set = useContext(PermissionsCtx);
  return {
    can: (perm: Permission) => set.has(perm),
    canAny: (...perms: Permission[]) => perms.some((p) => set.has(p)),
  };
}
