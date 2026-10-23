import { useQuery } from "@tanstack/react-query";

import { sessionQueryOptions } from "@/lib/api/auth";
import { type Capability, can } from "@/lib/permissions";

/**
 * Whether the signed-in user may perform an action, for hiding controls.
 * Server functions enforce the same table; this only shapes the UI.
 */
export function usePermissions() {
  const session = useQuery(sessionQueryOptions());
  const role = session.data?.user?.role ?? "user";

  return {
    isReady: session.isSuccess,
    check: (capability: Capability) => can(role, capability),
  };
}
