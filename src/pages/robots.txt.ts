import type { APIRoute } from "astro";
import { site } from "../config/site";

// Generated from src/config/site.ts so the sitemap URL never drifts from
// the domain. Noindex pages (style-guide, jobber-connected) are left
// crawlable on purpose — the crawler needs to reach them to see their
// noindex meta tag; they're simply excluded from the sitemap instead.
const body = `User-agent: *
Allow: /

Sitemap: ${new URL("sitemap-index.xml", site.url).href}
`;

export const GET: APIRoute = () =>
  new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
