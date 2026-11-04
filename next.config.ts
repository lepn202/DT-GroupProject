import type { NextConfig } from "next";

// Cache Components is off: every page reads the signed-in user's session and is rendered per request.
const nextConfig: NextConfig = {
  // Local Supabase redirects to 127.0.0.1:3000; let the dev server serve its resources there too.
  allowedDevOrigins: ["127.0.0.1"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
