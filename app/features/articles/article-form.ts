export interface ArticleInput {
    title: string;
    description: string;
    content: string;
    comment: boolean;
    enabled: boolean;
    labelIds: string[];
}

export function getSelectedLabelIds(formData: FormData): string[] {
    return [
        ...new Set(
            formData
                .getAll("labelIds")
                .filter((value): value is string => typeof value === "string")
                .map((value) => value.trim())
                .filter(Boolean),
        ),
    ];
}

export function parseArticleInput(formData: FormData): ArticleInput {
    const input = {
        title: String(formData.get("title") ?? "").trim(),
        description: String(formData.get("description") ?? "").trim(),
        content: String(formData.get("content") ?? ""),
        comment: formData.get("comment") === "on",
        enabled: formData.get("enabled") === "on",
        labelIds: getSelectedLabelIds(formData),
    };

    if (!input.title || !input.description || !input.content) {
        throw new Response("Missing required fields", { status: 400 });
    }

    return input;
}
