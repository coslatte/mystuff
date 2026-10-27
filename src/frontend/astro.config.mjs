import { defineConfig, envField } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import vercel from "@astrojs/vercel";

export default defineConfig({
  // Canonical and og:image are absolute URLs, and Astro only knows the origin
  // from here.
  site: "https://cosmiclatte.dev",
  integrations: [
    react(),
    sitemap({
      // A sitemap that lists a noindex page asks for the opposite of what the
      // robots tag asks for.
      filter: (page) => !/\/(admin|forum|loading|share)\/?$/.test(page),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  server: {
    // 4321 falls inside the Windows excluded port range (4301-4400, reserved by
    // Hyper-V/WSL), which makes bind fail with EACCES. Override with PORT.
    port: Number(process.env.PORT ?? 5173),
  },
  // Typing the env here is what makes `import.meta.env.PUBLIC_API_URL` a
  // string instead of the `any` Vite falls back to, so a typo in .env is a
  // compile error rather than a runtime undefined. Defaults live here too, so
  // no module needs its own `?? fallback`.
  env: {
    schema: {
      PUBLIC_API_URL: envField.string({
        context: "client",
        access: "public",
        optional: true,
        default: "http://localhost:8080",
      }),
      GITHUB_TOKEN: envField.string({ context: "server", access: "secret", optional: true }),
    },
  },
  output: "static",
  adapter: vercel(),
  // The experiments moved under /experimentation when the sections split. Built
  // here rather than in vercel.json so the adapter owns them with everything else.
  redirects: {
    "/spectral": "/experimentation/spectral",
    "/subdivision": "/experimentation/subdivision",
  },
});
