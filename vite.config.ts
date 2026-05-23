// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { nitro } from "nitro/vite";

// Default build target stays aligned with the current Cloudflare-style hosting.
// For Vercel, build with DEPLOY_TARGET=vercel to switch to Nitro/Vercel output.
const deployTarget = process.env.DEPLOY_TARGET;
const isVercelTarget = deployTarget === "vercel";

export default defineConfig({
  cloudflare: isVercelTarget ? false : undefined,
  tanstackStart: {
    server: { entry: "server" },
  },
  plugins: isVercelTarget ? [nitro({ preset: "vercel" })] : [],
});
