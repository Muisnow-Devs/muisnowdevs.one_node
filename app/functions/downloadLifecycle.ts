export type DownloadLifecycle = "draft" | "active" | "disabled" | "deleting";

export function canFinalizeDownload(lifecycle: DownloadLifecycle) {
    return lifecycle === "draft";
}

export function canEditDownload(lifecycle: DownloadLifecycle) {
    return lifecycle === "active" || lifecycle === "disabled";
}

export function toggleDownloadLifecycle(lifecycle: DownloadLifecycle): DownloadLifecycle | null {
    if (lifecycle === "active")
        return "disabled";
    if (lifecycle === "disabled")
        return "active";
    return null;
}
