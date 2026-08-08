export interface MultipartPart {
    ETag: string;
    PartNumber: number;
}

export interface PartsPage {
    parts: MultipartPart[];
    nextMarker?: string;
    isTruncated: boolean;
}

// ListParts returns at most 1000 parts per page. A file large enough to need more
// parts than that would otherwise fail the completion count check after every
// byte has already been uploaded.
export async function collectMultipartParts(
    fetchPage: (marker?: string) => Promise<PartsPage>,
): Promise<MultipartPart[]> {
    const collected: MultipartPart[] = [];
    let marker: string | undefined = undefined;
    let truncated = true;

    while (truncated) {
        const page = await fetchPage(marker);
        collected.push(...page.parts);
        marker = page.nextMarker;
        truncated = page.isTruncated && marker !== undefined;
    }

    return collected.sort((first, second) => first.PartNumber - second.PartNumber);
}
