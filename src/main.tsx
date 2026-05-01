import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";

import * as TanstackQuery from "./lib/providers/query-provider";
import { getRouter, routerContext } from "./router";
import "./index.css";

const router = getRouter();

const rootElement = document.getElementById("root")!;

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);

  root.render(
    <StrictMode>
      <TanstackQuery.Provider {...routerContext}>
        <RouterProvider router={router} />
      </TanstackQuery.Provider>
    </StrictMode>,
  );
}
