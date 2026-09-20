export { getSelectedLabelIds } from "@/features/articles/article-form";

export function updateDashboardArticleParams(
    current: URLSearchParams,
    key: string,
    value: string,
) {
    const next = new URLSearchParams(current);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    return next;
}
