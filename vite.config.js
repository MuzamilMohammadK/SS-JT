import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Base path: "/" for Firebase Hosting, "/SS-JT/" for GitHub Pages.
// Set VITE_BASE_PATH in your CI environment / .env to override.
const base = process.env.VITE_BASE_PATH ?? "/";

// https://vite.dev/config/
export default defineConfig({
  // ── Base URL ─────────────────────────────────────────────────
  base,

  plugins: [
    react(),
    VitePWA({
      // Auto-update service worker silently in the background
      registerType: "autoUpdate",

      // Include only the small resized icons in precache
      includeAssets: [
        "favicon-32.png",
        "icon-192.png",
        "icon-512.png",
        "icon-maskable.png",
      ],

      // Web App Manifest — controls how the app appears when installed
      manifest: {
        id: base,
        name: "Shivaayaha Silks & Jari Trades",
        short_name: "SS Ledger",
        description:
          "Professional Ledger Management — Track accounts receivable, accounts payable, and inventory transactions.",
        theme_color: "#0f172a",
        background_color: "#0f172a",
        display: "standalone",
        orientation: "portrait-primary",
        scope: base,
        start_url: base,
        lang: "en",
        categories: ["finance", "business", "productivity"],
        icons: [
          {
            src: `${base}icon-192.png`,
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: `${base}icon-512.png`,
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: `${base}icon-maskable.png`,
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        shortcuts: [
          {
            name: "Parties",
            short_name: "Parties",
            description: "Manage customers & suppliers",
            url: `${base}parties`,
            icons: [{ src: `${base}icon-192.png`, sizes: "192x192" }],
          },
          {
            name: "Ledger Entry",
            short_name: "Ledger",
            description: "Record a new transaction",
            url: `${base}ledger`,
            icons: [{ src: `${base}icon-192.png`, sizes: "192x192" }],
          },
        ],
      },

      // Workbox service worker options
      workbox: {
        // Only cache JS, CSS, HTML, small icons
        globPatterns: ["**/*.{js,css,html,ico,svg,woff,woff2}"],

        // Set a higher limit for cached files (PWA icons can be up to 3MB)
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,

        // Runtime caching strategies
        runtimeCaching: [
          // Serve icon images at runtime (not precached)
          {
            urlPattern: /\/icon-.*\.png$/,
            handler: "CacheFirst",
            options: {
              cacheName: "icons-cache",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Cache Google Fonts stylesheet
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
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

      // Dev options
      devOptions: {
        enabled: true,
        type: "module",
      },
    }),
  ],
});
