import basicSsl from "@vitejs/plugin-basic-ssl";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import electron from "vite-plugin-electron/simple";

const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const isElectron = process.env.ELECTRON === "1";
const isCapacitor = process.env.CAPACITOR === "1";
const isNative = isElectron || isCapacitor;
const base = isNative ? "./" : repoName ? `/${repoName}/` : "/";
const https = process.env.HTTPS === "1";

export default defineConfig({
  base,
  plugins: [
    react(),
    ...(https ? [basicSsl()] : []),
    ...(isElectron
      ? [
          electron({
            main: { entry: "electron/main.ts" },
            preload: { input: "electron/preload.ts" },
          }),
        ]
      : []),
  ],
  server: {
    host: true,
  },
});
