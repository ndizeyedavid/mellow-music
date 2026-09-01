import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    watch: {
      // Skip audio files: they can be locked by other apps and crash the watcher.
      ignored: ["**/*.mp3"],
    },
  },
});
