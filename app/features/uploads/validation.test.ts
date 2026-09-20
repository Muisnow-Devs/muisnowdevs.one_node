import assert from "node:assert/strict";
import test from "node:test";
import {
    getExpectedUploadPartCount,
    getMaxUploadSizeBytes,
    getUploadChunkRanges,
    getUploadMode,
    getUploadPartSize,
    MAX_PART_COUNT,
    MIN_PART_SIZE_BYTES,
    R2_MAX_OBJECT_BYTES,
    SINGLE_PUT_MAX_BYTES,
    validateUpload,
} from "./validation";

const MEGABYTE = 1024 * 1024;

test("validateUpload rejects empty files", () => {
    assert.equal(validateUpload("media", 0), "File must not be empty");
});

test("validateUpload rejects a non-integer or NaN size", () => {
    assert.equal(validateUpload("media", Number.NaN), "File must not be empty");
    assert.equal(validateUpload("media", 1.5), "File must not be empty");
});

test("validateUpload caps the media bucket at the configured limit", () => {
    assert.equal(getMaxUploadSizeBytes("media", "100"), 100 * MEGABYTE);
    assert.equal(
        validateUpload("media", 101 * MEGABYTE, 100 * MEGABYTE),
        "File exceeds the 100 MB upload limit",
    );
    assert.equal(validateUpload("media", 100 * MEGABYTE, 100 * MEGABYTE), null);
});

test("getMaxUploadSizeBytes falls back to 100 MiB for an invalid media environment value", () => {
    assert.equal(
        getMaxUploadSizeBytes("media", "not-a-number"),
        100 * MEGABYTE,
    );
});

test("the download bucket is bounded only by the R2 object ceiling", () => {
    assert.equal(getMaxUploadSizeBytes("download", "100"), R2_MAX_OBJECT_BYTES);
    assert.equal(validateUpload("download", 10 * 1024 * MEGABYTE), null);
    assert.equal(validateUpload("download", 0), "File must not be empty");
});

test("getUploadMode switches to multipart just past the single-PUT ceiling", () => {
    assert.equal(getUploadMode(SINGLE_PUT_MAX_BYTES), "single");
    assert.equal(getUploadMode(SINGLE_PUT_MAX_BYTES + 1), "multipart");
    assert.equal(getUploadMode(1), "single");
});

test("getUploadPartSize holds at the minimum until the part ceiling forces growth", () => {
    assert.equal(getUploadPartSize(9 * MEGABYTE), MIN_PART_SIZE_BYTES);
    assert.equal(
        getUploadPartSize(MIN_PART_SIZE_BYTES * MAX_PART_COUNT),
        MIN_PART_SIZE_BYTES,
    );
    assert.ok(
        getUploadPartSize(MIN_PART_SIZE_BYTES * MAX_PART_COUNT + 1) >
            MIN_PART_SIZE_BYTES,
    );
});

test("getUploadPartSize keeps the part count within the S3 ceiling at any size", () => {
    for (const size of [
        MEGABYTE,
        80 * 1024 * MEGABYTE,
        500 * 1024 * MEGABYTE,
        R2_MAX_OBJECT_BYTES,
    ])
        assert.ok(
            getExpectedUploadPartCount(size) <= MAX_PART_COUNT,
            `part count exceeded for ${size}`,
        );
});

test("getUploadPartSize returns whole megabytes so ranges stay aligned", () => {
    assert.equal(getUploadPartSize(R2_MAX_OBJECT_BYTES) % MEGABYTE, 0);
});

test("getUploadChunkRanges covers the file with only the last part smaller", () => {
    assert.deepEqual(getUploadChunkRanges(9 * MEGABYTE), [
        { start: 0, end: 8 * MEGABYTE },
        { start: 8 * MEGABYTE, end: 9 * MEGABYTE },
    ]);

    const ranges = getUploadChunkRanges(20 * MEGABYTE);
    assert.equal(ranges[0].start, 0);
    assert.equal(ranges[ranges.length - 1].end, 20 * MEGABYTE);
    assert.equal(ranges.length, getExpectedUploadPartCount(20 * MEGABYTE));
});

test("getUploadChunkRanges keeps small uploads in one part", () => {
    assert.deepEqual(getUploadChunkRanges(1024), [{ start: 0, end: 1024 }]);
});
