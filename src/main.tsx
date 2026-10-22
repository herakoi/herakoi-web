import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import "./globals.css";
import { startLocaleSync } from "./i18n";

startLocaleSync();

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
