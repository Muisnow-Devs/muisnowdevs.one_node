import { and, eq } from "drizzle-orm";
import db from "@/infrastructure/db/client.server";
import { cached } from "@/infrastructure/storage/cache.server";
import { absoluteUrl } from "./site";
import { renderSitemap } from "./xml";

export async function getSitemap() {
    return cached("seo:sitemap:v1", 300, async () => {
        const [articles, downloads] = await Promise.all([
            db.query.articles.findMany({
                where: (table) => eq(table.enabled, true),
                columns: { id: true, updatedAt: true },
                orderBy: (table, { asc }) => asc(table.id),
            }),
            db.query.downloadableFiles.findMany({
                where: (table) =>
                    and(eq(table.enabled, true), eq(table.lifecycle, "active")),
                columns: { id: true, updatedAt: true },
                orderBy: (table, { asc }) => asc(table.id),
            }),
        ]);
        return renderSitemap([
            ...["/", "/article", "/about", "/privacy"]
                .map(absoluteUrl)
                .map((url) => ({ url })),
            ...articles.map((article) => ({
                url: absoluteUrl(`/article/${article.id}`),
                lastModified: article.updatedAt,
            })),
            ...downloads.map((download) => ({
                lastModified: download.updatedAt,
                url: absoluteUrl(
                    `/download/${encodeURIComponent(download.id)}`,
                ),
            })),
        ]);
    });
}
