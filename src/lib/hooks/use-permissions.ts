import { usePermix } from "permix/react";

import { permix } from "@/lib/permissions";

export function usePermissions() {
  return usePermix(permix);
}
