import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        oneChannel: resolve(__dirname, "one-channel.html"),
        threeChannel: resolve(__dirname, "three-channel.html"),
      },
    },
  },
});
