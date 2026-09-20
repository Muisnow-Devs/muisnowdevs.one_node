import assert from "node:assert/strict";
import test from "node:test";
import { parseArticlePage } from "./article-pagination";

test("parseArticlePage accepts positive integer pages", () => {
    assert.equal(parseArticlePage("2"), 2);
});

test("parseArticlePage falls back to the first page for invalid input", () => {
    for (const value of [null, "", "0", "-1", "1.5", "abc"]) {
        assert.equal(parseArticlePage(value), 1);
    }
});
