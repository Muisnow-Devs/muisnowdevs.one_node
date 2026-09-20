export function parseDownloadForm(form: FormData) {
    const filename = form.get("filename");
    if (
        typeof filename !== "string" ||
        !filename.trim() ||
        filename.trim().length > 64
    )
        throw new Response("Filename must contain 1 to 64 characters", {
            status: 400,
        });
    return {
        filename: filename.trim(),
        description: String(form.get("description") || "") || null,
        enabled: form.get("enabled") === "true",
    };
}
