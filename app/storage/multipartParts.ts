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
//
// The page count guard covers what those two miss: a page that carries no parts at all
// but a fresh marker every call trips neither the part-count check nor the repeated-marker
// check, so no page shape can spin the loop forever. Its ceiling is one page beyond the
// part ceiling because a server returning a single part per page needs maxParts pages to
// reach the limit legitimately; the looser bound leaves the more specific part-count error
// to fire first and makes this purely a backstop.
export async function collectMultipartParts(
    fetchPage: (marker?: string) => Promise<PartsPage>,
    maxParts: number,
): Promise<MultipartPart[]> {
    const maxPages = maxParts + 1;
    const collected: MultipartPart[] = [];
    const seenMarkers = new Set<string>();
    let marker: string | undefined = undefined;
    let pagesFetched = 0;
    let truncated = true;

    while (truncated) {
        if (++pagesFetched > maxPages)
            throw new Error(`ListParts did not finish within ${maxPages} pages.`);

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
