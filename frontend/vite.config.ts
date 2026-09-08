import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "icons/*.png", "og-image.png"],
      manifest: {
        name: "Mellow Music",
        short_name: "Mellow",
        description: "Community-first, ad-free music — discover, play and save your mixes. No logins, no paywalls.",
        theme_color: "#171719",
        background_color: "#171719",
        display: "standalone",
        scope: "/",
        start_url: "/",
        icons: [
          { src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cdn-images\.dzcdn\.net\/.*/i,
            handler: "CacheFirst",
            options: { cacheName: "dz-images", expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 3600 } },
          },
          {
            urlPattern: /^https:\/\/api\.deezer\.com\/.*/i,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "dz-api", expiration: { maxEntries: 100, maxAgeSeconds: 3600 } },
          },
        ],
      },
    }),
  ],
  server: {
    watch: {
      // Skip audio files: they can be locked by other apps and crash the watcher.
      ignored: ["**/*.mp3"],
    },
  },
});
