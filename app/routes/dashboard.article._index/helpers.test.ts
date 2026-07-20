import assert from "node:assert/strict";
import test from "node:test";
import { getSelectedLabelIds, updateDashboardArticleParams } from "./helpers";

test("getSelectedLabelIds keeps unique non-empty label ids", () => {
    const formData = new FormData();
    formData.append("labelIds", "frontend");
    formData.append("labelIds", "");
    formData.append("labelIds", "backend");
    formData.append("labelIds", "frontend");

    assert.deepEqual(getSelectedLabelIds(formData), ["frontend", "backend"]);
});

test("updating the article page preserves the requested page", () => {
    const params = updateDashboardArticleParams(new URLSearchParams("search=react&page=1"), "page", "2");

    assert.equal(params.toString(), "search=react&page=2");
});

test("updating an article filter resets pagination", () => {
    const params = updateDashboardArticleParams(new URLSearchParams("search=react&page=3"), "label", "frontend");

    assert.equal(params.toString(), "search=react&label=frontend");
});
