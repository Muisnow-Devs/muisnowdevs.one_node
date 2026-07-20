import assert from "node:assert/strict";
import test from "node:test";
import { getExpectedUploadPartCount, getMaxUploadSizeBytes, validateUpload, validateUploadParts } from "./validation";
import { getResourceId } from ".";
import { getUploadChunkRanges } from "./useChunkedUpload";

test("validateUpload rejects empty files", () => {
    assert.equal(validateUpload(0), "File must not be empty");
});

test("validateUpload rejects files larger than the configured limit", () => {
    assert.equal(validateUpload(11 * 1024 * 1024, 10), "File exceeds the 10 MB upload limit");
});

test("validateUpload accepts a file at the configured limit", () => {
    assert.equal(validateUpload(10 * 1024 * 1024, 10), null);
});

test("getMaxUploadSizeBytes uses a safe default for an invalid environment value", () => {
    assert.equal(getMaxUploadSizeBytes("not-a-number"), 100 * 1024 * 1024);
});

test("validateUploadParts rejects malformed multipart completion data", () => {
    assert.equal(validateUploadParts([{ ETag: "", PartNumber: 1 }]), false);
    assert.equal(validateUploadParts([{ ETag: "etag", PartNumber: 0 }]), false);
    assert.equal(validateUploadParts([{ ETag: "etag", PartNumber: 1 }]), true);
});

test("validateUploadParts requires the signed file size's exact sequential part layout", () => {
    const size = 8 * 1024 * 1024 + 1;
    assert.equal(getExpectedUploadPartCount(size), 2);
    assert.equal(validateUploadParts([
        { ETag: "first", PartNumber: 1 },
        { ETag: "second", PartNumber: 2 },
    ], size), true);
    assert.equal(validateUploadParts([{ ETag: "first", PartNumber: 1 }], size), false);
    assert.equal(validateUploadParts([
        { ETag: "first", PartNumber: 1 },
        { ETag: "duplicate", PartNumber: 1 },
    ], size), false);
});

test("download uploads use a UUID-only resource id compatible with downloadable_file", () => {
    assert.equal(getResourceId("download", "archive.zip", () => "12345678-1234-1234-1234-123456789012"), "12345678-1234-1234-1234-123456789012");
});

test("getUploadChunkRanges keeps small uploads in one part", () => {
    assert.deepEqual(getUploadChunkRanges(1024), [{ start: 0, end: 1024 }]);
});

test("getUploadChunkRanges uses 8 MiB parts and leaves only the last part smaller", () => {
    const megabyte = 1024 * 1024;
    assert.deepEqual(getUploadChunkRanges(9 * megabyte), [
        { start: 0, end: 8 * megabyte },
        { start: 8 * megabyte, end: 9 * megabyte },
    ]);
});
