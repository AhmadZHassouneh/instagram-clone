import type { NextConfig } from "next";

// DEMO_EXPORT=1 builds the static GitHub Pages demo (see .github/workflows/pages.yml):
// plain files under NEXT_PUBLIC_BASE_PATH, with the API answered in the browser from demo/.
const demo = process.env.DEMO_EXPORT === "1";

const nextConfig: NextConfig = {
  // Hide the floating "N" dev badge; compile and runtime errors still show.
  devIndicators: false,
  // Let phones on the same network use the dev server (iPhone hotspot and home Wi-Fi addresses).
  allowedDevOrigins: ["172.20.10.*", "192.168.*.*"],
  // pdf.js loads its worker from a path next to its own files, so it must not be bundled.
  serverExternalPackages: ["pdfjs-dist"],
  ...(demo && {
    output: "export",
    basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
    trailingSlash: true,
    images: { unoptimized: true },
    // Only .tsx pages and layouts: drops the server-only API route files (route.ts).
    pageExtensions: ["tsx"],
  }),
};

export default nextConfig;
