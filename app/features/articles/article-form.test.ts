import assert from "node:assert/strict";
import test from "node:test";
import { getSelectedLabelIds, parseArticleInput } from "./article-form";

test("getSelectedLabelIds keeps unique non-empty label ids", () => {
    const formData = new FormData();
    formData.append("labelIds", "frontend");
    formData.append("labelIds", "");
    formData.append("labelIds", "backend");
    formData.append("labelIds", "frontend");

    assert.deepEqual(getSelectedLabelIds(formData), ["frontend", "backend"]);
});

test("parseArticleInput trims required fields and preserves checkbox values", () => {
    const formData = new FormData();
    formData.set("title", " Title ");
    formData.set("description", " Description ");
    formData.set("content", "Content");
    formData.set("comment", "on");
    formData.set("enabled", "on");

    assert.deepEqual(parseArticleInput(formData), {
        title: "Title",
        description: "Description",
        content: "Content",
        comment: true,
        enabled: true,
        labelIds: [],
    });
});

test("parseArticleInput rejects missing required fields", () => {
    assert.throws(
        () => parseArticleInput(new FormData()),
        (error: unknown) => error instanceof Response && error.status === 400,
    );
});
