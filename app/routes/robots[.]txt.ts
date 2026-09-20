import { absoluteUrl } from "@/features/seo/site";

export function loader() {
    return new Response(`User-agent: *\nAllow: /\nDisallow: /dashboard\nDisallow: /backend/\n\nSitemap: ${absoluteUrl("/sitemap.xml")}\n`, {
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=300" },
    });
}
