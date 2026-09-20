import assert from "node:assert/strict";
import test from "node:test";
import { renderSitemap } from "./xml";
import { sitemapResponse } from "./sitemap-response.server";

test("sitemap escapes XML and only includes known modification times", () => {
    const xml = renderSitemap([
        { url: 'https://example.com/?a=1&b=<"\'>', lastModified: null },
        { url: "https://example.com/article/2", lastModified: new Date("2026-09-19T00:00:00Z") },
    ]);
    assert.ok(xml.includes("&amp;b=&lt;&quot;&apos;&gt;"));
    assert.equal(xml.match(/<lastmod>/g)?.length, 1);
    assert.ok(xml.includes("2026-09-19T00:00:00.000Z"));
});

test("sitemap validators match the actual XML including weak conditional requests", async () => {
    const first = sitemapResponse(new Request("https://example.com/sitemap.xml"), "one");
    const etag = first.headers.get("ETag")!;
    const conditional = new Request("https://example.com/sitemap.xml", { headers: { "If-None-Match": `"old", W/${etag}` } });
    const unchanged = sitemapResponse(conditional, "one");
    assert.equal(unchanged.status, 304);
    assert.equal(await unchanged.text(), "");
    assert.equal(sitemapResponse(conditional, "two").status, 200);
    assert.equal(await sitemapResponse(new Request("https://example.com", { method: "HEAD" }), "one").text(), "");
});
