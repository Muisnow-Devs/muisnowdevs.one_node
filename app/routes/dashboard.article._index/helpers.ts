export function getSelectedLabelIds(formData: FormData) {
    return [...new Set(
        formData
            .getAll("labelIds")
            .filter((value): value is string => typeof value === "string")
            .map((value) => value.trim())
            .filter(Boolean)
    )];
}

export function updateDashboardArticleParams(
    current: URLSearchParams,
    key: string,
    value: string,
) {
    const next = new URLSearchParams(current);
    if (value)
        next.set(key, value);
    else
        next.delete(key);
    if (key !== "page")
        next.delete("page");
    return next;
}
