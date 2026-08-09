import assert from "node:assert/strict";
import test from "node:test";
import { collectMultipartParts, PartsPage } from "./multipartParts";

test("collectMultipartParts returns a single page unchanged", async () => {
    const parts = await collectMultipartParts(async () => ({
        parts: [{ ETag: "a", PartNumber: 1 }, { ETag: "b", PartNumber: 2 }],
        isTruncated: false,
    }), 10_000);

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
    }, 10_000);

    assert.deepEqual(seen, [undefined, "1", "2"]);
    assert.deepEqual(parts.map((part) => part.PartNumber), [1, 2, 3]);
});

test("collectMultipartParts sorts parts ascending regardless of arrival order", async () => {
    const parts = await collectMultipartParts(async () => ({
        parts: [{ ETag: "c", PartNumber: 3 }, { ETag: "a", PartNumber: 1 }, { ETag: "b", PartNumber: 2 }],
        isTruncated: false,
    }), 10_000);

    assert.deepEqual(parts.map((part) => part.PartNumber), [1, 2, 3]);
});

test("collectMultipartParts stops when truncated but no marker is returned", async () => {
    let calls = 0;

    const parts = await collectMultipartParts(async () => {
        calls++;
        return { parts: [{ ETag: "a", PartNumber: 1 }], isTruncated: true };
    }, 10_000);

    assert.equal(calls, 1);
    assert.equal(parts.length, 1);
});

test("collectMultipartParts throws when the server repeats a pagination marker", async () => {
    let calls = 0;

    await assert.rejects(collectMultipartParts(async () => {
        calls++;
        return { parts: [{ ETag: "a", PartNumber: 1 }], nextMarker: "1", isTruncated: true };
    }, 10_000), /repeated the pagination marker/);

    // Without the guard this would re-fetch the same page until the process ran out
    // of memory; the second call is where the repeat is detected.
    assert.equal(calls, 2);
});

test("collectMultipartParts throws when the listing exceeds the part ceiling", async () => {
    await assert.rejects(collectMultipartParts(async (marker) => {
        const next = Number(marker ?? 0) + 1;
        return { parts: [{ ETag: "a", PartNumber: next }], nextMarker: String(next), isTruncated: true };
    }, 2), /more than 2 parts/);
});

test("collectMultipartParts stops when the server paginates forever without returning parts", async () => {
    let calls = 0;

    await assert.rejects(
        () => collectMultipartParts(async () => {
            calls += 1;
            return { parts: [], nextMarker: `marker-${calls}`, isTruncated: true };
        }, 2),
        /did not finish within 3 pages/,
    );

    // Empty pages with an ever-fresh marker grow neither the collected list nor the
    // repeated-marker set, so only a bound independent of page contents stops them.
    assert.equal(calls, 3);
});
