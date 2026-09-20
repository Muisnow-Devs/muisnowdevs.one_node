export interface SitemapEntry {
    url: string;
    lastModified?: Date | null;
}

function escapeXml(value: string): string {
    return value.replace(
        /[<>&"']/g,
        (character) =>
            ({
                "<": "&lt;",
                ">": "&gt;",
                "&": "&amp;",
                '"': "&quot;",
                "'": "&apos;",
            })[character]!,
    );
}

export function renderSitemap(entries: SitemapEntry[]): string {
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        entries
            .map(
                ({ url, lastModified }) =>
                    "  <url><loc>" +
                    escapeXml(url) +
                    "</loc>" +
                    (lastModified
                        ? `<lastmod>${lastModified.toISOString()}</lastmod>`
                        : "") +
                    "</url>",
            )
            .join("\n") +
        "\n</urlset>"
    );
}
