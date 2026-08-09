import assert from "node:assert/strict";
import test from "node:test";
import { getSignaturePayload } from "./signature";

test("getSignaturePayload includes every field that authorizes the upload", () => {
    const payload = getSignaturePayload("media", {
        mode: "multipart",
        uploadId: "upload-1",
        resourceId: "resource-1",
        size: 1024,
    });

    assert.equal(payload, JSON.stringify(["multipart", "media", "upload-1", "resource-1", 1024]));
});

test("getSignaturePayload distinguishes sessions that a delimiter join would collide", () => {
    // The old [bucket, uploadId, resourceId, size].join(':') format could not tell
    // these two apart, so a signature for one authorized the other. A filename like
    // "a.png:0:x" used to reach resourceId verbatim and made this reachable.
    const first = getSignaturePayload("media", { mode: "single", uploadId: "u", resourceId: "a.png:0:x", size: 2 });
    const second = getSignaturePayload("media", { mode: "single", uploadId: "u:a.png", resourceId: "0:x", size: 2 });

    assert.notEqual(first, second);
});

test("getSignaturePayload separates the two upload modes", () => {
    const session = { uploadId: "", resourceId: "resource-1", size: 1024 };

    assert.notEqual(
        getSignaturePayload("media", { ...session, mode: "single" }),
        getSignaturePayload("media", { ...session, mode: "multipart" }),
    );
});

test("getSignaturePayload separates the two buckets", () => {
    const session = { mode: "single" as const, uploadId: "", resourceId: "resource-1", size: 1024 };

    assert.notEqual(getSignaturePayload("media", session), getSignaturePayload("download", session));
});
