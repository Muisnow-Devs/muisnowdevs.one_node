import { createHash } from "node:crypto";

export function sitemapResponse(request: Request, xml: string): Response {
    const etag = `"${createHash("sha256").update(xml).digest("hex")}"`;
    const headers = {
        "Content-Type": "application/xml; charset=utf-8",
        // Redis owns freshness; downstream caches must revalidate the derived representation.
        "Cache-Control": "public, max-age=0, must-revalidate",
        ETag: etag,
    };
    const validators = request.headers
        .get("If-None-Match")
        ?.split(",")
        .map((value) => value.trim().replace(/^W\//, ""));
    const unchanged = validators?.some(
        (value) => value === "*" || value === etag,
    );
    return new Response(unchanged || request.method === "HEAD" ? null : xml, {
        status: unchanged ? 304 : 200,
        headers,
    });
}
