import assert from "node:assert/strict";
import test from "node:test";
import { collectMultipartParts, PartsPage } from "./multipartParts";

test("collectMultipartParts returns a single page unchanged", async () => {
    const parts = await collectMultipartParts(async () => ({
        parts: [{ ETag: "a", PartNumber: 1 }, { ETag: "b", PartNumber: 2 }],
        isTruncated: false,
    }));

    assert.deepEqual(parts, [{ ETag: "a", PartNumber: 1 }, { ETag: "b", PartNumber: 2 }]);
});

test("collectMultipartParts follows the marker across pages", async () => {
    const pages: Record<string, PartsPage> = {
        "": { parts: [{ ETag: "a", PartNumber: 1 }], nextMarker: "1", isTruncated: true },
        "1": { parts: [{ ETag: "b", PartNumber: 2 }], nextMarker: "2", isTruncated: true },
        "2": { parts: [{ ETag: "c", PartNumber: 3 }], isTruncated: false },
    };
    const seen: (string | undefined)[] = [];

    const parts = await collectMultipartParts(async (marker) => {
        seen.push(marker);
        return pages[marker ?? ""];
    });

    assert.deepEqual(seen, [undefined, "1", "2"]);
    assert.deepEqual(parts.map((part) => part.PartNumber), [1, 2, 3]);
});

test("collectMultipartParts sorts parts ascending regardless of arrival order", async () => {
    const parts = await collectMultipartParts(async () => ({
        parts: [{ ETag: "c", PartNumber: 3 }, { ETag: "a", PartNumber: 1 }, { ETag: "b", PartNumber: 2 }],
        isTruncated: false,
    }));

    assert.deepEqual(parts.map((part) => part.PartNumber), [1, 2, 3]);
});

test("collectMultipartParts stops when truncated but no marker is returned", async () => {
    let calls = 0;

    const parts = await collectMultipartParts(async () => {
        calls++;
        return { parts: [{ ETag: "a", PartNumber: 1 }], isTruncated: true };
    });

    assert.equal(calls, 1);
    assert.equal(parts.length, 1);
});
