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
// would otherwise fail its completion check after every byte had already uploaded.
//
// Both guards below throw rather than returning a short list: the caller compares the
// returned count against the expected part count, so a silently truncated list looks
// exactly like an incomplete upload. A server that reports truncation while re-issuing
// a marker it already handed out would otherwise be re-fetched until the process died.
export async function collectMultipartParts(
    fetchPage: (marker?: string) => Promise<PartsPage>,
    maxParts: number,
): Promise<MultipartPart[]> {
    const collected: MultipartPart[] = [];
    const seenMarkers = new Set<string>();
    let marker: string | undefined = undefined;
    let truncated = true;

    while (truncated) {
        const page = await fetchPage(marker);
        collected.push(...page.parts);

        if (collected.length > maxParts)
            throw new Error(`ListParts returned more than ${maxParts} parts.`);

        marker = page.nextMarker;

        if (marker !== undefined) {
            if (seenMarkers.has(marker))
                throw new Error(`ListParts repeated the pagination marker "${marker}".`);
            seenMarkers.add(marker);
        }

        truncated = page.isTruncated && marker !== undefined;
    }

    return collected.sort((first, second) => first.PartNumber - second.PartNumber);
}
