export const PUBLIC_ARTICLE_PAGE_SIZE = 10;
export const DASHBOARD_ARTICLE_PAGE_SIZE = 20;

export function parseArticlePage(value: string | null): number {
    const page = Number(value);
    return Number.isSafeInteger(page) && page > 0 && page <= 214748364 ? page : 1;
}
