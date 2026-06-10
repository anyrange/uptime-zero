import { PermixProvider } from "permix/react";
import { useEffect, type ReactNode } from "react";

import { getPermissionRules, permix } from "@/lib/permissions";
import { useSessionQuery } from "@/lib/queries/auth";

export function AppPermissionsProvider({ children }: { children: ReactNode }) {
  const session = useSessionQuery();
  const role = session.data?.user?.role === "admin" ? "admin" : "user";

  useEffect(() => {
    permix.setup(getPermissionRules(role));
  }, [role]);

  return <PermixProvider permix={permix}>{children}</PermixProvider>;
}
