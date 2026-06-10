import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";

import { buildInfo } from "@/lib/build-info";
import { AppPermissionsProvider } from "@/lib/permissions-provider";

import * as TanstackQuery from "./lib/providers/query-provider";
import { getRouter, routerContext } from "./router";
import "./index.css";

console.log("Uptime Zero build", buildInfo);

const router = getRouter();

const rootElement = document.getElementById("root")!;

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);

  root.render(
    <StrictMode>
      <TanstackQuery.Provider {...routerContext}>
        <AppPermissionsProvider>
          <RouterProvider router={router} />
        </AppPermissionsProvider>
      </TanstackQuery.Provider>
    </StrictMode>,
  );
}
