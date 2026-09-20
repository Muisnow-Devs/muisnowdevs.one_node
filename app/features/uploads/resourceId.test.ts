import assert from "node:assert/strict";
import test from "node:test";
import { getFileExtension, getResourceId } from ".";

const stubId = () => "12345678-1234-1234-1234-123456789012";

test("getFileExtension lowercases a simple extension", () => {
    assert.equal(getFileExtension("Photo.PNG"), "png");
    assert.equal(getFileExtension("archive.tar.gz"), "gz");
});

test("getFileExtension returns empty for a missing or bare filename", () => {
    assert.equal(getFileExtension(undefined), "");
    assert.equal(getFileExtension(""), "");
    assert.equal(getFileExtension("no-extension"), "");
    assert.equal(getFileExtension("trailing."), "");
});

test("getFileExtension rejects anything that could escape or confuse the object key", () => {
    // The extension is concatenated into the S3 key and into the signature payload.
    assert.equal(getFileExtension("evil.png/../../secret"), "");
    assert.equal(getFileExtension("evil.png:0:x"), "");
    assert.equal(getFileExtension("evil.a b"), "");
    assert.equal(getFileExtension(`evil.${"a".repeat(13)}`), "");
});

test("media uploads append only a sanitized extension", () => {
    assert.equal(
        getResourceId("media", "Photo.PNG", stubId),
        `${stubId()}.png`,
    );
    assert.equal(getResourceId("media", "evil.png:0:x", stubId), stubId());
    assert.equal(getResourceId("media", undefined, stubId), stubId());
});

test("download uploads never append an extension", () => {
    assert.equal(getResourceId("download", "archive.zip", stubId), stubId());
});
