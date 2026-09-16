import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider } from "@clerk/chrome-extension";
import { App } from "./App";
import "./styles.css";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const SYNC_HOST = import.meta.env.VITE_CLERK_SYNC_HOST;

if (!PUBLISHABLE_KEY) {
  throw new Error("VITE_CLERK_PUBLISHABLE_KEY is not set — see apps/extension/.env.example");
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      syncHost={SYNC_HOST}
      // Without this, the side panel only picks up a session change made
      // on the web app after being closed and reopened (a known SDK
      // limitation). This listener refreshes it live instead.
      __experimental_syncHostListener
      afterSignOutUrl={SYNC_HOST}
    >
      <App />
    </ClerkProvider>
  </React.StrictMode>
);
