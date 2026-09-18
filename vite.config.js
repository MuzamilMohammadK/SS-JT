import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Auto-update service worker silently in the background
      registerType: "autoUpdate",

      // Include these files in the service worker precache
      includeAssets: [
        "favicon.svg",
        "icon-192.png",
        "icon-512.png",
        "icon-maskable.png",
      ],

      // Web App Manifest — controls how the app appears when installed
      manifest: {
        id: "/",
        name: "Shivaayaha Silks & Jari Trades",
        short_name: "SS Ledger",
        description:
          "Professional Ledger Management — Track accounts receivable, accounts payable, and inventory transactions.",
        theme_color: "#0f172a",
        background_color: "#0f172a",
        display: "standalone",
        orientation: "portrait-primary",
        scope: "/",
        start_url: "/",
        lang: "en",
        categories: ["finance", "business", "productivity"],
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        shortcuts: [
          {
            name: "Dashboard",
            short_name: "Dashboard",
            description: "Open the ledger dashboard",
            url: "/",
            icons: [{ src: "/icon-192.png", sizes: "192x192" }],
          },
        ],
      },

      // Workbox service worker options
      workbox: {
        // Cache all JS, CSS, HTML, images, fonts
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],

        // Runtime caching strategies
        runtimeCaching: [
          // Cache Google Fonts stylesheet
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Cache Google Fonts files
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "gstatic-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Firebase SDK (network-first so auth state stays fresh)
          {
            urlPattern: /^https:\/\/.*\.firebaseio\.com\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "firebase-cache",
              networkTimeoutSeconds: 10,
            },
          },
        ],
      },

      // Dev options — shows SW in development for easier testing
      devOptions: {
        enabled: true,
        type: "module",
      },
    }),
  ],
});
