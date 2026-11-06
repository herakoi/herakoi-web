import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import "./globals.css";
import { startLocaleSync } from "./i18n";
import { setServiceWorkerRegistration } from "./lib/pwa";

startLocaleSync();

if ("serviceWorker" in navigator) {
  import("virtual:pwa-register").then(({ registerSW }) =>
    registerSW({
      immediate: true,
      onRegisteredSW: (_url, registration) => setServiceWorkerRegistration(registration),
    }),
  );
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Expected #root to exist in index.html");
}

createRoot(rootElement).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
);
