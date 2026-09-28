import { useQuery } from "@tanstack/react-query";
import { PermixProvider } from "permix/react";
import { useEffect, type ReactNode } from "react";

import { getPermissionRules, permix } from "@/lib/permissions";
import { sessionQueryOptions } from "@/lib/queries/auth";

export function AppPermissionsProvider({ children }: { children: ReactNode }) {
  // Mounted above the router, outside any suspense boundary.
  const session = useQuery(sessionQueryOptions());
  const role = session.data?.user?.role === "admin" ? "admin" : "user";

  useEffect(() => {
    permix.setup(getPermissionRules(role));
  }, [role]);

  return <PermixProvider permix={permix}>{children}</PermixProvider>;
}
