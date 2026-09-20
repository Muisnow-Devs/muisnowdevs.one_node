import assert from "node:assert/strict";
import test from "node:test";
import {
    canEditDownload,
    canFinalizeDownload,
    toggleDownloadLifecycle,
} from "./lifecycle";

test("only upload drafts can be finalized", () => {
    assert.equal(canFinalizeDownload("draft"), true);
    assert.equal(canFinalizeDownload("disabled"), false);
    assert.equal(canFinalizeDownload("deleting"), false);
});

test("only active and disabled downloads are editable or toggleable", () => {
    assert.equal(canEditDownload("active"), true);
    assert.equal(canEditDownload("disabled"), true);
    assert.equal(canEditDownload("draft"), false);
    assert.equal(canEditDownload("deleting"), false);
    assert.equal(toggleDownloadLifecycle("active"), "disabled");
    assert.equal(toggleDownloadLifecycle("disabled"), "active");
    assert.equal(toggleDownloadLifecycle("draft"), null);
    assert.equal(toggleDownloadLifecycle("deleting"), null);
});
