import type { Config } from "@react-router/dev/config";

import { vercelPreset } from "@vercel/react-router/vite";

declare module "react-router" {
  interface Future {
    unstable_middleware: true;
  }
}

export default {
  ssr: true,
  async prerender() {
    return [
      "/legal/terms-of-service",
      "/legal/privacy-policy",
      "/sitemap.xml",
      "/robots.txt",
    ];
  },
  presets: [
    ...(process.env.VERCEL_ENV === "production" ? [vercelPreset()] : []),
  ],
} satisfies Config;
