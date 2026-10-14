import type { NextConfig } from "next";

/**
 * Cache Components / Partial Prefetching are intentionally OFF: this app is
 * DB-backed with better-sqlite3 and must always render fresh data. See
 * docs/next16-notes.md sections 1 and 2 for the reasoning.
 */
const nextConfig: NextConfig = {
  // better-sqlite3 is a native module and pdfkit reads .afm font data from its
  // own directory at runtime - both must be required from node_modules instead
  // of being bundled, or Turbopack cannot trace their data files.
  serverExternalPackages: ["better-sqlite3", "pdfkit"],

  turbopack: {
    // There is another package-lock.json in the parent workspace folder; pin the
    // root to this project so Turbopack scans the right tree.
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
